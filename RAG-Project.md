
# Project Plan for RAG System

## Project Overview
The RAG System will automate the process of scraping and organizing LangChain documentation into Markdown files, index the content in a vector database, and provide a web-based chat interface. This system will support adding multiple Markdown files and custom URLs for scraping, making it flexible and easy to maintain. The integration with a language model (LLM), such as Aider or Claude-3.5, will ensure contextually rich and accurate responses.

---
## Running job
```
# remove old mode
sudo rm -rf backend/uploads/*.md

# start server
cd backend && node server.js

# at client
curl -X POST -H "Content-Type: application/json" -d '{"url":"https://docs.langchain.com/docs/", "maxDepth": 3, "force": true}' http://localhost:3000/api/url/scrape


curl -X POST -H "Content-Type: application/json" -d '{"url":"https://docs.langchain.com/docs/", "maxDepth": 3, "force": true}' http://localhost:3000/api/url/scrape

curl -X POST -H "Content-Type: application/json" -d '{"url":"https://docs.langchain.com/docs/", "maxDepth": 2}' http://localhost:3000/api/url/scrape

```
---
## Project Directory Structure
The project will be organized as follows:

```
tree -I 'node_modules'
RAG-System/
├── RAG-Project.md
├── backend
│   ├── error_log.txt
│   ├── package-lock.json
│   ├── package.json
│   ├── routes
│   │   ├── scrapeUrl.js
│   │   ├── uploadMarkdown.js
│   │   └── uploads
│   ├── scrape.js
│   ├── server.js
│   ├── uploads
│   └── utils
│       └── indexData.js
├── code-block.md
├── frontend
│   ├── package.json
│   ├── public
│   └── src
│       ├── App.js
│       ├── components
│       │   ├── Chat.js
│       │   └── UpdateContent.js
│       └── index.js
├── package-lock.json
└── package.json

10 directories, 17 files
```

---

## Implementation Steps

### 1. **Setup Environment**
1. **Install Node.js and NPM**:
   - Download and install [Node.js](https://nodejs.org/), which includes NPM.

2. **Initialize the Project**:
   ```bash
   mkdir RAG-System
   cd RAG-System
   npm init -y
   ```

3. **Install Dependencies**:
   - **Backend Dependencies**: Puppeteer, Express.js, Multer, Axios, Dotenv
   - **Frontend Dependencies**: React.js
   ```bash
   cd backend
   npm install puppeteer express multer axios dotenv
   cd ../frontend
   npx create-react-app .
   ```

---

### 2. **Data Collection with Puppeteer**
**Directory**: `backend/scrape.js`

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

    // Extract the hostname and remove subdomains and suffixes
    let domain = urlObj.hostname.split('.').slice(-2, -1)[0]; // Gets 'example' from 'www.example.com'
    let rootx = filename.split('_').slice(1).join('_');
    // If you want to ensure no common TLD (like .com, .net, etc.) remains
    domain = domain.replace(/\.(com|net|org|edu)$/, '');
    
    if (!filename) {
        filename = `${domain}_index`;
    } else if (filename === 'docs') {
        filename = `${domain}_index2`;
    } else {
        rootx = filename.split('_').slice(1).join('_'); 
        filename = `${domain}_${rootx}`;
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

**Best Practices**:
- **Dynamic Content Handling**: Use `page.waitForSelector` to ensure content loads.
- **Error Handling and Retries**: Include retry logic for resilience.

---

### 3. **Data Indexing and Storage**
**Directory**: `backend/utils/indexData.js`

```javascript
const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('langchain');
require('dotenv').config();

const markdownContent = fs.readFileSync('langchain_documentation.md', 'utf-8');
const sections = markdownContent.split('\n\n');

async function indexData(content) {
    for (const section of sections) {
        const embedding = await getEmbedding(section);
        await axios.post('http://localhost:8080/vectors', {
            vector: embedding,
            content: section,
            metadata: { category: "Documentation" }
        });
    }
    console.log("Data indexed successfully!");
}

async function getEmbedding(text) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    return openai.embed({ input: text });
}

module.exports = { indexData };
```

**Best Practices**:
- **Backup and Recovery**: Schedule regular database backups.
- **Efficient Indexing**: Use metadata for better retrieval.

---

### 4. **Adding New Features**

#### 4.1 **Upload Multiple Markdown Files**
**Directory**: `backend/routes/uploadMarkdown.js`

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

**Best Practices**:
- **File Validation**: Validate file types and ensure security.
- **Error Handling**: Manage file upload errors gracefully.

---

#### 4.2 **Scrape Custom URLs**
**Directory**: `backend/routes/scrapeUrl.js`

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

**Best Practices**:
- **Selector Flexibility**: Adapt to various HTML structures.
- **Error Handling**: Manage network timeouts and invalid URLs.

---

### 5. **Web-Based Chat UI**
**Directory**: `frontend/src/components/UpdateContent.js`

```javascript
import React, { useState } from 'react';
import axios from 'axios';

const UpdateContent = () => {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');

  const uploadFile = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/api/upload-markdown', formData);
      alert('File uploaded successfully.');
    } catch (error) {
      alert('Failed to upload file.');
    }
  };

  const scrapeUrl = async () => {
    if (!url) return;
    try {
      await axios.post('/api/scrape-url', { url });
      alert('URL content scraped successfully.');
    } catch (error) {
      alert('Failed to scrape URL.');
    }
  };

  return (
    <div className="update-content">
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={uploadFile}>Upload Markdown</button>
      <input type="text" placeholder="Enter URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button onClick={scrapeUrl}>Scrape URL</button>
    </div>
  );
};

export default UpdateContent;
```

**Best Practices**:
- **Input Validation**: Ensure

 valid file types and URL formats.
- **User Feedback**: Provide clear feedback on success or failure.

---

### 6. **LLM and Aider Integration**
**Directory**: `backend/server.js`

```javascript
//require('dotenv').config();
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

**Best Practices**:
- **Secure API Keys**: Use environment variables.
- **Prompt Optimization**: Refine prompts for quality responses.

---

### 7. **Testing and Quality Assurance**
**Directory**: `backend/tests`

- **Unit Tests**: Use Jest to test backend logic.
- **Integration Tests**: Verify data flow from scraping to LLM response.
- **End-to-End Tests**: Use Cypress for frontend testing.

**Example Jest Test**:
```javascript
const request = require('supertest');
const app = require('../server');

test('POST /api/query should return a response', async () => {
  const response = await request(app)
    .post('/api/query')
    .send({ input: 'What is LangChain?' });
  expect(response.status).toBe(200);
  expect(response.body).toBeTruthy();
});
```

**Example Cypress Test**:
```javascript
describe('Chat UI', () => {
  it('should send a message and display the response', () => {
    cy.visit('/');
    cy.get('textarea').type('Explain LangChain');
    cy.get('button').click();
    cy.get('.bot-msg').should('contain', 'LangChain is...');
  });
});
```

**Best Practices**:
- **Automated Testing**: Use CI/CD pipelines.
- **Manual QA**: Perform manual testing for edge cases.

---

### 8. **Deployment and Maintenance**
**Directory**: Root (`docker-compose.yml`)

**Example Dockerfile**:
```dockerfile
FROM node:16
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

**Deployment Plan**:
- **Containerize**: Use Docker for consistent deployment.
- **Cloud Services**: Deploy on AWS ECS, GCP, or Vercel.
- **Monitoring**: Use Prometheus and Grafana.

**Best Practices**:
- **Automated Backups**: Schedule database backups.
- **Performance Alerts**: Set up alerts for issues.

---

## Summary
This complete project plan for the RAG System now includes features for uploading Markdown files and scraping custom URLs, making it flexible and user-friendly. The document provides clear file names, directory structures, and best practices for a successful implementation.

You’re all set to start developing your RAG System! Feel free to reach out if you need more guidance.