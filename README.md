# FileVault - Cloud File Storage & Sharing Platform

A modern, self-hostable file storage and sharing platform built with React, TypeScript, and Supabase.

## Features

- 📁 **File Management** - Upload, organize, and manage files with folders
- 🔗 **Shareable Links** - Create password-protected or public share links
- 👥 **Role-Based Access** - Owner, Admin, and Member roles
- 📊 **Analytics Dashboard** - Track downloads, bandwidth, and storage usage
- 🗑️ **Trash & Recovery** - Soft delete with 30-day recovery
- 🔒 **Security** - Row-level security with Supabase
- 📱 **Telegram Integration** - Upload files via Telegram bot
- 💾 **Extendable Storage** - Connect additional VPS storage nodes

---

## 🚀 Quick Deployment Guide (For Beginners)

### Prerequisites

Before you start, make sure you have:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account (free tier works!)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/filevault.git
cd filevault
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Supabase

1. Go to [supabase.com](https://supabase.com/) and create a new project
2. Go to **Settings > API** and copy:
   - Project URL
   - Anon/Public Key
3. Create a `.env` file in the root folder:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

4. Run the SQL migrations in your Supabase SQL Editor (found in `supabase/migrations/` folder)

### Step 4: Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see your app!

---

## ☁️ Deploy to Vercel (Recommended for Beginners)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Go to [vercel.com](https://vercel.com/)** and sign in with GitHub

3. **Import your repository**
   - Click "New Project"
   - Select your repository
   - Vercel auto-detects it's a Vite project

4. **Add Environment Variables**
   - Click "Environment Variables"
   - Add:
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_PUBLISHABLE_KEY` = your Supabase anon key

5. **Click Deploy!** 🎉

Your app will be live at `https://your-project.vercel.app`

---

## 🚂 Deploy to Railway

1. **Go to [railway.app](https://railway.app/)** and sign in with GitHub

2. **Create New Project** → **Deploy from GitHub repo**

3. **Select your repository**

4. **Add Environment Variables** (Settings → Variables):
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```

5. **Add Build Command** (Settings → Build):
   ```
   npm run build
   ```

6. **Add Start Command**:
   ```
   npm run preview -- --host --port $PORT
   ```

7. **Deploy!** Railway will give you a public URL.

---

## 🖥️ Deploy to Your Own VPS (DigitalOcean, Linode, etc.)

### Option 1: Using PM2 (Recommended)

```bash
# SSH into your server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/your-username/filevault.git
cd filevault
npm install

# Create .env file
nano .env
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# Build for production
npm run build

# Install PM2
npm install -g pm2

# Serve the built app
npm install -g serve
pm2 start "serve -s dist -l 3000" --name filevault

# Make it start on reboot
pm2 startup
pm2 save
```

### Option 2: Using Docker

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:
```bash
docker build \
  --build-arg VITE_SUPABASE_URL=your_url \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=your_key \
  -t filevault .

docker run -d -p 80:80 filevault
```

---

## 💾 Storage Configuration

### Default: Supabase Storage
By default, files are stored in Supabase Storage. No extra configuration needed!

### Extend with VPS Storage (For Owners)

Owners can connect additional VPS storage nodes through the dashboard to extend storage capacity.

1. **Set up a storage server** on your VPS (see below)
2. Go to **Owner Dashboard → Storage Settings**
3. Add your VPS endpoint and API key
4. Files will automatically use the extended storage

#### VPS Storage Server Setup

Create a simple Node.js file server on your VPS:

```javascript
// storage-server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const API_KEY = process.env.VPS_API_KEY || 'your-secret-api-key';
const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_PATH),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// Upload endpoint
app.post('/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({
    success: true,
    filename: req.file.filename,
    path: req.file.path,
    url: `/files/${req.file.filename}`
  });
});

// Download endpoint
app.get('/files/:filename', (req, res) => {
  const filePath = path.join(STORAGE_PATH, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.resolve(filePath));
});

// Delete endpoint
app.delete('/files/:filename', authenticate, (req, res) => {
  const filePath = path.join(STORAGE_PATH, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3001, () => console.log('Storage server on port 3001'));
```

Run with PM2:
```bash
npm install express multer
VPS_API_KEY=your-secret-key pm2 start storage-server.js --name storage
```

---

## 🔧 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Your Supabase anon/public key |

### Supabase Edge Function Secrets (Set in Supabase Dashboard)

| Secret | Required | Description |
|--------|----------|-------------|
| `VPS_STORAGE_ENDPOINT` | ❌ | URL to your VPS storage server |
| `VPS_STORAGE_API_KEY` | ❌ | API key for VPS storage authentication |

---

## 📁 Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── lib/            # Utilities and services
│   └── integrations/   # Supabase client
├── supabase/
│   ├── functions/      # Edge functions
│   └── migrations/     # Database migrations
└── public/             # Static assets
```

---

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, storage management, user management, billing |
| **Admin** | User management, report handling, system monitoring |
| **Member** | File upload/download, sharing, personal dashboard |

---

## 🆘 Troubleshooting

### "Failed to connect to Supabase"
- Check your `.env` file has correct values
- Make sure there are no spaces around the `=` sign
- Restart your dev server after changing `.env`

### "CORS error"
- Add your deployment URL to Supabase Auth settings
- Go to Supabase → Authentication → URL Configuration
- Add your domain to "Site URL" and "Redirect URLs"

### "Storage permission denied"
- Check Supabase Storage policies
- Make sure RLS policies are set up correctly

---

## 📄 License

MIT License - feel free to use for personal or commercial projects!

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
