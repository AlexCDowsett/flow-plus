const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, downloadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// API endpoint to save JSON file
app.post('/api/save-layout', (req, res) => {
  try {
    const { filename, data } = req.body;
    
    if (!filename || !data) {
      return res.status(400).json({ error: 'Filename and data are required' });
    }

    const filePath = path.join(downloadsDir, filename);
    
    // Write the JSON data to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`📁 File saved: ${filePath}`);
    res.json({ 
      success: true, 
      message: `File saved to downloads folder: ${filename}`,
      path: filePath
    });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Downloads folder: ${downloadsDir}`);
});
