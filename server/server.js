const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/removebg_db')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Image Schema
const imageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    uploadDate: { type: Date, default: Date.now },
    imageUrl: String,
    data: Buffer  // Storing image as Buffer
});

const Image = mongoose.model('Image', imageSchema);

// Configuration
const API_KEY = 'YMXgeRV9Ci4p17iamTDauxxa'; // Using the key from original project
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware - Increase limits for unlimited size
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
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

const upload = multer({
    storage: storage,
    limits: { fileSize: Infinity } // Unlimited file size
});

// Serve Image Route
app.get('/api/images/:id', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).send('Image not found');
        }
        res.set('Content-Type', image.contentType);
        res.send(image.data);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving image');
    }
});

// API Routes
app.post('/api/remove-bg', upload.single('image_file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }

    const filePath = req.file.path;

    try {
        // 1. Save Original Image to MongoDB
        const fileData = fs.readFileSync(filePath);

        const newImage = new Image({
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            data: fileData
        });

        // Generate URL without saving twice
        const protocol = req.protocol;
        const host = req.get('host');
        // If host is localhost, we rely on it. In production, use process.env.BASE_URL
        newImage.imageUrl = `${protocol}://${host}/api/images/${newImage._id}`;

        await newImage.save();
        console.log(`Image saved to MongoDB: ${newImage._id}`);
        console.log(`Image Link: ${newImage.imageUrl}`);

        // 2. Process with Remove.bg
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

        // Send JSON response with Image Link and Processed Image
        const processedBase64 = Buffer.from(response.data).toString('base64');
        const processedDataUrl = `data:image/png;base64,${processedBase64}`;

        res.json({
            success: true,
            imageUrl: newImage.imageUrl,
            processedImage: processedDataUrl
        });

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
