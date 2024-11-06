const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const scraper = require('../scrape');

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
            if (fs.existsSync(uploadsPath)) {
                fs.readdirSync(uploadsPath)
                    .filter(file => file.endsWith('.md'))
                    .forEach(file => {
                        fs.unlinkSync(path.join(uploadsPath, file));
                    });
                console.log('Cleared existing files for forced scrape');
            }
        }
        
        const startTime = Date.now();
        const result = await scraper.initiateScrapingJob(url, maxDepth, force);
        const endTime = Date.now();
        const timeElapsed = (endTime - startTime) / 1000;

        // Count files in uploads directory
        const uploadsPath = path.join(__dirname, '../uploads');
        const filesCount = fs.existsSync(uploadsPath) 
            ? fs.readdirSync(uploadsPath).filter(file => file.endsWith('.md')).length
            : 0;

        res.status(200).json({
            message: 'Scraping completed',
            startUrl: url,
            maxDepth,
            timeElapsed: `${timeElapsed} seconds`,
            filesProcessed: filesCount,
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

router.get('/status', (req, res) => {
    try {
        const uploadsPath = path.join(__dirname, '../uploads');
        const files = fs.existsSync(uploadsPath)
            ? fs.readdirSync(uploadsPath)
                .filter(file => file.endsWith('.md'))
                .map(file => ({
                    name: file,
                    size: fs.statSync(path.join(uploadsPath, file)).size,
                    lastModified: fs.statSync(path.join(uploadsPath, file)).mtime
                }))
            : [];

        res.status(200).json({
            totalFiles: files.length,
            files: files.sort((a, b) => b.lastModified - a.lastModified)
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
