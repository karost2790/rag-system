const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const visitedUrls = new Set();
const urlToFileMap = new Map();
const uploadsDir = path.join(__dirname, 'uploads');


// Add browser launch configuration
const BROWSER_OPTIONS = {
    headless: 'new',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
    ],
    timeout: 60000  // Increase launch timeout to 60 seconds
};

// Add browser launch retry logic
async function launchBrowserWithRetry(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempting to launch browser (attempt ${i + 1})`);
            const browser = await puppeteer.launch(BROWSER_OPTIONS);
            console.log('Browser launched successfully');
            return browser;
        } catch (error) {
            console.error(`Browser launch attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await wait(5000); // Wait 5 seconds before retrying
        }
    }
}


// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Load existing files into urlToFileMap
function loadExistingFiles() {
    const files = fs.readdirSync(uploadsDir);
    console.log(`Found ${files.length} existing files in uploads directory`);
    return files.reduce((map, filename) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        map.set(filename, stats.mtime);
        return map;
    }, new Map());
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeWebsite(baseUrl, maxDepth = 3, currentDepth = 0, existingFiles) {
    console.log(`Scraping ${baseUrl} at depth ${currentDepth}`);
    
    if (currentDepth > maxDepth || visitedUrls.has(baseUrl)) {
        console.log(`Skipping ${baseUrl} (depth: ${currentDepth}, visited: ${visitedUrls.has(baseUrl)})`);
        return null;
    }
    
    const filename = createMarkdownFilename(baseUrl);
    
    if (existingFiles.has(filename)) {
        console.log(`File ${filename} already exists, skipping...`);
        visitedUrls.add(baseUrl);
        return {
            url: baseUrl,
            filename: filename,
            status: 'existing'
        };
    }

    visitedUrls.add(baseUrl);
    urlToFileMap.set(baseUrl, filename);

    let browser;
    try {
        browser = await launchBrowserWithRetry(3);
        const page = await browser.newPage();
        
        // Set longer timeouts for navigation
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(60000);

        page.on('console', msg => console.log('Browser console:', msg.text()));

        async function loadPageWithRetry(retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`Attempting to load ${baseUrl} (attempt ${i + 1})`);
                    await page.goto(baseUrl, { 
                        waitUntil: 'networkidle0', 
                        timeout: 60000  // 60 second timeout
                    });
                    
                    // Wait for any of these selectors
                    await Promise.race([
                        page.waitForSelector('nav', { timeout: 10000 }),
                        page.waitForSelector('main', { timeout: 10000 }),
                        page.waitForSelector('article', { timeout: 10000 })
                    ]).catch(() => console.log('Some expected elements not found, continuing anyway...'));
                    
                    await wait(3000); // Wait longer for dynamic content
                    return true;
                } catch (error) {
                    console.error(`Page load attempt ${i + 1} failed:`, error.message);
                    if (i === retries - 1) throw error;
                    await wait(5000);
                }
            }
        }

        await loadPageWithRetry();
        console.log('Page loaded successfully');

        // ... rest of the scraping logic ...

        // Handle related pages with better error handling
        console.log(`Starting to scrape ${links.length} related pages...`);
        const results = await Promise.allSettled(
            links.map(link => scrapeWebsite(link, maxDepth, currentDepth + 1, existingFiles))
        );

        const successfulResults = results
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

        return {
            url: baseUrl,
            filename: filename,
            status: 'new',
            relatedPages: successfulResults
        };

    } catch (error) {
        console.error(`Error scraping ${baseUrl}:`, error.message);
        // Create a minimal file for failed scrapes to avoid repeated attempts
        const errorContent = `# Error Scraping ${baseUrl}\n\nFailed to scrape this page on ${new Date().toISOString()}\n\nError: ${error.message}`;
        const outputPath = path.join(uploadsDir, filename);
        await saveToMarkdown(errorContent, outputPath);
        
        return {
            url: baseUrl,
            filename: filename,
            status: 'error',
            error: error.message
        };
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (error) {
                console.error('Error closing browser:', error.message);
            }
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

function createMarkdownFilename(url) {
    const urlObj = new URL(url);
    let filename = urlObj.pathname.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '');
    
    // Handle root/empty pathname
    if (!filename) {
        filename = 'index';
    } else if (filename === 'docs') {
        filename = 'docs_index';
    }
    
    // Add .md extension if not present
    if (!filename.endsWith('.md')) {
        filename = `${filename}.md`;
    }
    
    console.log('Created filename:', filename, 'for URL:', url);
    return filename;
}


module.exports = {
    scrapeWebsite,
    saveToMarkdown,
    loadExistingFiles
};