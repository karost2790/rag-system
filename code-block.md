# Source Code Documentation

## Frontend

### package.json
```json
{
  "name": "rag-system-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "axios": "^1.4.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

### App.js
```javascript
import React from 'react';
import Chat from './components/Chat';
import UpdateContent from './components/UpdateContent';

function App() {
  return (
    <div className="App">
      <h1>RAG System</h1>
      <UpdateContent />
      <Chat />
    </div>
  );
}

export default App;
```

### components/Chat.js
```javascript
import React from 'react';

function Chat() {
  return (
    <div className="chat">
      {/* TODO: Implement chat interface */}
    </div>
  );
}

export default Chat;
```

### components/UpdateContent.js
```javascript
import React from 'react';

function UpdateContent() {
  return (
    <div className="update-content">
      {/* TODO: Implement content update interface */}
    </div>
  );
}

export default UpdateContent;
```

### index.js
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Backend

### package.json
```json
{
  "name": "rag-system-backend",
  "version": "1.0.0",
  "description": "Backend for RAG System",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "markdown-it": "^13.0.2",
    "multer": "^1.4.5-lts.1",
    "puppeteer": "^22.8.2"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

### server.js
```javascript
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
```

### utils/indexData.js
```javascript
// TODO: Implement data indexing functionality

module.exports = {
  // Add exported functions here
};
```

### routes/uploadMarkdown.js
```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.md') {
            cb(null, true);
        } else {
            cb(new Error('Only markdown files are allowed'));
        }
    }
});

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: 'No file uploaded'
            });
        }

        res.status(200).json({
            message: 'File uploaded successfully',
            filename: req.file.filename,
            path: req.file.path
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

router.get('/files', (req, res) => {
    try {
        const uploadsPath = path.join(__dirname, '../uploads');
        const files = fs.readdirSync(uploadsPath)
            .filter(file => file.endsWith('.md'))
            .map(file => ({
                name: file,
                path: path.join(uploadsPath, file),
                created: fs.statSync(path.join(uploadsPath, file)).birthtime
            }));

        res.status(200).json({
            files: files
        });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

module.exports = router;
```

### routes/scrapeUrl.js
```javascript
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
```

### scrape.js
```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const visitedUrls = new Set();
const urlToFileMap = new Map();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function createMarkdownFilename(url) {
    const urlObj = new URL(url);
    let filename = urlObj.pathname.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '');
    
    if (!filename) {
        filename = 'index';
    } else if (filename === 'docs') {
        filename = 'docs_index';
    }
    
    if (!filename.endsWith('.md')) {
        filename = `${filename}.md`;
    }
    
    console.log('Created filename:', filename, 'for URL:', url);
    return filename;
}

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeWebsite(baseUrl, maxDepth = 2, currentDepth = 0) {
    console.log(`Scraping ${baseUrl} at depth ${currentDepth}`);
    
    if (currentDepth > maxDepth || visitedUrls.has(baseUrl)) {
        console.log(`Skipping ${baseUrl} (depth: ${currentDepth}, visited: ${visitedUrls.has(baseUrl)})`);
        return null;
    }
    
    visitedUrls.add(baseUrl);
    const filename = createMarkdownFilename(baseUrl);
    urlToFileMap.set(baseUrl, filename);

    let browser;
    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new'
        });
        const page = await browser.newPage();

        // Add console log listener
        page.on('console', msg => console.log('Browser console:', msg.text()));

        async function loadPageWithRetry(retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`Attempting to load ${baseUrl} (attempt ${i + 1})`);
                    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                    // Wait for main content selectors
                    await Promise.race([
                        page.waitForSelector('nav', { timeout: 5000 }),
                        page.waitForSelector('main', { timeout: 5000 }),
                        page.waitForSelector('article', { timeout: 5000 })
                    ]).catch(() => console.log('Some expected elements not found'));
                    
                    // Additional wait for dynamic content
                    await wait(2000);
                    return true;
                } catch (error) {
                    console.error(`Attempt ${i + 1} failed:`, error);
                    if (i === retries - 1) throw error;
                    await wait(2000);
                }
            }
        }

        await loadPageWithRetry();
        console.log('Page loaded successfully');

        // Extract content and links
        const { content, links } = await page.evaluate(() => {
            const sections = [];
            const relatedLinks = new Set();
            
            // Helper function to process links
            function addLink(href) {
                try {
                    const url = new URL(href);
                    if (url.pathname.startsWith('/docs')) {
                        relatedLinks.add(url.href);
                    }
                } catch (e) {
                    // Invalid URL, skip it
                }
            }

            // Get all navigation links
            document.querySelectorAll('nav a, aside a, .sidebar a, .navigation a').forEach(link => {
                if (link.href) addLink(link.href);
            });

            // Extract text content
            document.querySelectorAll('main h1, main h2, main h3, main p, main pre, main code, article h1, article h2, article h3, article p, article pre, article code').forEach(node => {
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
                    if (text) {
                        sections.push(text);
                        // Check for links within paragraphs
                        node.querySelectorAll('a').forEach(link => {
                            if (link.href) addLink(link.href);
                        });
                    }
                }
                else if (node.tagName === 'PRE' || node.tagName === 'CODE') {
                    const code = node.innerText.trim();
                    if (code) sections.push(`\`\`\`\n${code}\n\`\`\``);
                }
            });

            console.log(`Found ${relatedLinks.size} related links`);
            return {
                content: sections.join('\n\n'),
                links: Array.from(relatedLinks)
            };
        });

        console.log(`Found ${links.length} related links:`, links);

        // Add navigation section
        const navSection = `## Navigation\n\nYou are here: ${baseUrl}\n\nRelated pages:\n${
            Array.from(urlToFileMap.entries())
                .map(([url, fname]) => `- [${url}](./${fname})`)
                .join('\n')
        }\n\n---\n\n`;

        const finalContent = navSection + content;

        // Save the content
        const outputPath = path.join(uploadsDir, filename);
        console.log('Saving content to:', outputPath);
        
        await saveToMarkdown(finalContent, outputPath);

        // Recursively scrape related pages
        console.log(`Starting to scrape ${links.length} related pages...`);
        for (const link of links) {
            await scrapeWebsite(link, maxDepth, currentDepth + 1);
        }

        return {
            url: baseUrl,
            filename: filename,
            relatedLinks: links
        };

    } catch (error) {
        console.error(`Error scraping ${baseUrl}:`, error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function saveToMarkdown(content, outputPath) {
    try {
        console.log('Writing file:', outputPath);
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)){
            console.log('Creating directory:', dir);
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, content);
        console.log(`Successfully saved file to ${outputPath}`);
        return true;
    } catch (error) {
        console.error('Error saving file:', error);
        console.error('Error details:', error.message);
        throw error;
    }
}

async function initiateScrapingJob(url, maxDepth, force = false) {
    console.log('\n=== Starting new scraping job ===');
    console.log('URL:', url);
    console.log('Max depth:', maxDepth);
    console.log('Force:', force);

    // Reset global state
    visitedUrls.clear();
    urlToFileMap.clear();

    try {
        const result = await scrapeWebsite(url, maxDepth);
        if (!result) {
            throw new Error('Scraping failed - no content retrieved');
        }
        return result;
    } catch (error) {
        console.error('Scraping job failed:', error);
        throw error;
    }
}

module.exports = {
    scrapeWebsite,
    saveToMarkdown,
    initiateScrapingJob
};
```

## Root package.json
```json
{
  "name": "rag-system",
  "version": "1.0.0",
  "description": "RAG System for LangChain documentation",
  "main": "index.js",
  "scripts": {
    "start": "node backend/server.js",
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "cd backend && npm run dev",
    "client": "cd frontend && npm start"
  },
  "keywords": ["rag", "langchain", "documentation"],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```
