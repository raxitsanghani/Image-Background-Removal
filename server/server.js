const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const API_KEY = 'YMXgeRV9Ci4p17iamTDauxxa'; // Using the key from original project
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Multer setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// API Routes
app.post('/api/remove-bg', upload.single('image_file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }

    const filePath = req.file.path;

    try {
        const formData = new FormData();
        formData.append('size', 'auto');
        formData.append('image_file', fs.createReadStream(filePath));

        const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': API_KEY,
            },
            responseType: 'arraybuffer', // Important to handle binary data
        });

        // Send the image back
        res.set('Content-Type', 'image/png');
        res.send(response.data);

    } catch (error) {
        const errData = error.response ? error.response.data.toString() : error.message;
        console.error('Error processing image:', errData);

        // Try to parse JSON error from upstream
        let clientError = { error: 'Failed to remove background' };
        try {
            const jsonErr = JSON.parse(errData);
            if (jsonErr.errors) clientError = { error: jsonErr.errors[0].title };
        } catch (e) {
            // Not JSON, keep default
        }

        res.status(error.response ? error.response.status : 500).json(clientError);
    } finally {
        // Clean up uploaded file
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
