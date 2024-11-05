const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const visitedUrls = new Set();
const urlToFileMap = new Map(); // Keep track of URL to filename mappings

function createMarkdownFilename(url) {
    const urlObj = new URL(url);
    return `${urlObj.pathname.replace(/\//g, '_')}.md`
        .replace(/^_/, '')
        .replace(/_$/, '');
}

async function scrapeWebsite(baseUrl, maxDepth = 2, currentDepth = 0) {
    if (currentDepth > maxDepth || visitedUrls.has(baseUrl)) {
        return null;
    }
    
    visitedUrls.add(baseUrl);
    const filename = createMarkdownFilename(baseUrl);
    urlToFileMap.set(baseUrl, filename); // Store URL to filename mapping

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new'
        });
        const page = await browser.newPage();

        async function loadPageWithRetry(retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    await page.waitForSelector('h1, h2, p', { timeout: 5000 });
                    return true;
                } catch (error) {
                    console.error(`Attempt ${i + 1} failed:`, error);
                    if (i === retries - 1) throw error;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        await loadPageWithRetry();

        // Extract content and links
        const { content, links } = await page.evaluate((baseUrl) => {
            const sections = [];
            const relatedLinks = new Set();
            const baseUrlObj = new URL(baseUrl);
            
            // Extract text content and preserve links
            document.querySelectorAll('h1, h2, h3, p, pre, code, a').forEach(node => {
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
                    let text = node.innerHTML;
                    // Convert links within paragraphs
                    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, (match, href, text) => {
                        try {
                            const url = new URL(href, baseUrl);
                            if (url.hostname === baseUrlObj.hostname && 
                                url.pathname.startsWith('/docs')) {
                                relatedLinks.add(url.href);
                                return `[${text}](${url.href})`;
                            }
                            return text;
                        } catch (e) {
                            return text;
                        }
                    });
                    // Remove other HTML tags
                    text = text.replace(/<[^>]*>/g, '').trim();
                    if (text) sections.push(text);
                }
                else if (node.tagName === 'PRE' || node.tagName === 'CODE') {
                    const code = node.innerText.trim();
                    if (code) sections.push(`\`\`\`\n${code}\n\`\`\``);
                }
                else if (node.tagName === 'A' && !node.parentElement.closest('p')) {
                    try {
                        const href = new URL(node.href, baseUrl);
                        if (href.hostname === baseUrlObj.hostname && 
                            href.pathname.startsWith('/docs') &&
                            !href.pathname.includes('#')) {
                            relatedLinks.add(href.href);
                            sections.push(`[${node.innerText.trim()}](${href.href})`);
                        }
                    } catch (e) {
                        // Invalid URL, skip it
                    }
                }
            });

            return {
                content: sections.join('\n\n'),
                links: Array.from(relatedLinks)
            };
        }, baseUrl);

        // Replace absolute URLs with relative markdown links
        let processedContent = content;
        urlToFileMap.forEach((filename, url) => {
            // Replace absolute URLs with relative markdown links
            const regex = new RegExp(`\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
            processedContent = processedContent.replace(regex, `(./${filename})`);
        });

        // Add navigation section at the top
        const navSection = `## Navigation\n\nYou are here: ${baseUrl}\n\nRelated pages:\n${
            Array.from(urlToFileMap.entries())
                .map(([url, fname]) => `- [${url}](./${fname})`)
                .join('\n')
        }\n\n---\n\n`;

        processedContent = navSection + processedContent;

        // Save the content
        const outputPath = path.join(__dirname, 'uploads', filename);
        await saveToMarkdown(processedContent, outputPath);

        // Recursively scrape related pages
        for (const link of links) {
            await scrapeWebsite(link, maxDepth, currentDepth + 1);
        }

        return {
            url: baseUrl,
            filename: filename
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
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, content);
        console.log(`Content saved to ${outputPath}`);
        return true;
    } catch (error) {
        console.error('Error saving file:', error);
        throw error;
    }
}

module.exports = {
    scrapeWebsite,
    saveToMarkdown
};