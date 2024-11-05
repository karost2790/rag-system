const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { scrapeWebsite, loadExistingFiles } = require('../scrape');

router.post('/', async (req, res) => {
    try {
        const { url, maxDepth = 3, force = false } = req.body;
        if (!url) {
            return res.status(400).json({
                error: true,
                message: 'URL is required'
            });
        }

        console.log('Starting scrape:', { url, maxDepth, force });
        
        // Clear existing files if force is true
        if (force) {
            const uploadsPath = path.join(__dirname, '../uploads');
            fs.readdirSync(uploadsPath)
                .filter(file => file.endsWith('.md'))
                .forEach(file => {
                    fs.unlinkSync(path.join(uploadsPath, file));
                });
            console.log('Cleared existing files for forced scrape');
        }
        
        const existingFiles = force ? new Map() : loadExistingFiles();
        console.log(`Found ${existingFiles.size} existing files${force ? ' (ignored due to force)' : ''}`);
        
        const startTime = Date.now();

        const result = await scrapeWebsite(url, maxDepth, 0, existingFiles);

        const endTime = Date.now();
        const timeElapsed = (endTime - startTime) / 1000;

        res.status(200).json({
            message: 'Scraping completed',
            startUrl: url,
            maxDepth,
            timeElapsed: `${timeElapsed} seconds`,
            filesProcessed: fs.readdirSync(path.join(__dirname, '../uploads')).length,
            result
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: true,
            message: error.message,
            startUrl: req.body.url
        });
    }
});

// Add status endpoint to check progress
router.get('/status', (req, res) => {
    try {
        const uploadsPath = path.join(__dirname, '../uploads');
        const files = fs.readdirSync(uploadsPath)
            .filter(file => file.endsWith('.md'))
            .map(file => ({
                name: file,
                size: fs.statSync(path.join(uploadsPath, file)).size,
                lastModified: fs.statSync(path.join(uploadsPath, file)).mtime
            }));

        res.status(200).json({
            totalFiles: files.length,
            files: files.sort((a, b) => b.lastModified - a.lastModified) // Most recent first
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

module.exports = router;