const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const uploadRouter = require('./routes/uploadMarkdown');
const scrapeRouter = require('./routes/scrapeUrl');

const app = express();
app.use(express.json());

// Routes
app.use('/api/markdown', uploadRouter);
app.use('/api/url', scrapeRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
