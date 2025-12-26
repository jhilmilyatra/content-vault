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
By default, files are stored in Supabase Storage (Lovable Cloud). No extra configuration needed!

### Extend with VPS Storage (For Owners)

You can connect your own VPS as additional storage to extend capacity or have full control over file storage.

---

### 🔧 Complete VPS Storage Setup Guide

#### Step 1: Prepare Your VPS

SSH into your VPS server:
```bash
ssh root@46.38.232.46
```

Install Node.js if not already installed:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Step 2: Set Up the Storage Server

Create a directory for the storage server:
```bash
mkdir -p /opt/filevault-storage
cd /opt/filevault-storage
```

Copy the `vps-storage-server` folder from this repository or create the files:

**Create package.json:**
```bash
cat > package.json << 'EOF'
{
  "name": "filevault-storage-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  }
}
EOF
```

**Create server.js** (copy from `vps-storage-server/server.js` in this repo)

Install dependencies:
```bash
npm install
```

#### Step 3: Generate Your API Key

Create a secure random API key (this is like a password for your storage server):
```bash
# Generate a random 32-character API key
openssl rand -hex 16
```

This will output something like: `a1b2c3d4e5f6789012345678abcdef12`

**Save this key - you'll need it for both the VPS and the app configuration!**

#### Step 4: Start the Storage Server

Create a startup script:
```bash
cat > start.sh << 'EOF'
#!/bin/bash
export VPS_STORAGE_API_KEY="YOUR_API_KEY_HERE"
export STORAGE_PATH="/opt/filevault-storage/uploads"
export STORAGE_PORT=4000
node server.js
EOF

chmod +x start.sh
```

**Replace `YOUR_API_KEY_HERE` with the key you generated in Step 3.**

Using PM2 (Recommended for production):
```bash
npm install -g pm2

# Start with environment variables
VPS_STORAGE_API_KEY="your-api-key-here" \
STORAGE_PATH="/opt/filevault-storage/uploads" \
STORAGE_PORT=4000 \
pm2 start server.js --name filevault-storage

# Save to start on reboot
pm2 startup
pm2 save
```

#### Step 5: Open the Port

Make sure port 4000 is accessible:
```bash
# For UFW firewall
sudo ufw allow 4000

# For iptables
sudo iptables -A INPUT -p tcp --dport 4000 -j ACCEPT
```

#### Step 6: Test the Storage Server

From your local machine, test if the server is running:
```bash
curl http://46.38.232.46:4000/health
```

You should see a JSON response with `"status": "online"`

---

### 🔐 Configure Secrets in Lovable Cloud

Now you need to add these secrets to your Lovable project so the edge functions can connect to your VPS storage.

#### What You Need:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `VPS_STORAGE_ENDPOINT` | Full URL to your VPS storage server | `http://46.38.232.46:4000` |
| `VPS_STORAGE_API_KEY` | The API key you generated in Step 3 | `a1b2c3d4e5f6789012345678abcdef12` |

#### How to Add Secrets:

1. In Lovable, go to **Settings → Secrets**
2. Add `VPS_STORAGE_ENDPOINT` with value `http://46.38.232.46:4000`
3. Add `VPS_STORAGE_API_KEY` with the API key from Step 3

**Important:** The `VPS_STORAGE_API_KEY` must match EXACTLY what you set in your VPS server's environment variable.

---

### 📋 Quick Reference for Your Setup

Based on your VPS details:

| Setting | Your Value |
|---------|------------|
| VPS IP | `46.38.232.46` |
| Storage Port | `4000` |
| VPS_STORAGE_ENDPOINT | `http://46.38.232.46:4000` |
| VPS_STORAGE_API_KEY | *(generate your own secure key)* |

---

### 🔍 Troubleshooting VPS Storage

#### "Connection refused" error
- Make sure the storage server is running: `pm2 status`
- Check if port 4000 is open: `sudo netstat -tlnp | grep 4000`
- Verify firewall allows port 4000

#### "401 Unauthorized" error  
- The API key in Lovable secrets doesn't match the one on your VPS
- Double-check both values are exactly the same

#### "CORS error"
- The storage server includes CORS headers, but ensure your VPS isn't behind a reverse proxy that strips them

#### Storage server not starting
- Check logs: `pm2 logs filevault-storage`
- Ensure Node.js is installed: `node --version`
- Verify dependencies are installed: `npm install`

---

### 🐳 Docker Deployment (Alternative)

You can also run the storage server with Docker:

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  storage:
    build: .
    ports:
      - "4000:4000"
    environment:
      - VPS_STORAGE_API_KEY=your-api-key-here
      - STORAGE_PATH=/data
      - STORAGE_PORT=4000
    volumes:
      - ./uploads:/data
    restart: unless-stopped
EOF

docker-compose up -d
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
