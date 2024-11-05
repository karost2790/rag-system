const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

// Constants
const SINGLE_PAGE_TIMEOUT = 30 * 1000; // 30 seconds per page
const ERROR_LOG_PATH = path.join(__dirname, 'error_log.txt');
const uploadsDir = path.join(__dirname, 'uploads');
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Global state
const visitedUrls = new Set();
const urlToFileMap = new Map();

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Browser launch options
const BROWSER_OPTIONS = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--window-size=800x600',
        '--disable-notifications',
        '--blink-settings=imagesEnabled=false'
    ],
    ignoreHTTPSErrors: true,
    timeout: 30000
};

// Helper functions
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function timeoutPromise(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
        )
    ]);
}

function logError(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(ERROR_LOG_PATH, logMessage);
    console.error(logMessage.trim());
}

function loadExistingFiles() {
    console.log('Checking existing files in:', uploadsDir);
    const files = fs.readdirSync(uploadsDir);
    console.log(`Found ${files.length} existing files in uploads directory`);
    return files.reduce((map, filename) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        map.set(filename, stats.mtime);
        return map;
    }, new Map());
}

function createMarkdownFilename(url) {
    const urlObj = new URL(url);
    let filename = urlObj.pathname.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '');
    
    // Handle special cases
    if (!filename) {
        filename = 'index';
    } else if (filename === 'docs') {
        filename = 'docs_index';
    }
    
    // Ensure .md extension
    if (!filename.endsWith('.md')) {
        filename = `${filename}.md`;
    }
    
    console.log('Created filename:', filename, 'for URL:', url);
    return filename;
}

async function saveToMarkdown(content, outputPath) {
    try {
        console.log('Writing file:', outputPath);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            console.log('Creating directory:', dir);
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, content);
        console.log(`Successfully saved file to ${outputPath}`);
        return true;
    } catch (error) {
        console.error('Error saving file:', error);
        console.error('Error details:', error.message);
        throw error;
    }
}

async function launchBrowserWithRetry(retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempting to launch browser (attempt ${i + 1})`);
            const browser = await puppeteer.launch(BROWSER_OPTIONS);
            console.log('Browser launched successfully');
            return browser;
        } catch (error) {
            console.error(`Browser launch attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await wait(RETRY_DELAY);
        }
    }
}

async function scrapeWebsite(baseUrl, maxDepth = 3, currentDepth = 0, existingFiles) {
    console.log(`\nProcessing ${baseUrl} at depth ${currentDepth}`);
    
    if (currentDepth > maxDepth) {
        console.log(`Skipping ${baseUrl} - Max depth reached`);
        return null;
    }
    
    if (visitedUrls.has(baseUrl)) {
        console.log(`Skipping ${baseUrl} - Already visited`);
        return null;
    }

    const filename = createMarkdownFilename(baseUrl);
    
    if (existingFiles.has(filename)) {
        console.log(`File ${filename} already exists, skipping...`);
        visitedUrls.add(baseUrl);
        return { url: baseUrl, filename, status: 'existing' };
    }

    visitedUrls.add(baseUrl);
    let browser;
    
    try {
        console.log('\nStarting new scraping operation...');
        const result = await timeoutPromise(async () => {
            browser = await launchBrowserWithRetry();
            const page = await browser.newPage();
            
            // Setup page logging
            page.on('console', msg => console.log('Browser console:', msg.text()));
            page.on('error', err => console.error('Browser error:', err));
            page.on('pageerror', err => console.error('Page error:', err));

            // Block unnecessary resources
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            console.log(`Loading page: ${baseUrl}`);
            await page.goto(baseUrl, { 
                waitUntil: ['domcontentloaded', 'networkidle0'],
                timeout: 30000 
            });
            
            console.log('Waiting for content to load...');
            await page.waitForFunction(() => {
                const content = document.querySelector('main') || 
                              document.querySelector('article') || 
                              document.querySelector('.docContent');
                return content && content.innerText.length > 0;
            }, { timeout: 10000 }).catch(e => console.log('Content wait timeout:', e.message));

            console.log('Extracting content...');
            const { content, links } = await page.evaluate(() => {
                try {
                    console.log('Starting content extraction...');
                    const sections = [];
                    const relatedLinks = new Set();

                    // Find main content
                    const mainContent = document.querySelector('main') || 
                                      document.querySelector('article') || 
                                      document.querySelector('.docContent');
                    
                    if (!mainContent) {
                        console.log('No main content found');
                        return { content: '', links: [] };
                    }

                    // Extract content
                    mainContent.querySelectorAll('h1, h2, h3, p, pre, code').forEach(node => {
                        const text = node.innerText.trim();
                        if (text) {
                            if (node.tagName === 'H1') sections.push(`# ${text}`);
                            else if (node.tagName === 'H2') sections.push(`## ${text}`);
                            else if (node.tagName === 'H3') sections.push(`### ${text}`);
                            else if (node.tagName === 'PRE' || node.tagName === 'CODE') 
                                sections.push(`\`\`\`\n${text}\n\`\`\``);
                            else sections.push(text);
                        }
                    });

                    // Extract links
                    document.querySelectorAll('a').forEach(link => {
                        try {
                            const url = new URL(link.href);
                            if (url.pathname.startsWith('/docs')) {
                                relatedLinks.add(link.href);
                            }
                        } catch (e) {}
                    });

                    console.log(`Found ${sections.length} content sections and ${relatedLinks.size} links`);
                    return {
                        content: sections.join('\n\n'),
                        links: Array.from(relatedLinks)
                    };
                } catch (e) {
                    console.error('Error in content extraction:', e);
                    return { content: '', links: [] };
                }
            });

            if (!content) {
                throw new Error('No content extracted from page');
            }

            console.log(`Content extracted successfully (${content.length} characters)`);

            // Add navigation
            const navSection = `## Navigation\n\nYou are here: ${baseUrl}\n\nRelated pages:\n${
                Array.from(urlToFileMap.entries())
                    .map(([url, fname]) => `- [${url}](./${fname})`)
                    .join('\n')
            }\n\n---\n\n`;

            const finalContent = navSection + content;
            
            // Save content
            const outputPath = path.join(uploadsDir, filename);
            await saveToMarkdown(finalContent, outputPath);

            return { content: finalContent, links };
        }, SINGLE_PAGE_TIMEOUT);

        // Process found links
        if (result.links && result.links.length > 0) {
            console.log(`\nProcessing ${result.links.length} found links...`);
            const relatedPages = [];

            for (const link of result.links) {
                try {
                    console.log(`\nProcessing link: ${link}`);
                    const childResult = await scrapeWebsite(link, maxDepth, currentDepth + 1, existingFiles);
                    if (childResult) {
                        relatedPages.push(childResult);
                    }
                    await wait(1000); // Delay between pages
                } catch (error) {
                    logError(`Failed to process ${link}: ${error.message}`);
                }
            }

            return {
                url: baseUrl,
                filename,
                status: 'success',
                relatedPages
            };
        }

        return {
            url: baseUrl,
            filename,
            status: 'success',
            relatedPages: []
        };

    } catch (error) {
        logError(`Error processing ${baseUrl}: ${error.message}`);
        const errorContent = `# Error Scraping ${baseUrl}\n\nFailed to scrape this page on ${new Date().toISOString()}\n\nError: ${error.message}`;
        const outputPath = path.join(uploadsDir, filename);
        await saveToMarkdown(errorContent, outputPath);
        
        return {
            url: baseUrl,
            filename,
            status: 'error',
            error: error.message
        };
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log('Browser closed successfully');
            } catch (error) {
                console.error('Error closing browser:', error.message);
            }
        }
    }
}

module.exports = {
    scrapeWebsite,
    saveToMarkdown,
    loadExistingFiles
};