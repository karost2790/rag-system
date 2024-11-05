const express = require('express');
const path = require('path');
const router = express.Router();
const { scrapeWebsite, saveToMarkdown } = require('../scrape');

router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).send('URL is required');
        }

        // Scrape the website
        const content = await scrapeWebsite(url);

        // Generate filename based on URL
        const filename = `${Date.now()}-${new URL(url).hostname}.md`;
        const outputPath = path.join(__dirname, '..', 'uploads', filename);

        // Save content to file
        await saveToMarkdown(content, outputPath);

        res.status(200).json({
            message: 'URL scraped successfully',
            filename: filename
        });

    } catch (error) {
        console.error('Error processing URL:', error);
        res.status(500).send('Error processing URL: ' + error.message);
    }
});

module.exports = router;
