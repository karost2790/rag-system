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

        // Extract only relevant textual content
        const content = await page.evaluate(() => {
            const sections = [];
            const elements = document.querySelectorAll('h1, h2, h3, p, pre, code');
            
            elements.forEach(node => {
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
                    if (text) sections.push(text);
                }
                else if (node.tagName === 'PRE' || node.tagName === 'CODE') {
                    const code = node.innerText.trim();
                    if (code) sections.push(`\`\`\`\n${code}\n\`\`\``);
                }
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
        const dir = require('path').dirname(outputPath);
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
