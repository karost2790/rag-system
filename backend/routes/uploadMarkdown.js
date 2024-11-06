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