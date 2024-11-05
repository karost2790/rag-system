const express = require('express');
const path = require('path');
const router = express.Router();
const { scrapeWebsite, loadExistingFiles } = require('../scrape');

router.post('/scrape', async (req, res) => {
    try {
        const { url, maxDepth = 3 } = req.body;
        if (!url) {
            return res.status(400).send('URL is required');
        }

        console.log('Starting scrape for URL:', url, 'with maxDepth:', maxDepth);
        
        // Load existing files before starting
        const existingFiles = loadExistingFiles();
        console.log(`Found ${existingFiles.size} existing files`);

        // Start the recursive scraping
        const result = await scrapeWebsite(url, maxDepth, 0, existingFiles);

        res.status(200).json({
            message: 'URLs scraped successfully',
            startUrl: url,
            maxDepth: maxDepth,
            result: result
        });

    } catch (error) {
        console.error('Error processing URL:', error);
        res.status(500).send('Error processing URL: ' + error.message);
    }
});

module.exports = router;