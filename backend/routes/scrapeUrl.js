const express = require('express');
const router = express.Router();

router.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).send('URL is required');
    }
    res.status(200).send('URL received successfully');
  } catch (error) {
    console.error('Error processing URL:', error);
    res.status(500).send('Error processing URL');
  }
});

module.exports = router;
