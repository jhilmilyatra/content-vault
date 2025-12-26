/**
 * ============================================
 * FileCloud VPS Storage Server
 * ============================================
 * 
 * A complete file storage server for VPS deployment.
 * This server handles file uploads, downloads, and management.
 * 
 * Features:
 * - File upload/download with streaming
 * - API key authentication
 * - Storage capacity tracking
 * - Health monitoring endpoint
 * - Automatic directory creation
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.STORAGE_PORT || 4000;
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const API_KEY = process.env.VPS_STORAGE_API_KEY || 'change-this-api-key';

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
}));

app.use(express.json({ limit: '500mb' }));

// API Key authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body.userId || 'anonymous';
    const userDir = path.join(STORAGE_PATH, userId);
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// ============================================
// Health Check Endpoint
// ============================================
app.get('/health', (req, res) => {
  const stats = getStorageStats();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    storage: stats,
    version: '1.0.0'
  });
});

// ============================================
// Storage Stats Endpoint
// ============================================
app.get('/stats', authenticate, (req, res) => {
  const stats = getStorageStats();
  res.json(stats);
});

// ============================================
// File Upload Endpoint (Multipart)
// ============================================
app.post('/upload', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.body.userId || 'anonymous';
    const filePath = `${userId}/${req.file.filename}`;
    
    res.json({
      success: true,
      path: filePath,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: `/files/${filePath}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// ============================================
// File Upload Endpoint (Base64 JSON)
// ============================================
app.post('/upload-base64', authenticate, (req, res) => {
  try {
    const { path: filePath, data, fileName, originalName, mimeType, userId } = req.body;
    
    if (!data || !filePath) {
      return res.status(400).json({ error: 'Missing data or path' });
    }

    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    
    // Ensure directory exists
    const fullPath = path.join(STORAGE_PATH, filePath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, buffer);

    res.json({
      success: true,
      path: filePath,
      fileName: fileName,
      originalName: originalName,
      size: buffer.length,
      mimeType: mimeType,
      url: `/files/${filePath}`
    });
  } catch (error) {
    console.error('Base64 upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// ============================================
// File Download/Serve Endpoint
// ============================================
app.get('/files/:userId/:fileName', (req, res) => {
  try {
    const { userId, fileName } = req.params;
    const filePath = path.join(STORAGE_PATH, userId, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed', message: error.message });
  }
});

// ============================================
// File Delete Endpoint
// ============================================
app.delete('/delete', authenticate, (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No path provided' });
    }

    const fullPath = path.join(STORAGE_PATH, filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed', message: error.message });
  }
});

// ============================================
// List User Files Endpoint
// ============================================
app.get('/list/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const userDir = path.join(STORAGE_PATH, userId);
    
    if (!fs.existsSync(userDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(userDir).map(file => {
      const filePath = path.join(userDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    });

    res.json({ files });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'List failed', message: error.message });
  }
});

// ============================================
// Storage Stats Helper Function
// ============================================
function getStorageStats() {
  try {
    let totalSize = 0;
    let fileCount = 0;

    function calcDirSize(dirPath) {
      if (!fs.existsSync(dirPath)) return;
      
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          calcDirSize(filePath);
        } else {
          totalSize += stats.size;
          fileCount++;
        }
      }
    }

    calcDirSize(STORAGE_PATH);

    // Get disk space (works on Linux)
    let totalDisk = 50 * 1024 * 1024 * 1024; // Default 50GB
    let freeDisk = totalDisk - totalSize;

    try {
      const { execSync } = require('child_process');
      const dfOutput = execSync(`df -B1 ${STORAGE_PATH}`).toString();
      const lines = dfOutput.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        totalDisk = parseInt(parts[1]) || totalDisk;
        freeDisk = parseInt(parts[3]) || freeDisk;
      }
    } catch (e) {
      // Ignore disk space check errors on non-Linux systems
    }

    return {
      totalBytes: totalDisk,
      usedBytes: totalSize,
      freeBytes: freeDisk,
      fileCount: fileCount,
      totalGB: (totalDisk / (1024 * 1024 * 1024)).toFixed(2),
      usedGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
      freeGB: (freeDisk / (1024 * 1024 * 1024)).toFixed(2),
      usagePercent: ((totalSize / totalDisk) * 100).toFixed(2)
    };
  } catch (error) {
    console.error('Stats error:', error);
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      fileCount: 0,
      error: error.message
    };
  }
}

// ============================================
// Start Server
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   FileCloud VPS Storage Server v1.0.0      ║
╠════════════════════════════════════════════╣
║   Status: Running                          ║
║   Port: ${PORT}                              ║
║   Storage: ${STORAGE_PATH.padEnd(30)}║
║   Auth: API Key Required                   ║
╚════════════════════════════════════════════╝
  `);
  
  const stats = getStorageStats();
  console.log(`📊 Storage Stats: ${stats.usedGB}GB used of ${stats.totalGB}GB (${stats.fileCount} files)`);
});

module.exports = app;
