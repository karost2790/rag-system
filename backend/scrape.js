const puppeteer = require('puppeteer');
const MarkdownIt = require('markdown-it');
const fs = require('fs');
const md = new MarkdownIt();

async function scrapeWebsite(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new'
        });
        const page = await browser.newPage();

        // Add retry logic for page load
        async function loadPageWithRetry(retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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

        // Extract content
        const content = await page.evaluate(() => {
            const title = document.querySelector('h1')?.innerText || 'No Title';
            const sections = Array.from(document.querySelectorAll('h1, h2, p, pre'))
                .map(node => {
                    if (node.tagName === 'H1') return `# ${node.innerText}`;
                    if (node.tagName === 'H2') return `## ${node.innerText}`;
                    if (node.tagName === 'P') return node.innerText;
                    if (node.tagName === 'PRE') return `\`\`\`\n${node.innerText}\n\`\`\``;
                    return node.innerText;
                });
            return sections.join('\n\n');
        });

        return content;

    } catch (error) {
        console.error('Scraping error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function saveToMarkdown(content, outputPath) {
    try {
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
