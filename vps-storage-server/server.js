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
const HLS_SIGNING_SECRET = process.env.HLS_SIGNING_SECRET || process.env.VPS_STORAGE_API_KEY || 'default-signing-secret';
const ENABLE_SIGNED_URLS = process.env.ENABLE_SIGNED_URLS === 'true'; // Enable URL signing verification
const AUTO_TRANSCODE = process.env.AUTO_TRANSCODE !== 'false'; // Enable by default
const AUTO_RETRANSCODE_ON_STARTUP = process.env.AUTO_RETRANSCODE_ON_STARTUP === 'true'; // Scan & transcode existing videos on startup
const TRANSCODE_DELAY_MS = parseInt(process.env.TRANSCODE_DELAY_MS) || 30000; // Delay between transcodes to avoid CPU overload
const AUTO_THUMBNAIL_BACKFILL = process.env.AUTO_THUMBNAIL_BACKFILL === 'true'; // Scan & generate thumbnails for videos on startup

// Supabase callback configuration for thumbnail updates
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const VPS_CALLBACK_KEY = process.env.VPS_CALLBACK_KEY || 'vps-thumbnail-callback-secret';
const ENABLE_THUMBNAIL_CALLBACK = process.env.ENABLE_THUMBNAIL_CALLBACK !== 'false'; // Enable by default

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// ============================================
// Auto-Transcode: Multi-Quality HLS Conversion
// ============================================
const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

// Quality presets for adaptive bitrate streaming
const HLS_QUALITIES = [
  { name: '360p', height: 360, videoBitrate: '800k', audioBitrate: '64k', bandwidth: 900000 },
  { name: '480p', height: 480, videoBitrate: '1400k', audioBitrate: '96k', bandwidth: 1500000 },
  { name: '720p', height: 720, videoBitrate: '2800k', audioBitrate: '128k', bandwidth: 3000000 },
  { name: '1080p', height: 1080, videoBitrate: '5000k', audioBitrate: '192k', bandwidth: 5500000 },
];

/**
 * Generate master playlist for adaptive streaming
 */
function generateMasterPlaylist(hlsDir, availableQualities) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  
  for (const q of availableQualities) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${q.width}x${q.height},NAME="${q.name}"`);
    lines.push(`${q.name}/index.m3u8`);
  }
  
  const masterPath = path.join(hlsDir, 'index.m3u8');
  fs.writeFileSync(masterPath, lines.join('\n'));
  return masterPath;
}

/**
 * Get video resolution using ffprobe
 */
function getVideoResolution(filePath) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`;
    
    exec(cmd, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      const [width, height] = stdout.trim().split('x').map(Number);
      resolve({ width, height });
    });
  });
}

/**
 * Generate video thumbnail using FFmpeg
 * Creates thumbnails at optimal timestamp for best frame selection
 */
function generateVideoThumbnail(fullPath, outputDir, baseName) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    
    const thumbnailPath = path.join(outputDir, `${baseName}_thumb.jpg`);
    const posterPath = path.join(outputDir, `${baseName}_poster.jpg`);
    
    // Get video duration first
    const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullPath}"`;
    
    exec(durationCmd, (durationError, durationStdout) => {
      if (durationError) {
        console.warn('Could not get video duration, using 1s for thumbnail');
      }
      
      const duration = parseFloat(durationStdout) || 10;
      // Take thumbnail at 10% of video duration (usually past intro/black frames)
      const thumbnailTime = Math.min(Math.max(duration * 0.1, 1), 30);
      
      // Generate small thumbnail (for lists/grids) - 320px width
      const thumbCmd = `ffmpeg -ss ${thumbnailTime} -i "${fullPath}" -vframes 1 -q:v 2 -vf "scale=320:-1" "${thumbnailPath}" -y 2>&1`;
      
      exec(thumbCmd, { maxBuffer: 10 * 1024 * 1024 }, (thumbError) => {
        if (thumbError) {
          console.warn('Thumbnail generation failed:', thumbError.message);
        } else {
          console.log(`🖼️ Thumbnail generated: ${thumbnailPath}`);
        }
        
        // Generate larger poster (for preview modal) - 1280px width
        const posterCmd = `ffmpeg -ss ${thumbnailTime} -i "${fullPath}" -vframes 1 -q:v 2 -vf "scale=1280:-1" "${posterPath}" -y 2>&1`;
        
        exec(posterCmd, { maxBuffer: 10 * 1024 * 1024 }, (posterError) => {
          if (posterError) {
            console.warn('Poster generation failed:', posterError.message);
          } else {
            console.log(`🎬 Poster generated: ${posterPath}`);
          }
          
          // Return paths even if some failed
          resolve({
            thumbnail: fs.existsSync(thumbnailPath) ? thumbnailPath : null,
            poster: fs.existsSync(posterPath) ? posterPath : null,
            thumbnailUrl: fs.existsSync(thumbnailPath) ? `${baseName}_thumb.jpg` : null,
            posterUrl: fs.existsSync(posterPath) ? `${baseName}_poster.jpg` : null,
          });
        });
      });
    });
  });
}

/**
 * Generate animated GIF preview (for hover previews)
 */
function generateAnimatedPreview(fullPath, outputDir, baseName) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    
    const gifPath = path.join(outputDir, `${baseName}_preview.gif`);
    
    // Get duration
    const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullPath}"`;
    
    exec(durationCmd, (durationError, durationStdout) => {
      const duration = parseFloat(durationStdout) || 10;
      const startTime = Math.min(Math.max(duration * 0.1, 1), 30);
      
      // Generate 3-second GIF preview at 10fps, 320px width
      const gifCmd = `ffmpeg -ss ${startTime} -t 3 -i "${fullPath}" -vf "fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifPath}" -y 2>&1`;
      
      exec(gifCmd, { maxBuffer: 50 * 1024 * 1024 }, (gifError) => {
        if (gifError) {
          console.warn('GIF preview generation failed:', gifError.message);
          resolve({ gif: null, gifUrl: null });
        } else {
          console.log(`🎞️ Animated preview generated: ${gifPath}`);
          resolve({
            gif: gifPath,
            gifUrl: `${baseName}_preview.gif`,
          });
        }
      });
    });
  });
}

/**
 * Send thumbnail callback to Supabase to update file record
 */
async function sendThumbnailCallback(userId, fileName, thumbnailResult, animatedResult, qualities) {
  if (!ENABLE_THUMBNAIL_CALLBACK || !SUPABASE_URL) {
    console.log('📭 Thumbnail callback disabled or SUPABASE_URL not configured');
    return;
  }
  
  const storagePath = `${userId}/${fileName}`;
  
  const callbackUrl = `${SUPABASE_URL}/functions/v1/update-thumbnail`;
  
  const payload = {
    storagePath,
    thumbnailUrl: thumbnailResult?.thumbnailUrl || null,
    posterUrl: thumbnailResult?.posterUrl || null,
    animatedPreviewUrl: animatedResult?.gifUrl || null,
    qualities: qualities || [],
  };
  
  console.log(`📤 Sending thumbnail callback for ${storagePath}...`);
  
  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vps-callback-key': VPS_CALLBACK_KEY,
      },
      body: JSON.stringify(payload),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Thumbnail callback successful: ${result.thumbnails?.poster || result.thumbnails?.thumbnail || 'updated'}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Thumbnail callback failed (${response.status}): ${errorText}`);
    }
  } catch (error) {
    console.error(`❌ Thumbnail callback error:`, error.message);
  }
}

/**
 * Transcode to a specific quality
 */
function transcodeQuality(fullPath, hlsDir, quality, sourceResolution) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    
    const qualityDir = path.join(hlsDir, quality.name);
    if (!fs.existsSync(qualityDir)) {
      fs.mkdirSync(qualityDir, { recursive: true });
    }
    
    const segmentPath = path.join(qualityDir, 'segment_%03d.ts');
    const outputPlaylist = path.join(qualityDir, 'index.m3u8');
    
    // Calculate width maintaining aspect ratio
    const aspectRatio = sourceResolution.width / sourceResolution.height;
    const targetWidth = Math.round(quality.height * aspectRatio);
    // Ensure width is even for h264
    const width = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
    
    const ffmpegCmd = `ffmpeg -i "${fullPath}" \
      -c:v libx264 -preset fast -b:v ${quality.videoBitrate} \
      -vf "scale=${width}:${quality.height}" \
      -c:a aac -b:a ${quality.audioBitrate} \
      -hls_time 4 \
      -hls_playlist_type vod \
      -hls_segment_filename "${segmentPath}" \
      "${outputPlaylist}" 2>&1`;
    
    exec(ffmpegCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject({ quality: quality.name, error: error.message, output: stdout || stderr });
      } else {
        resolve({ 
          name: quality.name, 
          height: quality.height, 
          width,
          bandwidth: quality.bandwidth,
          playlist: outputPlaylist 
        });
      }
    });
  });
}

function triggerAutoTranscode(userId, fileName, fullPath) {
  if (!AUTO_TRANSCODE) return;
  
  const ext = path.extname(fileName).toLowerCase();
  if (!videoExtensions.includes(ext)) return;
  
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
  const masterPlaylist = path.join(hlsDir, 'index.m3u8');
  const lockFile = path.join(hlsDir, '.transcoding');
  
  // Skip if already exists or in progress
  if (fs.existsSync(masterPlaylist) || fs.existsSync(lockFile)) {
    console.log(`⏭️ HLS already exists or in progress: ${fileName}`);
    return;
  }
  
  // Create HLS directory
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }
  
  // Create lock file with progress info
  fs.writeFileSync(lockFile, JSON.stringify({ 
    started: new Date().toISOString(),
    status: 'analyzing',
    progress: 0
  }));
  
  console.log(`🎬 Multi-quality transcode started for: ${userId}/${fileName}`);
  
  // Async transcoding pipeline
  (async () => {
    try {
      // Get source video resolution
      const sourceRes = await getVideoResolution(fullPath);
      console.log(`📐 Source resolution: ${sourceRes.width}x${sourceRes.height}`);
      
      // Generate thumbnails first (fast operation)
      console.log(`🖼️ Generating thumbnails...`);
      fs.writeFileSync(lockFile, JSON.stringify({ 
        started: new Date().toISOString(),
        status: 'generating_thumbnails',
        progress: 5
      }));
      
      const thumbnailResult = await generateVideoThumbnail(fullPath, hlsDir, baseName);
      console.log(`✅ Thumbnails generated:`, thumbnailResult.thumbnailUrl ? 'success' : 'failed');
      
      // Generate animated preview (optional, can be slow)
      let animatedResult = { gif: null, gifUrl: null };
      try {
        animatedResult = await generateAnimatedPreview(fullPath, hlsDir, baseName);
      } catch (e) {
        console.warn('Animated preview generation skipped:', e.message);
      }
      
      // Filter qualities that don't exceed source resolution
      const applicableQualities = HLS_QUALITIES.filter(q => q.height <= sourceRes.height);
      
      if (applicableQualities.length === 0) {
        // Source is smaller than 360p, just use source resolution
        applicableQualities.push({
          name: 'source',
          height: sourceRes.height,
          videoBitrate: '1000k',
          audioBitrate: '128k',
          bandwidth: 1200000
        });
      }
      
      console.log(`🎯 Transcoding to: ${applicableQualities.map(q => q.name).join(', ')}`);
      
      // Update lock file
      fs.writeFileSync(lockFile, JSON.stringify({ 
        started: new Date().toISOString(),
        status: 'transcoding',
        qualities: applicableQualities.map(q => q.name),
        thumbnails: thumbnailResult,
        progress: 10
      }));
      
      // Transcode each quality sequentially (to avoid overwhelming CPU)
      const completedQualities = [];
      for (let i = 0; i < applicableQualities.length; i++) {
        const quality = applicableQualities[i];
        console.log(`⏳ Transcoding ${quality.name} (${i + 1}/${applicableQualities.length})...`);
        
        try {
          const result = await transcodeQuality(fullPath, hlsDir, quality, sourceRes);
          completedQualities.push(result);
          
          // Update progress (10-100%, with 10% reserved for thumbnails)
          const progress = 10 + Math.round(((i + 1) / applicableQualities.length) * 90);
          fs.writeFileSync(lockFile, JSON.stringify({ 
            started: new Date().toISOString(),
            status: 'transcoding',
            qualities: applicableQualities.map(q => q.name),
            completed: completedQualities.map(q => q.name),
            thumbnails: thumbnailResult,
            progress
          }));
          
          console.log(`✅ ${quality.name} complete`);
        } catch (err) {
          console.error(`⚠️ Failed to transcode ${quality.name}:`, err.error);
          // Continue with other qualities
        }
      }
      
      if (completedQualities.length === 0) {
        throw new Error('All quality transcodes failed');
      }
      
      // Generate master playlist
      generateMasterPlaylist(hlsDir, completedQualities);
      console.log(`📝 Master playlist created with ${completedQualities.length} qualities`);
      
      // Remove lock file and create success marker
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
      
      const successMarker = path.join(hlsDir, '.complete');
      const qualitiesData = completedQualities.map(q => ({ name: q.name, resolution: `${q.width}x${q.height}` }));
      fs.writeFileSync(successMarker, JSON.stringify({
        completed: new Date().toISOString(),
        qualities: qualitiesData,
        sourceResolution: `${sourceRes.width}x${sourceRes.height}`,
        thumbnails: {
          thumbnail: thumbnailResult.thumbnailUrl,
          poster: thumbnailResult.posterUrl,
          animatedPreview: animatedResult.gifUrl,
        }
      }));
      
      console.log(`🎉 Multi-quality transcode complete: ${userId}/${baseName}`);
      
      // Send callback to update database with thumbnail URLs
      await sendThumbnailCallback(userId, fileName, thumbnailResult, animatedResult, qualitiesData);
      
    } catch (error) {
      console.error(`❌ Multi-quality transcode failed for ${fileName}:`, error.message || error);
      
      // Remove lock file
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
        }
      } catch (e) {
        console.error('Failed to remove lock file:', e);
      }
      
      // Write error log
      const errorLog = path.join(hlsDir, 'error.log');
      fs.writeFileSync(errorLog, `Error: ${error.message || error}\n\nTimestamp: ${new Date().toISOString()}`);
    }
  })();
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
 * Extract token from Authorization header OR query param
 * Supports: Bearer header, ?token= query param
 */
function extractToken(req) {
  // First try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  
  // Fallback to query param (for browser-compatible direct URLs)
  if (req.query.token) {
    return req.query.token;
  }
  
  return null;
}

/**
 * Standard API key authentication
 * Accepts token via Bearer header OR ?token= query param
 */
const authenticate = (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  
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
 * Accepts token via Bearer header OR ?token= query param
 */
const requireOwner = (req, res, next) => {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  
  if (token !== OWNER_API_KEY) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  
  req.isOwner = true;
  next();
};

// Aliases for middleware (backwards compatibility)
const authenticateOwner = requireOwner;
const authenticateRequest = authenticate;

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
    
    // Trigger auto-transcode for video files
    triggerAutoTranscode(userId, req.file.filename, req.file.path);
    
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
    
    // Trigger auto-transcode for video files
    triggerAutoTranscode(userId, safeFilename, pathInfo.fullPath);
    
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
      // HLS formats
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // CDN-optimized cache headers
    // Videos/media: 7 days cache with immutable (content-addressed filenames)
    // Static assets: 1 year cache
    // Dynamic: 1 hour cache
    const isMedia = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext);
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'].includes(ext);
    const isHLSSegment = ext === '.ts';
    const isHLSPlaylist = ext === '.m3u8';
    
    let cacheControl;
    if (isHLSSegment) {
      cacheControl = 'public, max-age=86400, immutable'; // 24 hours, immutable
    } else if (isHLSPlaylist) {
      cacheControl = 'public, max-age=30, stale-while-revalidate=60';
    } else if (isMedia || isImage) {
      cacheControl = 'public, max-age=604800, stale-while-revalidate=86400'; // 7 days + 1 day stale
    } else {
      cacheControl = 'public, max-age=3600, stale-while-revalidate=300'; // 1 hour + 5 min stale
    }
    
    // Generate ETag for cache validation
    const etag = `"${stat.size}-${stat.mtimeMs}"`;
    
    // Handle conditional GET (If-None-Match for cache validation)
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }
    
    // Common headers for CDN optimization
    const commonHeaders = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
      'Vary': 'Range, Accept-Encoding',
      // CORS headers for cross-origin access
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
      // Timing for CDN debugging
      'Timing-Allow-Origin': '*',
    };

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
        ...commonHeaders,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
      });
      
      stream.pipe(res);
    } else {
      // Full file download with streaming
      res.writeHead(200, {
        ...commonHeaders,
        'Content-Length': fileSize,
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
// HLS: Signature Verification Helper
// ============================================
function verifySignature(path, exp, sig) {
  if (!ENABLE_SIGNED_URLS) return true; // Skip if not enabled
  
  const now = Math.floor(Date.now() / 1000);
  
  // Check expiry
  if (exp && parseInt(exp) < now) {
    console.warn(`URL expired: ${path}`);
    return false;
  }
  
  // Verify HMAC signature
  if (sig) {
    const dataToSign = `${path}${exp}`;
    const expectedSig = crypto
      .createHmac('sha256', HLS_SIGNING_SECRET)
      .update(dataToSign)
      .digest('hex');
    
    if (sig !== expectedSig) {
      console.warn(`Invalid signature for: ${path}`);
      return false;
    }
  } else if (ENABLE_SIGNED_URLS) {
    console.warn(`Missing signature for: ${path}`);
    return false;
  }
  
  return true;
}

// ============================================
// HLS: Serve HLS playlist and segments
// Production-ready with CDN-optimized headers
// ============================================
app.get('/hls/:userId/:videoName/:file', (req, res) => {
  try {
    const { userId, videoName, file } = req.params;
    const { exp, sig } = req.query;
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Validate file is HLS file (.m3u8 or .ts)
    const ext = path.extname(file).toLowerCase();
    if (ext !== '.m3u8' && ext !== '.ts') {
      return res.status(400).json({ error: 'Invalid HLS file type' });
    }
    
    // Verify signed URL if enabled
    const requestPath = `/hls/${userId}/${videoName}/index.m3u8`;
    if (!verifySignature(requestPath, exp, sig)) {
      return res.status(403).json({ error: 'Invalid or expired URL signature' });
    }
    
    // Construct path: storage/userId/hls/videoName/file
    const hlsDir = path.join(STORAGE_PATH, userId, 'hls', videoName);
    const filePath = path.join(hlsDir, file);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'HLS file not found' });
    }
    
    const stat = fs.statSync(filePath);
    
    // Content-Type per HLS spec
    const contentType = ext === '.m3u8' 
      ? 'application/vnd.apple.mpegurl' 
      : 'video/mp2t';
    
    // CDN-optimized cache headers per best practices
    // - .ts segments: Immutable, cache for 24 hours (they never change)
    // - .m3u8 playlists: Short cache for VOD (30s), allow stale revalidation
    const cacheControl = ext === '.ts' 
      ? 'public, max-age=86400, immutable'
      : 'public, max-age=30, stale-while-revalidate=60';
    
    // Production-grade response headers
    const headers = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      // CORS headers for cross-origin playback
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      // Timing headers for debugging
      'Timing-Allow-Origin': '*',
      // ETag for conditional requests
      'ETag': `"${stat.size}-${stat.mtimeMs}"`,
      // Last-Modified for cache validation
      'Last-Modified': stat.mtime.toUTCString(),
    };
    
    // Handle conditional GET (If-None-Match)
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === headers['ETag']) {
      return res.status(304).end();
    }
    
    res.writeHead(200, headers);
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('HLS serve error:', error);
    res.status(500).json({ error: 'HLS serve failed', message: error.message });
  }
});

// ============================================
// HLS: Serve video thumbnails and previews
// ============================================
app.get('/hls/:userId/:videoName/:asset', (req, res, next) => {
  try {
    const { userId, videoName, asset } = req.params;
    
    // Only handle thumbnail/preview assets, pass through to other routes for HLS files
    const validAssets = ['_thumb.jpg', '_poster.jpg', '_preview.gif'];
    const isAsset = validAssets.some(suffix => asset.endsWith(suffix));
    
    if (!isAsset) {
      // Pass to next route handler (HLS files)
      return next();
    }
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Construct path: storage/userId/hls/videoName/asset
    const assetPath = path.join(STORAGE_PATH, userId, 'hls', videoName, asset);
    
    // Security check
    const resolvedPath = path.resolve(assetPath);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(assetPath)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    
    const stat = fs.statSync(assetPath);
    
    // Determine content type
    const ext = path.extname(asset).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Long cache for thumbnails (they're regenerated with new filename if changed)
    const headers = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=604800, immutable', // 7 days
      'Access-Control-Allow-Origin': '*',
      'ETag': `"${stat.size}-${stat.mtimeMs}"`,
      'Last-Modified': stat.mtime.toUTCString(),
    };
    
    // Handle conditional GET
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === headers['ETag']) {
      return res.status(304).end();
    }
    
    res.writeHead(200, headers);
    
    const stream = fs.createReadStream(assetPath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Thumbnail serve error:', error);
    res.status(500).json({ error: 'Thumbnail serve failed', message: error.message });
  }
});

// ============================================
// HLS: Serve quality-specific variant playlists and segments
// ============================================
app.get('/hls/:userId/:videoName/:quality/:file', (req, res) => {
  try {
    const { userId, videoName, quality, file } = req.params;
    const { exp, sig } = req.query;
    
    // Validate userId
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Validate quality folder name
    const validQualities = ['360p', '480p', '720p', '1080p', 'source'];
    if (!validQualities.includes(quality)) {
      return res.status(400).json({ error: 'Invalid quality level' });
    }
    
    // Validate file is HLS file (.m3u8 or .ts)
    const ext = path.extname(file).toLowerCase();
    if (ext !== '.m3u8' && ext !== '.ts') {
      return res.status(400).json({ error: 'Invalid HLS file type' });
    }
    
    // Verify signed URL if enabled (check against master playlist path)
    const masterPath = `/hls/${userId}/${videoName}/${quality}/index.m3u8`;
    if (!verifySignature(masterPath, exp, sig)) {
      return res.status(403).json({ error: 'Invalid or expired URL signature' });
    }
    
    // Construct path: storage/userId/hls/videoName/quality/file
    const hlsDir = path.join(STORAGE_PATH, userId, 'hls', videoName, quality);
    const filePath = path.join(hlsDir, file);
    
    // Security check
    const resolvedPath = path.resolve(filePath);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'HLS file not found' });
    }
    
    const stat = fs.statSync(filePath);
    
    // Content-Type per HLS spec
    const contentType = ext === '.m3u8' 
      ? 'application/vnd.apple.mpegurl' 
      : 'video/mp2t';
    
    // CDN-optimized cache headers
    const cacheControl = ext === '.ts' 
      ? 'public, max-age=86400, immutable'
      : 'public, max-age=30, stale-while-revalidate=60';
    
    const headers = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Timing-Allow-Origin': '*',
      'ETag': `"${stat.size}-${stat.mtimeMs}"`,
      'Last-Modified': stat.mtime.toUTCString(),
    };
    
    // Handle conditional GET
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === headers['ETag']) {
      return res.status(304).end();
    }
    
    res.writeHead(200, headers);
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('HLS quality serve error:', error);
    res.status(500).json({ error: 'HLS serve failed', message: error.message });
  }
});

// ============================================
// HLS: Check if HLS version exists for a video
// ============================================
app.get('/hls-status/:userId/:fileName', authenticate, (req, res) => {
  try {
    const { userId, fileName } = req.params;
    
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Get video base name (without extension)
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
    const playlistPath = path.join(hlsDir, 'index.m3u8');
    
    // Security check
    const resolvedPath = path.resolve(playlistPath);
    const resolvedStorage = path.resolve(STORAGE_PATH);
    if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    const hasHLS = fs.existsSync(playlistPath);
    
    if (hasHLS) {
      // Get segment count
      const segments = fs.readdirSync(hlsDir).filter(f => f.endsWith('.ts'));
      
      res.json({
        hasHLS: true,
        playlistUrl: `/hls/${userId}/${baseName}/index.m3u8`,
        segmentCount: segments.length,
        baseName,
      });
    } else {
      res.json({
        hasHLS: false,
        baseName,
        message: 'No HLS version available. Use POST /transcode to create one.',
      });
    }
  } catch (error) {
    console.error('HLS status error:', error);
    res.status(500).json({ error: 'HLS status check failed', message: error.message });
  }
});

// ============================================
// HLS: Trigger FFmpeg transcoding (async)
// ============================================
app.post('/transcode', authenticate, async (req, res) => {
  try {
    const { userId, fileName, quality } = req.body;
    
    if (!userId || !fileName) {
      return res.status(400).json({ error: 'Missing userId or fileName' });
    }
    
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo || !fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'Source video not found' });
    }
    
    // Check if it's a video file
    const ext = path.extname(fileName).toLowerCase();
    const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    if (!videoExts.includes(ext)) {
      return res.status(400).json({ error: 'Not a video file' });
    }
    
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
    
    // Check if already transcoding or done
    const lockFile = path.join(hlsDir, '.transcoding');
    const playlistPath = path.join(hlsDir, 'index.m3u8');
    
    if (fs.existsSync(playlistPath)) {
      return res.json({
        status: 'complete',
        message: 'HLS version already exists',
        playlistUrl: `/hls/${userId}/${baseName}/index.m3u8`,
      });
    }
    
    if (fs.existsSync(lockFile)) {
      return res.json({
        status: 'in_progress',
        message: 'Transcoding is already in progress',
      });
    }
    
    // Create HLS directory
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
    
    // Create lock file
    fs.writeFileSync(lockFile, new Date().toISOString());
    
    // Respond immediately - transcoding happens in background
    res.json({
      status: 'started',
      message: 'Transcoding started. Check /hls-status for progress.',
      baseName,
    });
    
    // Background transcoding with FFmpeg
    const { exec } = require('child_process');
    
    // Determine quality preset
    const qualityPreset = quality || 'medium';
    const qualitySettings = {
      low: { resolution: '480', bitrate: '800k', audioBitrate: '96k' },
      medium: { resolution: '720', bitrate: '2000k', audioBitrate: '128k' },
      high: { resolution: '1080', bitrate: '5000k', audioBitrate: '192k' },
    };
    const q = qualitySettings[qualityPreset] || qualitySettings.medium;
    
    const segmentPath = path.join(hlsDir, 'segment_%03d.ts');
    const outputPlaylist = path.join(hlsDir, 'index.m3u8');
    
    // FFmpeg command for HLS generation
    const ffmpegCmd = `ffmpeg -i "${pathInfo.fullPath}" \
      -c:v libx264 -preset fast -crf 23 \
      -vf "scale=-2:${q.resolution}" \
      -c:a aac -b:a ${q.audioBitrate} \
      -hls_time 4 \
      -hls_playlist_type vod \
      -hls_segment_filename "${segmentPath}" \
      "${outputPlaylist}" 2>&1`;
    
    console.log(`🎬 Starting HLS transcode for ${userId}/${fileName} (${qualityPreset})`);
    
    exec(ffmpegCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Remove lock file
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
        }
      } catch (e) {
        console.error('Failed to remove lock file:', e);
      }
      
      if (error) {
        console.error(`❌ FFmpeg error for ${fileName}:`, error.message);
        // Write error log
        const errorLog = path.join(hlsDir, 'error.log');
        fs.writeFileSync(errorLog, `Error: ${error.message}\n\nOutput:\n${stdout || stderr}`);
      } else {
        console.log(`✅ HLS transcode complete: ${userId}/${baseName}`);
        // Write success marker
        const successMarker = path.join(hlsDir, '.complete');
        fs.writeFileSync(successMarker, new Date().toISOString());
      }
    });
    
  } catch (error) {
    console.error('Transcode error:', error);
    res.status(500).json({ error: 'Transcode failed', message: error.message });
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
    
    const isComplete = isLastChunk || (chunkIndex === totalChunks - 1);
    
    // Trigger auto-transcode when chunked upload completes
    if (isComplete) {
      triggerAutoTranscode(userId, fileName, pathInfo.fullPath);
    }
    
    res.json({
      success: true,
      chunkIndex,
      totalChunks,
      currentSize: stats.size,
      path: filePath,
      fileName,
      isComplete,
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
// Manual Re-Transcode Endpoint
// ============================================
app.post('/transcode', authenticate, (req, res) => {
  try {
    const { userId, fileName, force } = req.body;
    
    if (!userId || !fileName) {
      return res.status(400).json({ error: 'Missing userId or fileName' });
    }
    
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    if (!isValidFilename(fileName)) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }
    
    const ext = path.extname(fileName).toLowerCase();
    if (!videoExtensions.includes(ext)) {
      return res.status(400).json({ error: 'File is not a video' });
    }
    
    const pathInfo = getSafePath(userId, fileName);
    if (!pathInfo) {
      return res.status(400).json({ error: 'Invalid path parameters' });
    }
    
    if (!fs.existsSync(pathInfo.fullPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }
    
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
    const masterPlaylist = path.join(hlsDir, 'index.m3u8');
    const lockFile = path.join(hlsDir, '.transcoding');
    
    // Check if already transcoding
    if (fs.existsSync(lockFile)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
        return res.status(409).json({ 
          error: 'Transcoding already in progress',
          status: lockData
        });
      } catch {
        return res.status(409).json({ error: 'Transcoding already in progress' });
      }
    }
    
    // Check if already exists (unless force=true)
    if (fs.existsSync(masterPlaylist) && !force) {
      return res.status(200).json({ 
        message: 'HLS already exists',
        hlsPath: `/hls/${userId}/${baseName}/index.m3u8`,
        force: 'Set force=true to re-transcode'
      });
    }
    
    // If forcing re-transcode, delete existing HLS files
    if (force && fs.existsSync(hlsDir)) {
      fs.rmSync(hlsDir, { recursive: true, force: true });
      console.log(`🗑️ Deleted existing HLS: ${userId}/${baseName}`);
    }
    
    // Trigger transcoding
    triggerAutoTranscode(userId, fileName, pathInfo.fullPath);
    
    res.json({
      success: true,
      message: 'Transcoding started',
      fileName,
      hlsPath: `/hls/${userId}/${baseName}/index.m3u8`,
      statusPath: `/transcode-status/${userId}/${baseName}`
    });
  } catch (error) {
    console.error('Transcode trigger error:', error);
    res.status(500).json({ error: 'Failed to start transcoding', message: error.message });
  }
});

// ============================================
// Transcode Status Endpoint
// ============================================
app.get('/transcode-status/:userId/:baseName', authenticate, (req, res) => {
  try {
    const { userId, baseName } = req.params;
    
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
    const masterPlaylist = path.join(hlsDir, 'index.m3u8');
    const lockFile = path.join(hlsDir, '.transcoding');
    const completeMarker = path.join(hlsDir, '.complete');
    const errorLog = path.join(hlsDir, 'error.log');
    
    // Check if transcoding is in progress
    if (fs.existsSync(lockFile)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
        return res.json({
          status: 'transcoding',
          ...lockData
        });
      } catch {
        return res.json({ status: 'transcoding' });
      }
    }
    
    // Check if complete
    if (fs.existsSync(completeMarker)) {
      try {
        const completeData = JSON.parse(fs.readFileSync(completeMarker, 'utf-8'));
        return res.json({
          status: 'complete',
          hlsPath: `/hls/${userId}/${baseName}/index.m3u8`,
          ...completeData
        });
      } catch {
        return res.json({
          status: 'complete',
          hlsPath: `/hls/${userId}/${baseName}/index.m3u8`
        });
      }
    }
    
    // Check if error
    if (fs.existsSync(errorLog)) {
      const errorContent = fs.readFileSync(errorLog, 'utf-8');
      return res.json({
        status: 'error',
        error: errorContent.substring(0, 500)
      });
    }
    
    // Not started
    res.json({ status: 'not_started' });
  } catch (error) {
    console.error('Transcode status error:', error);
    res.status(500).json({ error: 'Failed to get status', message: error.message });
  }
});

// ============================================
// Batch Transcode Endpoint (Owner Only)
// ============================================
app.post('/transcode-all', requireOwner, (req, res) => {
  try {
    const { userId, force } = req.body;
    
    let usersToProcess = [];
    
    if (userId) {
      if (!isValidUUID(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      usersToProcess = [userId];
    } else {
      // Get all user directories
      if (fs.existsSync(STORAGE_PATH)) {
        usersToProcess = fs.readdirSync(STORAGE_PATH)
          .filter(entry => isValidUUID(entry) && fs.statSync(path.join(STORAGE_PATH, entry)).isDirectory());
      }
    }
    
    const results = [];
    
    for (const uid of usersToProcess) {
      const userDir = path.join(STORAGE_PATH, uid);
      if (!fs.existsSync(userDir)) continue;
      
      const files = fs.readdirSync(userDir);
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!videoExtensions.includes(ext)) continue;
        
        const baseName = file.replace(/\.[^.]+$/, '');
        const hlsDir = path.join(STORAGE_PATH, uid, 'hls', baseName);
        const masterPlaylist = path.join(hlsDir, 'index.m3u8');
        const lockFile = path.join(hlsDir, '.transcoding');
        
        // Skip if already in progress
        if (fs.existsSync(lockFile)) {
          results.push({ userId: uid, fileName: file, status: 'already_transcoding' });
          continue;
        }
        
        // Skip if already exists (unless force)
        if (fs.existsSync(masterPlaylist) && !force) {
          results.push({ userId: uid, fileName: file, status: 'already_exists' });
          continue;
        }
        
        // Delete existing if forcing
        if (force && fs.existsSync(hlsDir)) {
          fs.rmSync(hlsDir, { recursive: true, force: true });
        }
        
        // Trigger transcode
        const fullPath = path.join(userDir, file);
        triggerAutoTranscode(uid, file, fullPath);
        results.push({ userId: uid, fileName: file, status: 'started' });
      }
    }
    
    const started = results.filter(r => r.status === 'started').length;
    const skipped = results.filter(r => r.status !== 'started').length;
    
    res.json({
      success: true,
      message: `Started transcoding ${started} videos, skipped ${skipped}`,
      started,
      skipped,
      results
    });
  } catch (error) {
    console.error('Batch transcode error:', error);
    res.status(500).json({ error: 'Batch transcode failed', message: error.message });
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
// Auto Re-Transcode: Scan existing videos on startup
// ============================================
async function scanAndTranscodeExistingVideos() {
  if (!AUTO_RETRANSCODE_ON_STARTUP) {
    console.log('⏭️ Auto re-transcode on startup is disabled');
    return { queued: 0, skipped: 0 };
  }
  
  console.log('\n🔍 Scanning for videos without HLS versions...\n');
  
  const videosToTranscode = [];
  
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      return { queued: 0, skipped: 0 };
    }
    
    const userDirs = fs.readdirSync(STORAGE_PATH)
      .filter(entry => isValidUUID(entry) && fs.statSync(path.join(STORAGE_PATH, entry)).isDirectory());
    
    for (const userId of userDirs) {
      const userDir = path.join(STORAGE_PATH, userId);
      const files = fs.readdirSync(userDir);
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!videoExtensions.includes(ext)) continue;
        
        const baseName = file.replace(/\.[^.]+$/, '');
        const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
        const masterPlaylist = path.join(hlsDir, 'index.m3u8');
        const lockFile = path.join(hlsDir, '.transcoding');
        
        // Skip if already exists or in progress
        if (fs.existsSync(masterPlaylist) || fs.existsSync(lockFile)) {
          continue;
        }
        
        videosToTranscode.push({
          userId,
          fileName: file,
          fullPath: path.join(userDir, file)
        });
      }
    }
    
    if (videosToTranscode.length === 0) {
      console.log('✅ All videos already have HLS versions');
      return { queued: 0, skipped: 0 };
    }
    
    console.log(`📹 Found ${videosToTranscode.length} videos without HLS. Starting background transcode...\n`);
    
    // Process videos sequentially with delay to avoid CPU overload
    (async () => {
      for (let i = 0; i < videosToTranscode.length; i++) {
        const video = videosToTranscode[i];
        console.log(`🎬 [${i + 1}/${videosToTranscode.length}] Queuing: ${video.userId}/${video.fileName}`);
        
        triggerAutoTranscode(video.userId, video.fileName, video.fullPath);
        
        // Wait before starting next transcode (to not overload CPU)
        if (i < videosToTranscode.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TRANSCODE_DELAY_MS));
        }
      }
      console.log(`\n✅ Finished queuing ${videosToTranscode.length} videos for HLS transcoding`);
    })();
    
    return { queued: videosToTranscode.length, skipped: 0 };
  } catch (error) {
    console.error('Error scanning for videos:', error);
    return { queued: 0, skipped: 0, error: error.message };
  }
}

// ============================================
// Thumbnail Backfill: Generate thumbnails for videos missing them
// ============================================
async function scanAndGenerateMissingThumbnails(sendCallbacks = true) {
  console.log('\n🖼️ Scanning for videos with missing thumbnails...\n');
  
  const videosToProcess = [];
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      return { processed: 0, skipped: 0, errors: 0 };
    }
    
    const userDirs = fs.readdirSync(STORAGE_PATH)
      .filter(entry => isValidUUID(entry) && fs.statSync(path.join(STORAGE_PATH, entry)).isDirectory());
    
    for (const userId of userDirs) {
      const userDir = path.join(STORAGE_PATH, userId);
      const files = fs.readdirSync(userDir);
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!videoExtensions.includes(ext)) continue;
        
        const baseName = file.replace(/\.[^.]+$/, '');
        const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
        
        // Check if thumbnail already exists
        const thumbnailPath = path.join(hlsDir, `${baseName}_thumb.jpg`);
        const posterPath = path.join(hlsDir, `${baseName}_poster.jpg`);
        
        // Skip if both thumbnail and poster exist
        if (fs.existsSync(thumbnailPath) && fs.existsSync(posterPath)) {
          skippedCount++;
          continue;
        }
        
        // Check if video file exists
        const fullPath = path.join(userDir, file);
        if (!fs.existsSync(fullPath)) {
          continue;
        }
        
        videosToProcess.push({
          userId,
          fileName: file,
          baseName,
          fullPath,
          hlsDir
        });
      }
    }
    
    if (videosToProcess.length === 0) {
      console.log('✅ All videos already have thumbnails');
      return { processed: 0, skipped: skippedCount, errors: 0 };
    }
    
    console.log(`📹 Found ${videosToProcess.length} videos without thumbnails. Processing...\n`);
    
    // Process videos sequentially
    for (let i = 0; i < videosToProcess.length; i++) {
      const video = videosToProcess[i];
      console.log(`🖼️ [${i + 1}/${videosToProcess.length}] Generating thumbnails: ${video.userId}/${video.fileName}`);
      
      try {
        // Ensure HLS directory exists
        if (!fs.existsSync(video.hlsDir)) {
          fs.mkdirSync(video.hlsDir, { recursive: true });
        }
        
        // Generate thumbnails
        const thumbnailResult = await generateVideoThumbnail(video.fullPath, video.hlsDir, video.baseName);
        
        // Generate animated preview
        let animatedResult = { gif: null, gifUrl: null };
        try {
          animatedResult = await generateAnimatedPreview(video.fullPath, video.hlsDir, video.baseName);
        } catch (e) {
          console.warn(`⚠️ Animated preview failed for ${video.fileName}: ${e.message}`);
        }
        
        // Send callback to update database
        if (sendCallbacks && (thumbnailResult.thumbnailUrl || thumbnailResult.posterUrl)) {
          await sendThumbnailCallback(video.userId, video.fileName, thumbnailResult, animatedResult, []);
        }
        
        processedCount++;
        console.log(`✅ Thumbnails generated for ${video.fileName}`);
        
        // Small delay between files to avoid overwhelming system
        if (i < videosToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Failed to generate thumbnails for ${video.fileName}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Thumbnail backfill complete: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`);
    return { processed: processedCount, skipped: skippedCount, errors: errorCount };
    
  } catch (error) {
    console.error('Error scanning for videos:', error);
    return { processed: processedCount, skipped: skippedCount, errors: errorCount + 1, error: error.message };
  }
}

// Endpoint to trigger thumbnail backfill (owner only)
app.post('/backfill-thumbnails', authenticateOwner, async (req, res) => {
  try {
    const { sendCallbacks = true } = req.body || {};
    
    console.log('🖼️ Thumbnail backfill triggered via API');
    
    // Run async, return immediately
    const result = await scanAndGenerateMissingThumbnails(sendCallbacks);
    
    res.json({
      success: true,
      message: 'Thumbnail backfill complete',
      ...result
    });
  } catch (error) {
    console.error('Thumbnail backfill error:', error);
    res.status(500).json({ error: 'Thumbnail backfill failed', details: error.message });
  }
});

// Endpoint to check thumbnail status for a specific video
app.get('/thumbnail-status/:userId/:fileName', authenticateRequest, (req, res) => {
  const { userId, fileName } = req.params;
  
  // Validate inputs
  if (!isValidUUID(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  if (!isValidFilename(fileName)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
  
  const thumbnailPath = path.join(hlsDir, `${baseName}_thumb.jpg`);
  const posterPath = path.join(hlsDir, `${baseName}_poster.jpg`);
  const gifPath = path.join(hlsDir, `${baseName}_preview.gif`);
  const completeMarker = path.join(hlsDir, '.complete');
  
  const hasThumbnail = fs.existsSync(thumbnailPath);
  const hasPoster = fs.existsSync(posterPath);
  const hasGif = fs.existsSync(gifPath);
  const hasHls = fs.existsSync(completeMarker);
  
  // Get file sizes
  const thumbnailSize = hasThumbnail ? fs.statSync(thumbnailPath).size : 0;
  const posterSize = hasPoster ? fs.statSync(posterPath).size : 0;
  const gifSize = hasGif ? fs.statSync(gifPath).size : 0;
  
  res.json({
    fileName,
    baseName,
    hasHls,
    thumbnails: {
      thumbnail: hasThumbnail ? {
        exists: true,
        path: `/hls/${userId}/${baseName}/${baseName}_thumb.jpg`,
        size: thumbnailSize
      } : { exists: false },
      poster: hasPoster ? {
        exists: true,
        path: `/hls/${userId}/${baseName}/${baseName}_poster.jpg`,
        size: posterSize
      } : { exists: false },
      animatedPreview: hasGif ? {
        exists: true,
        path: `/hls/${userId}/${baseName}/${baseName}_preview.gif`,
        size: gifSize
      } : { exists: false }
    }
  });
});

// Endpoint to generate thumbnail for a specific video
app.post('/generate-thumbnail/:userId/:fileName', authenticateRequest, async (req, res) => {
  const { userId, fileName } = req.params;
  const { sendCallback = true } = req.body || {};
  
  // Validate inputs
  if (!isValidUUID(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  if (!isValidFilename(fileName)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const ext = path.extname(fileName).toLowerCase();
  if (!videoExtensions.includes(ext)) {
    return res.status(400).json({ error: 'Not a video file' });
  }
  
  const fullPath = path.join(STORAGE_PATH, userId, fileName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }
  
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const hlsDir = path.join(STORAGE_PATH, userId, 'hls', baseName);
  
  try {
    // Ensure HLS directory exists
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
    
    console.log(`🖼️ Generating thumbnails for: ${userId}/${fileName}`);
    
    // Generate thumbnails
    const thumbnailResult = await generateVideoThumbnail(fullPath, hlsDir, baseName);
    
    // Generate animated preview
    let animatedResult = { gif: null, gifUrl: null };
    try {
      animatedResult = await generateAnimatedPreview(fullPath, hlsDir, baseName);
    } catch (e) {
      console.warn(`⚠️ Animated preview failed: ${e.message}`);
    }
    
    // Send callback to update database if requested
    if (sendCallback && (thumbnailResult.thumbnailUrl || thumbnailResult.posterUrl)) {
      await sendThumbnailCallback(userId, fileName, thumbnailResult, animatedResult, []);
    }
    
    res.json({
      success: true,
      thumbnails: {
        thumbnail: thumbnailResult.thumbnailUrl ? `/hls/${userId}/${baseName}/${thumbnailResult.thumbnailUrl}` : null,
        poster: thumbnailResult.posterUrl ? `/hls/${userId}/${baseName}/${thumbnailResult.posterUrl}` : null,
        animatedPreview: animatedResult.gifUrl ? `/hls/${userId}/${baseName}/${animatedResult.gifUrl}` : null
      }
    });
  } catch (error) {
    console.error(`❌ Thumbnail generation failed for ${fileName}:`, error);
    res.status(500).json({ error: 'Thumbnail generation failed', details: error.message });
  }
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   FileCloud VPS Storage Server v2.2.0      ║
╠════════════════════════════════════════════╣
║   Status: Running                          ║
║   Port: ${PORT}                              ║
║   Storage: ${STORAGE_PATH.padEnd(30)}║
║   Auth: API Key + Owner Key                ║
║   Security: Path Validation Enabled        ║
║   HLS Auto-Transcode: ${AUTO_TRANSCODE ? 'Enabled' : 'Disabled'}               ║
║   Startup Re-Transcode: ${AUTO_RETRANSCODE_ON_STARTUP ? 'Enabled' : 'Disabled'}            ║
║   Thumbnail Backfill: ${AUTO_THUMBNAIL_BACKFILL ? 'Enabled' : 'Disabled'}              ║
║   Thumbnail Callbacks: ${ENABLE_THUMBNAIL_CALLBACK ? 'Enabled' : 'Disabled'}             ║
╚════════════════════════════════════════════╝
  `);
  
  const stats = getStorageStats();
  console.log(`📊 Storage Stats: ${stats.usedGB}GB used of ${stats.totalGB}GB (${stats.fileCount} files)`);
  
  // Run startup self-test
  runStartupSelfTest();
  
  // Scan and transcode existing videos without HLS
  scanAndTranscodeExistingVideos();
  
  // Scan and generate thumbnails for videos without them
  if (AUTO_THUMBNAIL_BACKFILL) {
    // Run thumbnail backfill after a delay to not compete with transcoding
    setTimeout(() => {
      console.log('\n🖼️ Starting automatic thumbnail backfill...');
      scanAndGenerateMissingThumbnails(ENABLE_THUMBNAIL_CALLBACK);
    }, 10000); // 10 second delay
  }
  
  console.log('\n🚀 Server ready to accept connections!\n');
});

module.exports = app;
