/**
 * ============================================
 * FileCloud VPS Storage Server v2.0.0
 * ============================================
 * 
 * A secure file storage server for VPS deployment.
 * Features path validation, user isolation, and owner access.
 * 
 * Features:
 * - File upload/download with streaming
 * - API key authentication
 * - Path traversal protection
 * - User-isolated file storage
 * - Owner access to all user files
 * - Storage capacity tracking
 * - Health monitoring endpoint
 * - Per-user usage statistics
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
const OWNER_API_KEY = process.env.VPS_OWNER_API_KEY || 'kARTOOS007';

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey', 'x-owner-access', 'x-target-user'],
}));

app.use(express.json({ limit: '500mb' }));

// ============================================
// Security: Path Validation Functions
// ============================================

/**
 * Validates UUID format for user IDs
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validates filename - no path separators or traversal
 */
function isValidFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;
  
  // Block path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  
  // Block hidden files and null bytes
  if (filename.startsWith('.') || filename.includes('\0')) {
    return false;
  }
  
  // Only allow alphanumeric, dash, underscore, dot, and UUID-like names
  const safeFilenameRegex = /^[a-zA-Z0-9._-]+$/;
  return safeFilenameRegex.test(filename) && filename.length <= 255;
}

/**
 * Safely constructs and validates a file path
 * Returns null if path is invalid or attempts traversal
 */
function getSafePath(userId, filename) {
  // Validate userId is a valid UUID
  if (!isValidUUID(userId)) {
    console.warn(`Invalid userId attempted: ${userId}`);
    return null;
  }
  
  // Validate filename
  if (!isValidFilename(filename)) {
    console.warn(`Invalid filename attempted: ${filename}`);
    return null;
  }
  
  // Construct path using only validated components
  const userDir = path.join(STORAGE_PATH, userId);
  const fullPath = path.join(userDir, filename);
  
  // Resolve to absolute and verify it's within STORAGE_PATH
  const resolvedPath = path.resolve(fullPath);
  const resolvedStorage = path.resolve(STORAGE_PATH);
  
  if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
    console.warn(`Path traversal attempt blocked: ${resolvedPath}`);
    return null;
  }
  
  return { userDir, fullPath: resolvedPath, filename };
}

// ============================================
// Authentication Middleware
// ============================================

/**
 * Standard API key authentication
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // Check if it's owner key
  if (token === OWNER_API_KEY) {
    req.isOwner = true;
    req.apiKeyType = 'owner';
    return next();
  }
  
  // Check standard API key
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  req.isOwner = false;
  req.apiKeyType = 'standard';
  next();
};

/**
 * Owner-only access middleware
 */
const requireOwner = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (token !== OWNER_API_KEY) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  
  req.isOwner = true;
  next();
};

// ============================================
// Multer Configuration with Validation
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body.userId;
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return cb(new Error('Invalid user ID format'), null);
    }
    
    const userDir = path.join(STORAGE_PATH, userId);
    
    // Verify path safety
    const resolvedDir = path.resolve(userDir);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    
    if (!resolvedDir.startsWith(resolvedStorage + path.sep)) {
      return cb(new Error('Invalid storage path'), null);
    }
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Generate safe unique filename
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9.]/gi, '');
    const uniqueName = `${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// ============================================
// Health Check Endpoint (Basic)
// ============================================
app.get('/health', (req, res) => {
  const stats = getStorageStats();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    storage: stats,
    version: '2.0.0'
  });
});

// ============================================
// Comprehensive Health Check with Endpoint Verification
// ============================================
app.get('/health/full', (req, res) => {
  const stats = getStorageStats();
  
  // Define all required endpoints and their methods
  const requiredEndpoints = [
    { path: '/health', method: 'GET', description: 'Basic health check' },
    { path: '/health/full', method: 'GET', description: 'Full health check with endpoint verification' },
    { path: '/stats', method: 'GET', description: 'Storage statistics' },
    { path: '/stats/user/:userId', method: 'GET', description: 'Per-user storage stats' },
    { path: '/stats/all-users', method: 'GET', description: 'All users storage overview' },
    { path: '/upload', method: 'POST', description: 'Multipart file upload' },
    { path: '/upload-base64', method: 'POST', description: 'Base64 JSON file upload' },
    { path: '/files/:userId/:fileName', method: 'GET', description: 'File download/serve with range support' },
    { path: '/files/:userId/:fileName', method: 'DELETE', description: 'File deletion' },
    { path: '/chunk-append', method: 'POST', description: 'Direct chunk append to file' },
    { path: '/chunk-upload', method: 'POST', description: 'Temporary chunk upload' },
    { path: '/finalize-upload', method: 'POST', description: 'Assemble chunks into final file' },
    { path: '/verify-file', method: 'POST', description: 'Verify file existence and size' },
    { path: '/cleanup-chunks', method: 'POST', description: 'Cleanup temporary chunk files' },
  ];
  
  // Get registered routes from Express
  const registeredRoutes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
      registeredRoutes.push({
        path: middleware.route.path,
        methods: methods
      });
    }
  });
  
  // Check each required endpoint
  const endpointStatus = requiredEndpoints.map(endpoint => {
    const found = registeredRoutes.find(r => 
      r.path === endpoint.path && r.methods.includes(endpoint.method)
    );
    return {
      ...endpoint,
      available: !!found,
      status: found ? 'ok' : 'missing'
    };
  });
  
  const availableCount = endpointStatus.filter(e => e.available).length;
  const missingEndpoints = endpointStatus.filter(e => !e.available);
  const allEndpointsAvailable = missingEndpoints.length === 0;
  
  res.json({
    status: allEndpointsAvailable ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    storage: stats,
    endpoints: {
      total: requiredEndpoints.length,
      available: availableCount,
      missing: missingEndpoints.length,
      allAvailable: allEndpointsAvailable,
      details: endpointStatus,
      missingList: missingEndpoints.map(e => `${e.method} ${e.path}`)
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
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
// Per-User Storage Stats (Owner Only)
// ============================================
app.get('/stats/user/:userId', requireOwner, (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    const userDir = path.join(STORAGE_PATH, userId);
    const resolvedDir = path.resolve(userDir);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    
    if (!resolvedDir.startsWith(resolvedStorage + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(userDir)) {
      return res.json({
        userId,
        totalBytes: 0,
        fileCount: 0,
        files: []
      });
    }
    
    let totalSize = 0;
    const files = fs.readdirSync(userDir).map(file => {
      const filePath = path.join(userDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        path: `${userId}/${file}`
      };
    });
    
    res.json({
      userId,
      totalBytes: totalSize,
      totalMB: (totalSize / (1024 * 1024)).toFixed(2),
      fileCount: files.length,
      files
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats', message: error.message });
  }
});

// ============================================
// All Users Storage Overview (Owner Only)
// ============================================
app.get('/stats/all-users', requireOwner, (req, res) => {
  try {
    const users = [];
    
    if (!fs.existsSync(STORAGE_PATH)) {
      return res.json({ users: [], totalUsers: 0, totalBytes: 0 });
    }
    
    const entries = fs.readdirSync(STORAGE_PATH);
    let grandTotal = 0;
    
    for (const entry of entries) {
      const userDir = path.join(STORAGE_PATH, entry);
      
      // Skip if not a valid UUID directory
      if (!isValidUUID(entry) || !fs.statSync(userDir).isDirectory()) {
        continue;
      }
      
      let userTotal = 0;
      let fileCount = 0;
      
      const files = fs.readdirSync(userDir);
      for (const file of files) {
        const filePath = path.join(userDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          userTotal += stats.size;
          fileCount++;
        }
      }
      
      grandTotal += userTotal;
      
      users.push({
        userId: entry,
        totalBytes: userTotal,
        totalMB: (userTotal / (1024 * 1024)).toFixed(2),
        fileCount
      });
    }
    
    // Sort by storage used (descending)
    users.sort((a, b) => b.totalBytes - a.totalBytes);
    
    res.json({
      users,
      totalUsers: users.length,
      totalBytes: grandTotal,
      totalGB: (grandTotal / (1024 * 1024 * 1024)).toFixed(2)
    });
  } catch (error) {
    console.error('All users stats error:', error);
    res.status(500).json({ error: 'Failed to get all users stats', message: error.message });
  }
});

// ============================================
// File Upload Endpoint (Multipart)
// ============================================
app.post('/upload', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.body.userId;
    
    if (!isValidUUID(userId)) {
      // Clean up uploaded file if validation fails
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
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
// File Upload Endpoint (Base64 JSON) - SECURED
// ============================================
app.post('/upload-base64', authenticate, (req, res) => {
  try {
    const { data, fileName, originalName, mimeType, userId } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Missing file data' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Generate safe filename (ignore any path in request)
    const ext = fileName ? path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/gi, '') : '';
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    
    // Get safe path
    const pathInfo = getSafePath(userId, safeFilename);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    
    // Ensure user directory exists
    if (!fs.existsSync(pathInfo.userDir)) {
      fs.mkdirSync(pathInfo.userDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(pathInfo.fullPath, buffer);

    const filePath = `${userId}/${safeFilename}`;
    
    res.json({
      success: true,
      path: filePath,
      fileName: safeFilename,
      originalName: originalName || fileName,
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
// File Download/Serve Endpoint with Range Support
// ============================================
app.get('/files/:userId/:fileName', (req, res) => {
  try {
    const { userId, fileName } = req.params;
    
    // Validate and get safe path
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (!fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(pathInfo.fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Handle range requests for video/audio streaming
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Validate range
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).json({ error: 'Range not satisfiable' });
        return;
      }

      const stream = fs.createReadStream(pathInfo.fullPath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      
      stream.pipe(res);
    } else {
      // Full file download with streaming
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      
      const stream = fs.createReadStream(pathInfo.fullPath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed', message: error.message });
  }
});

// ============================================
// File Delete Endpoint - SECURED
// ============================================
app.delete('/delete', authenticate, (req, res) => {
  try {
    const { userId, fileName } = req.body;
    
    if (!userId || !fileName) {
      return res.status(400).json({ error: 'Missing userId or fileName' });
    }
    
    // Validate and get safe path
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (fs.existsSync(pathInfo.fullPath)) {
      fs.unlinkSync(pathInfo.fullPath);
      console.log(`File deleted: ${pathInfo.fullPath}`);
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
    
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    const userDir = path.join(STORAGE_PATH, userId);
    const resolvedDir = path.resolve(userDir);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    
    if (!resolvedDir.startsWith(resolvedStorage + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(userDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(userDir).map(file => {
      const filePath = path.join(userDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: `${userId}/${file}`,
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
// Owner: Read/Download Any User's File
// ============================================
app.get('/owner/file/:userId/:fileName', requireOwner, (req, res) => {
  try {
    const { userId, fileName } = req.params;
    
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (!fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file stats
    const stats = fs.statSync(pathInfo.fullPath);
    
    res.json({
      userId,
      fileName,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      downloadUrl: `/files/${userId}/${fileName}`
    });
  } catch (error) {
    console.error('Owner file access error:', error);
    res.status(500).json({ error: 'Access failed', message: error.message });
  }
});

// ============================================
// Owner: Modify/Replace Any User's File
// ============================================
app.put('/owner/file/:userId/:fileName', requireOwner, (req, res) => {
  try {
    const { userId, fileName } = req.params;
    const { data, mimeType } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Missing file data' });
    }
    
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (!fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Decode base64 and write
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(pathInfo.fullPath, buffer);
    
    console.log(`Owner modified file: ${pathInfo.fullPath}`);

    res.json({
      success: true,
      userId,
      fileName,
      size: buffer.length,
      mimeType,
      message: 'File modified successfully'
    });
  } catch (error) {
    console.error('Owner file modify error:', error);
    res.status(500).json({ error: 'Modify failed', message: error.message });
  }
});

// ============================================
// Owner: Delete Any User's File
// ============================================
app.delete('/owner/file/:userId/:fileName', requireOwner, (req, res) => {
  try {
    const { userId, fileName } = req.params;
    
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (!fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(pathInfo.fullPath);
    console.log(`Owner deleted file: ${pathInfo.fullPath}`);

    res.json({
      success: true,
      userId,
      fileName,
      message: 'File deleted by owner'
    });
  } catch (error) {
    console.error('Owner file delete error:', error);
    res.status(500).json({ error: 'Delete failed', message: error.message });
  }
});

// ============================================
// Owner: List All Users' Files
// ============================================
app.get('/owner/files', requireOwner, (req, res) => {
  try {
    const allFiles = [];
    
    if (!fs.existsSync(STORAGE_PATH)) {
      return res.json({ files: [], totalCount: 0 });
    }
    
    const entries = fs.readdirSync(STORAGE_PATH);
    
    for (const userId of entries) {
      const userDir = path.join(STORAGE_PATH, userId);
      
      if (!isValidUUID(userId) || !fs.statSync(userDir).isDirectory()) {
        continue;
      }
      
      const files = fs.readdirSync(userDir);
      for (const file of files) {
        const filePath = path.join(userDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          allFiles.push({
            userId,
            fileName: file,
            path: `${userId}/${file}`,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }
    }
    
    // Sort by modified date (newest first)
    allFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json({
      files: allFiles,
      totalCount: allFiles.length
    });
  } catch (error) {
    console.error('Owner list all error:', error);
    res.status(500).json({ error: 'List failed', message: error.message });
  }
});

// ============================================
// Chunked Upload: Append chunk directly to file
// ============================================
app.post('/chunk-append', authenticate, (req, res) => {
  try {
    const { data, fileName, userId, chunkIndex, totalChunks, isFirstChunk, isLastChunk } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Missing chunk data' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    if (!fileName) {
      return res.status(400).json({ error: 'Missing file name' });
    }
    
    if (chunkIndex === undefined || chunkIndex === null) {
      return res.status(400).json({ error: 'Missing chunk index' });
    }
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Validate filename
    if (!isValidFilename(fileName)) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }
    
    // Get safe path
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    
    // Ensure user directory exists
    if (!fs.existsSync(pathInfo.userDir)) {
      fs.mkdirSync(pathInfo.userDir, { recursive: true });
    }

    // For first chunk, create/truncate the file
    // For subsequent chunks, append to existing file
    if (isFirstChunk || chunkIndex === 0) {
      fs.writeFileSync(pathInfo.fullPath, buffer);
      console.log(`📦 Chunk ${chunkIndex}/${totalChunks - 1} written (new file): ${fileName}`);
    } else {
      // Append to file
      fs.appendFileSync(pathInfo.fullPath, buffer);
      console.log(`📦 Chunk ${chunkIndex}/${totalChunks - 1} appended: ${fileName}`);
    }
    
    const filePath = `${userId}/${fileName}`;
    
    // Get current file size
    const stats = fs.statSync(pathInfo.fullPath);
    
    res.json({
      success: true,
      chunkIndex,
      totalChunks,
      currentSize: stats.size,
      path: filePath,
      fileName,
      isComplete: isLastChunk || (chunkIndex === totalChunks - 1),
      url: `/files/${filePath}`
    });
  } catch (error) {
    console.error('Chunk append error:', error);
    res.status(500).json({ error: 'Chunk append failed', message: error.message });
  }
});

// ============================================
// Chunked Upload: Verify file completeness
// ============================================
app.post('/verify-file', authenticate, (req, res) => {
  try {
    const { fileName, userId, expectedSize } = req.body;
    
    if (!userId || !fileName) {
      return res.status(400).json({ error: 'Missing userId or fileName' });
    }
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Get safe path
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (!fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'File not found', exists: false });
    }
    
    const stats = fs.statSync(pathInfo.fullPath);
    const isComplete = expectedSize ? stats.size === expectedSize : true;
    
    res.json({
      success: true,
      exists: true,
      fileName,
      size: stats.size,
      expectedSize,
      isComplete,
      path: `${userId}/${fileName}`,
      url: `/files/${userId}/${fileName}`
    });
  } catch (error) {
    console.error('Verify file error:', error);
    res.status(500).json({ error: 'Verify failed', message: error.message });
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
// Startup Self-Test Function
// ============================================
function runStartupSelfTest() {
  console.log('\n🔍 Running endpoint self-test...\n');
  
  // Define all required endpoints
  const requiredEndpoints = [
    { path: '/health', method: 'GET', description: 'Basic health check' },
    { path: '/health/full', method: 'GET', description: 'Full health check' },
    { path: '/stats', method: 'GET', description: 'Storage statistics' },
    { path: '/stats/user/:userId', method: 'GET', description: 'Per-user stats' },
    { path: '/stats/all-users', method: 'GET', description: 'All users overview' },
    { path: '/upload', method: 'POST', description: 'Multipart upload' },
    { path: '/upload-base64', method: 'POST', description: 'Base64 upload' },
    { path: '/files/:userId/:fileName', method: 'GET', description: 'File download' },
    { path: '/files/:userId/:fileName', method: 'DELETE', description: 'File deletion' },
    { path: '/chunk-append', method: 'POST', description: 'Direct chunk append' },
    { path: '/chunk-upload', method: 'POST', description: 'Temp chunk upload' },
    { path: '/finalize-upload', method: 'POST', description: 'Assemble chunks' },
    { path: '/verify-file', method: 'POST', description: 'Verify file' },
    { path: '/cleanup-chunks', method: 'POST', description: 'Cleanup chunks' },
  ];
  
  // Get registered routes from Express
  const registeredRoutes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
      registeredRoutes.push({
        path: middleware.route.path,
        methods: methods
      });
    }
  });
  
  let passCount = 0;
  let failCount = 0;
  
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  ENDPOINT                      │ METHOD │ STATUS │ DESC    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  
  requiredEndpoints.forEach(endpoint => {
    const found = registeredRoutes.find(r => 
      r.path === endpoint.path && r.methods.includes(endpoint.method)
    );
    const status = found ? '✅ OK' : '❌ MISSING';
    const statusColor = found ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    if (found) {
      passCount++;
    } else {
      failCount++;
    }
    
    const pathPadded = endpoint.path.padEnd(30);
    const methodPadded = endpoint.method.padEnd(6);
    console.log(`│ ${pathPadded} │ ${methodPadded} │ ${statusColor}${status}${reset} │`);
  });
  
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n📊 Self-Test Results: ${passCount}/${requiredEndpoints.length} endpoints registered`);
  
  if (failCount > 0) {
    console.log(`\x1b[33m⚠️  Warning: ${failCount} endpoints are missing!\x1b[0m`);
    console.log('   Missing endpoints may cause upload failures.');
  } else {
    console.log('\x1b[32m✅ All required endpoints are available!\x1b[0m');
  }
  
  return { passCount, failCount, total: requiredEndpoints.length };
}

// ============================================
// Start Server
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   FileCloud VPS Storage Server v2.0.0      ║
╠════════════════════════════════════════════╣
║   Status: Running                          ║
║   Port: ${PORT}                              ║
║   Storage: ${STORAGE_PATH.padEnd(30)}║
║   Auth: API Key + Owner Key                ║
║   Security: Path Validation Enabled        ║
╚════════════════════════════════════════════╝
  `);
  
  const stats = getStorageStats();
  console.log(`📊 Storage Stats: ${stats.usedGB}GB used of ${stats.totalGB}GB (${stats.fileCount} files)`);
  
  // Run startup self-test
  runStartupSelfTest();
  
  console.log('\n🚀 Server ready to accept connections!\n');
});

module.exports = app;
