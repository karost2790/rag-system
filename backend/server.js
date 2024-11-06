const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs'); 

dotenv.config();

// Import routes
const uploadRouter = require('./routes/uploadMarkdown');
const scrapeRouter = require('./routes/scrapeUrl');

const app = express();

// Middleware
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use('/api/upload', uploadRouter);
app.use('/api/scrape', scrapeRouter);
app.use('/api/url/scrape', scrapeRouter); // Add alias route

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: true,
        message: err.message || 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
