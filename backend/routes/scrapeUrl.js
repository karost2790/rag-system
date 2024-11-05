const express = require('express');
const router = express.Router();
const path = require('path');
const { scrapeWebsite, saveToMarkdown } = require('../scrape');

router.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).send('URL is required');
    }

    const content = await scrapeWebsite(url);
    const filename = `scraped-${Date.now()}.md`;
    const outputPath = path.join(__dirname, '../uploads', filename);
    
    await saveToMarkdown(content, outputPath);
    
    res.status(200).json({
      message: 'URL scraped successfully',
      filename: filename
    });
  } catch (error) {
    console.error('Error processing URL:', error);
    res.status(500).send('Error processing URL');
  }
});

module.exports = router;
