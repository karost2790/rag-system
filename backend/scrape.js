const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const visitedUrls = new Set();
const urlToFileMap = new Map();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function createMarkdownFilename(url) {
    const urlObj = new URL(url);
    const filename = `${urlObj.pathname.replace(/\//g, '_')}.md`
        .replace(/^_/, '')
        .replace(/_$/, '')
        .replace(/^docs_/, '');
    console.log('Created filename:', filename, 'for URL:', url);
    return filename;
}

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeWebsite(baseUrl, maxDepth = 2, currentDepth = 0) {
    console.log(`Scraping ${baseUrl} at depth ${currentDepth}`);
    
    if (currentDepth > maxDepth || visitedUrls.has(baseUrl)) {
        console.log(`Skipping ${baseUrl} (depth: ${currentDepth}, visited: ${visitedUrls.has(baseUrl)})`);
        return null;
    }
    
    visitedUrls.add(baseUrl);
    const filename = createMarkdownFilename(baseUrl);
    urlToFileMap.set(baseUrl, filename);

    let browser;
    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new'
        });
        const page = await browser.newPage();

        // Add console log listener
        page.on('console', msg => console.log('Browser console:', msg.text()));

        async function loadPageWithRetry(retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`Attempting to load ${baseUrl} (attempt ${i + 1})`);
                    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                    // Wait for main content selectors
                    await Promise.race([
                        page.waitForSelector('nav', { timeout: 5000 }),
                        page.waitForSelector('main', { timeout: 5000 }),
                        page.waitForSelector('article', { timeout: 5000 })
                    ]).catch(() => console.log('Some expected elements not found'));
                    
                    // Additional wait for dynamic content
                    await wait(2000);
                    return true;
                } catch (error) {
                    console.error(`Attempt ${i + 1} failed:`, error);
                    if (i === retries - 1) throw error;
                    await wait(2000);
                }
            }
        }

        await loadPageWithRetry();
        console.log('Page loaded successfully');

        // Extract content and links
        const { content, links } = await page.evaluate(() => {
            const sections = [];
            const relatedLinks = new Set();
            
            // Helper function to process links
            function addLink(href) {
                try {
                    const url = new URL(href);
                    if (url.pathname.startsWith('/docs')) {
                        relatedLinks.add(url.href);
                    }
                } catch (e) {
                    // Invalid URL, skip it
                }
            }

            // Get all navigation links
            document.querySelectorAll('nav a, aside a, .sidebar a, .navigation a').forEach(link => {
                if (link.href) addLink(link.href);
            });

            // Extract text content
            document.querySelectorAll('main h1, main h2, main h3, main p, main pre, main code, article h1, article h2, article h3, article p, article pre, article code').forEach(node => {
                if (node.tagName === 'H1') {
                    sections.push(`# ${node.innerText.trim()}`);
                } 
                else if (node.tagName === 'H2') {
                    sections.push(`## ${node.innerText.trim()}`);
                }
                else if (node.tagName === 'H3') {
                    sections.push(`### ${node.innerText.trim()}`);
                }
                else if (node.tagName === 'P') {
                    const text = node.innerText.trim();
                    if (text) {
                        sections.push(text);
                        // Check for links within paragraphs
                        node.querySelectorAll('a').forEach(link => {
                            if (link.href) addLink(link.href);
                        });
                    }
                }
                else if (node.tagName === 'PRE' || node.tagName === 'CODE') {
                    const code = node.innerText.trim();
                    if (code) sections.push(`\`\`\`\n${code}\n\`\`\``);
                }
            });

            console.log(`Found ${relatedLinks.size} related links`);
            return {
                content: sections.join('\n\n'),
                links: Array.from(relatedLinks)
            };
        });

        console.log(`Found ${links.length} related links:`, links);

        // Add navigation section
        const navSection = `## Navigation\n\nYou are here: ${baseUrl}\n\nRelated pages:\n${
            Array.from(urlToFileMap.entries())
                .map(([url, fname]) => `- [${url}](./${fname})`)
                .join('\n')
        }\n\n---\n\n`;

        const finalContent = navSection + content;

        // Save the content
        const outputPath = path.join(uploadsDir, filename);
        console.log('Saving content to:', outputPath);
        
        await saveToMarkdown(finalContent, outputPath);

        // Recursively scrape related pages
        console.log(`Starting to scrape ${links.length} related pages...`);
        for (const link of links) {
            await scrapeWebsite(link, maxDepth, currentDepth + 1);
        }

        return {
            url: baseUrl,
            filename: filename,
            relatedLinks: links
        };

    } catch (error) {
        console.error(`Error scraping ${baseUrl}:`, error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function saveToMarkdown(content, outputPath) {
    try {
        console.log('Writing file:', outputPath);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)){
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

async function initiateScrapingJob(url, maxDepth, force = false) {
    console.log('\n=== Starting new scraping job ===');
    console.log('URL:', url);
    console.log('Max depth:', maxDepth);
    console.log('Force:', force);

    // Reset global state
    visitedUrls.clear();
    urlToFileMap.clear();

    try {
        const result = await scrapeWebsite(url, maxDepth);
        if (!result) {
            throw new Error('Scraping failed - no content retrieved');
        }
        return result;
    } catch (error) {
        console.error('Scraping job failed:', error);
        throw error;
    }
}

module.exports = {
    scrapeWebsite,
    saveToMarkdown,
    initiateScrapingJob
};
