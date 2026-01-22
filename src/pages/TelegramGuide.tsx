import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Bot, Code, Key, Send, FolderOpen, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { FeatureDisabled } from "@/components/FeatureDisabled";

const TelegramGuide = () => {
  const telegramUploadEnabled = useFeatureFlag("feature_telegram_upload");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, section: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(section);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Check feature flag - show disabled state
  if (!telegramUploadEnabled) {
    return (
      <DashboardLayout>
        <FeatureDisabled 
          featureName="Telegram Uploads" 
          message="Telegram upload integration has been temporarily disabled by the administrator."
        />
      </DashboardLayout>
    );
  }

  const pythonBasicBotCode = `import os
import base64
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Configuration
API_KEY = "YOUR_API_KEY_HERE"  # Get from Settings -> API tab
API_URL = "https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1/telegram-upload"
TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message when /start is issued."""
    await update.message.reply_text(
        "👋 Welcome! Send me any file and I'll upload it to your cloud storage.\\n\\n"
        "Supported: Documents, Images, Videos, Audio, and more!"
    )

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle document uploads."""
    document = update.message.document
    await upload_file(update, document.file_id, document.file_name, document.mime_type)

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle photo uploads."""
    photo = update.message.photo[-1]  # Get highest resolution
    await upload_file(update, photo.file_id, f"photo_{photo.file_unique_id}.jpg", "image/jpeg")

async def handle_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle video uploads."""
    video = update.message.video
    await upload_file(update, video.file_id, video.file_name or f"video_{video.file_unique_id}.mp4", video.mime_type or "video/mp4")

async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle audio uploads."""
    audio = update.message.audio
    await upload_file(update, audio.file_id, audio.file_name or f"audio_{audio.file_unique_id}.mp3", audio.mime_type or "audio/mpeg")

async def upload_file(update: Update, file_id: str, file_name: str, mime_type: str):
    """Upload file to cloud storage."""
    status_msg = await update.message.reply_text("⏳ Uploading...")
    
    try:
        # Get file from Telegram
        file = await update.message.get_bot().get_file(file_id)
        file_bytes = await file.download_as_bytearray()
        
        # Encode to base64
        file_data = base64.b64encode(file_bytes).decode('utf-8')
        
        # Upload to API
        response = requests.post(
            API_URL,
            headers={
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "file_name": file_name,
                "file_data": file_data,
                "mime_type": mime_type
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            await status_msg.edit_text(
                f"✅ Uploaded successfully!\\n\\n"
                f"📁 {result['file']['name']}\\n"
                f"📦 {result['file']['size_bytes']} bytes"
            )
        else:
            error = response.json().get('error', 'Unknown error')
            await status_msg.edit_text(f"❌ Upload failed: {error}")
            
    except Exception as e:
        await status_msg.edit_text(f"❌ Error: {str(e)}")

def main():
    """Start the bot."""
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.VIDEO, handle_video))
    app.add_handler(MessageHandler(filters.AUDIO, handle_audio))
    
    print("Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()`;

  const pythonAdvancedBotCode = `import os
import base64
import math
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes

# Configuration
API_KEY = "YOUR_API_KEY_HERE"  # Get from Settings -> API tab
BASE_URL = "https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1"
TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"

# Chunk size for large files (5MB)
CHUNK_SIZE = 5 * 1024 * 1024

# Store pending uploads per user
pending_uploads = {}

def format_size(size_bytes):
    """Format bytes to human readable size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message."""
    await update.message.reply_text(
        "👋 Welcome to Cloud Upload Bot!\\n\\n"
        "📤 Send me any file to upload\\n"
        "📁 /folders - Browse your folders\\n"
        "📂 /newfolder <name> - Create a folder\\n"
        "🎯 /setfolder - Choose upload destination\\n\\n"
        "💡 Large files are automatically uploaded in chunks!"
    )

async def list_folders(update: Update, context: ContextTypes.DEFAULT_TYPE, parent_id=None):
    """List folders for selection."""
    try:
        url = f"{BASE_URL}/telegram-folders?action=list"
        if parent_id:
            url += f"&parent_id={parent_id}"
        
        response = requests.get(url, headers={"x-api-key": API_KEY})
        data = response.json()
        
        if not data.get("success"):
            await update.message.reply_text(f"❌ Error: {data.get('error', 'Unknown error')}")
            return
        
        folders = data.get("folders", [])
        breadcrumb = data.get("breadcrumb", [])
        
        # Build breadcrumb text
        path = "📁 Root"
        if breadcrumb:
            path = "📁 " + " / ".join([f["name"] for f in breadcrumb])
        
        if not folders:
            await update.message.reply_text(f"{path}\\n\\n📭 No subfolders here.")
            return
        
        # Create inline keyboard for folder navigation
        keyboard = []
        for folder in folders:
            keyboard.append([InlineKeyboardButton(
                f"📁 {folder['name']}", 
                callback_data=f"browse_{folder['id']}"
            )])
        
        # Add "Go Back" button if in subfolder
        if parent_id and breadcrumb:
            parent = breadcrumb[-2]["id"] if len(breadcrumb) > 1 else "root"
            keyboard.append([InlineKeyboardButton("⬆️ Go Back", callback_data=f"browse_{parent}")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(f"{path}\\n\\n📂 Select a folder:", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"❌ Error listing folders: {str(e)}")

async def folders_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /folders command."""
    await list_folders(update, context)

async def newfolder_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Create a new folder."""
    if not context.args:
        await update.message.reply_text("Usage: /newfolder <folder_name>")
        return
    
    folder_name = " ".join(context.args)
    user_id = update.effective_user.id
    parent_id = pending_uploads.get(user_id, {}).get("folder_id")
    
    try:
        response = requests.post(
            f"{BASE_URL}/telegram-folders?action=create",
            headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
            json={"name": folder_name, "parent_id": parent_id}
        )
        data = response.json()
        
        if data.get("success"):
            await update.message.reply_text(f"✅ Folder '{folder_name}' created!")
        else:
            await update.message.reply_text(f"❌ Error: {data.get('error', 'Unknown error')}")
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")

async def setfolder_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Choose upload destination folder."""
    try:
        response = requests.get(
            f"{BASE_URL}/telegram-folders?action=list",
            headers={"x-api-key": API_KEY}
        )
        data = response.json()
        
        if not data.get("success"):
            await update.message.reply_text(f"❌ Error: {data.get('error', 'Unknown error')}")
            return
        
        folders = data.get("folders", [])
        
        keyboard = [[InlineKeyboardButton("📁 Root (No folder)", callback_data="select_root")]]
        for folder in folders:
            keyboard.append([InlineKeyboardButton(
                f"📁 {folder['name']}", 
                callback_data=f"select_{folder['id']}"
            )])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text("🎯 Select upload destination:", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button callbacks."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user_id = update.effective_user.id
    
    if data.startswith("browse_"):
        folder_id = data.replace("browse_", "")
        if folder_id == "root":
            folder_id = None
        # Re-send folder list
        url = f"{BASE_URL}/telegram-folders?action=list"
        if folder_id:
            url += f"&parent_id={folder_id}"
        
        try:
            response = requests.get(url, headers={"x-api-key": API_KEY})
            result = response.json()
            
            folders = result.get("folders", [])
            breadcrumb = result.get("breadcrumb", [])
            
            path = "📁 Root"
            if breadcrumb:
                path = "📁 " + " / ".join([f["name"] for f in breadcrumb])
            
            keyboard = []
            for folder in folders:
                keyboard.append([InlineKeyboardButton(
                    f"📁 {folder['name']}", 
                    callback_data=f"browse_{folder['id']}"
                )])
            
            if folder_id and breadcrumb:
                parent = breadcrumb[-2]["id"] if len(breadcrumb) > 1 else "root"
                keyboard.append([InlineKeyboardButton("⬆️ Go Back", callback_data=f"browse_{parent}")])
            
            keyboard.append([InlineKeyboardButton("✅ Select This Folder", callback_data=f"select_{folder_id or 'root'}")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(f"{path}\\n\\n📂 Subfolders:", reply_markup=reply_markup)
            
        except Exception as e:
            await query.edit_message_text(f"❌ Error: {str(e)}")
    
    elif data.startswith("select_"):
        folder_id = data.replace("select_", "")
        if folder_id == "root":
            folder_id = None
            folder_name = "Root"
        else:
            # Get folder name
            try:
                response = requests.get(
                    f"{BASE_URL}/telegram-folders?action=list&parent_id={folder_id}",
                    headers={"x-api-key": API_KEY}
                )
                result = response.json()
                breadcrumb = result.get("breadcrumb", [])
                folder_name = breadcrumb[-1]["name"] if breadcrumb else "Unknown"
            except:
                folder_name = "Selected folder"
        
        # Store folder preference
        if user_id not in pending_uploads:
            pending_uploads[user_id] = {}
        pending_uploads[user_id]["folder_id"] = folder_id
        pending_uploads[user_id]["folder_name"] = folder_name
        
        await query.edit_message_text(f"✅ Upload destination set to: 📁 {folder_name}\\n\\nSend me a file to upload!")

async def handle_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle all file types."""
    message = update.message
    user_id = update.effective_user.id
    
    # Determine file type and get file info
    if message.document:
        file_id = message.document.file_id
        file_name = message.document.file_name
        mime_type = message.document.mime_type or "application/octet-stream"
        file_size = message.document.file_size
    elif message.photo:
        photo = message.photo[-1]
        file_id = photo.file_id
        file_name = f"photo_{photo.file_unique_id}.jpg"
        mime_type = "image/jpeg"
        file_size = photo.file_size or 0
    elif message.video:
        file_id = message.video.file_id
        file_name = message.video.file_name or f"video_{message.video.file_unique_id}.mp4"
        mime_type = message.video.mime_type or "video/mp4"
        file_size = message.video.file_size
    elif message.audio:
        file_id = message.audio.file_id
        file_name = message.audio.file_name or f"audio_{message.audio.file_unique_id}.mp3"
        mime_type = message.audio.mime_type or "audio/mpeg"
        file_size = message.audio.file_size
    elif message.voice:
        file_id = message.voice.file_id
        file_name = f"voice_{message.voice.file_unique_id}.ogg"
        mime_type = message.voice.mime_type or "audio/ogg"
        file_size = message.voice.file_size
    elif message.video_note:
        file_id = message.video_note.file_id
        file_name = f"video_note_{message.video_note.file_unique_id}.mp4"
        mime_type = "video/mp4"
        file_size = message.video_note.file_size
    else:
        await message.reply_text("❌ Unsupported file type")
        return
    
    # Get folder preference
    folder_id = pending_uploads.get(user_id, {}).get("folder_id")
    folder_name = pending_uploads.get(user_id, {}).get("folder_name", "Root")
    
    status_msg = await message.reply_text(
        f"📤 Preparing upload...\\n"
        f"📁 Destination: {folder_name}\\n"
        f"📦 Size: {format_size(file_size)}"
    )
    
    try:
        # Download file from Telegram
        file = await context.bot.get_file(file_id)
        file_bytes = await file.download_as_bytearray()
        
        # Choose upload method based on size
        if len(file_bytes) > CHUNK_SIZE:
            await chunked_upload(status_msg, file_bytes, file_name, mime_type, folder_id)
        else:
            await simple_upload(status_msg, file_bytes, file_name, mime_type, folder_id)
            
    except Exception as e:
        await status_msg.edit_text(f"❌ Error: {str(e)}")

async def simple_upload(status_msg, file_bytes, file_name, mime_type, folder_id):
    """Upload small files directly."""
    file_data = base64.b64encode(file_bytes).decode('utf-8')
    
    payload = {
        "file_name": file_name,
        "file_data": file_data,
        "mime_type": mime_type
    }
    if folder_id:
        payload["folder_id"] = folder_id
    
    response = requests.post(
        f"{BASE_URL}/telegram-upload",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json=payload
    )
    
    if response.status_code == 200:
        result = response.json()
        await status_msg.edit_text(
            f"✅ Uploaded successfully!\\n\\n"
            f"📁 {result['file']['name']}\\n"
            f"📦 {format_size(result['file']['size_bytes'])}"
        )
    else:
        error = response.json().get('error', 'Unknown error')
        await status_msg.edit_text(f"❌ Upload failed: {error}")

async def chunked_upload(status_msg, file_bytes, file_name, mime_type, folder_id):
    """Upload large files in chunks."""
    total_size = len(file_bytes)
    total_chunks = math.ceil(total_size / CHUNK_SIZE)
    
    await status_msg.edit_text(
        f"📤 Starting chunked upload...\\n"
        f"📦 {format_size(total_size)} in {total_chunks} chunks"
    )
    
    # Initialize upload session
    init_payload = {
        "file_name": file_name,
        "total_size": total_size,
        "total_chunks": total_chunks,
        "mime_type": mime_type
    }
    if folder_id:
        init_payload["folder_id"] = folder_id
    
    init_response = requests.post(
        f"{BASE_URL}/telegram-chunked-upload?action=init",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json=init_payload
    )
    
    if init_response.status_code != 200:
        error = init_response.json().get('error', 'Failed to initialize upload')
        await status_msg.edit_text(f"❌ {error}")
        return
    
    init_data = init_response.json()
    upload_id = init_data["upload_id"]
    
    # Upload chunks
    for chunk_index in range(total_chunks):
        start = chunk_index * CHUNK_SIZE
        end = min(start + CHUNK_SIZE, total_size)
        chunk_data = base64.b64encode(file_bytes[start:end]).decode('utf-8')
        
        chunk_response = requests.post(
            f"{BASE_URL}/telegram-chunked-upload?action=chunk",
            headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
            json={
                "upload_id": upload_id,
                "chunk_index": chunk_index,
                "chunk_data": chunk_data
            }
        )
        
        if chunk_response.status_code != 200:
            error = chunk_response.json().get('error', f'Failed to upload chunk {chunk_index + 1}')
            await status_msg.edit_text(f"❌ {error}")
            return
        
        # Update progress
        progress = ((chunk_index + 1) / total_chunks) * 100
        progress_bar = "█" * int(progress / 10) + "░" * (10 - int(progress / 10))
        await status_msg.edit_text(
            f"📤 Uploading...\\n"
            f"[{progress_bar}] {progress:.0f}%\\n"
            f"Chunk {chunk_index + 1}/{total_chunks}"
        )
    
    # Finalize upload
    await status_msg.edit_text("⚙️ Finalizing upload...")
    
    finalize_response = requests.post(
        f"{BASE_URL}/telegram-chunked-upload?action=finalize",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json={"upload_id": upload_id}
    )
    
    if finalize_response.status_code == 200:
        result = finalize_response.json()
        await status_msg.edit_text(
            f"✅ Upload complete!\\n\\n"
            f"📁 {result['file']['name']}\\n"
            f"📦 {format_size(result['file']['size_bytes'])}"
        )
    else:
        error = finalize_response.json().get('error', 'Failed to finalize upload')
        await status_msg.edit_text(f"❌ {error}")

def main():
    """Start the bot."""
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Command handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("folders", folders_command))
    app.add_handler(CommandHandler("newfolder", newfolder_command))
    app.add_handler(CommandHandler("setfolder", setfolder_command))
    
    # Callback handler for inline buttons
    app.add_handler(CallbackQueryHandler(button_callback))
    
    # File handlers
    app.add_handler(MessageHandler(filters.Document.ALL, handle_file))
    app.add_handler(MessageHandler(filters.PHOTO, handle_file))
    app.add_handler(MessageHandler(filters.VIDEO, handle_file))
    app.add_handler(MessageHandler(filters.AUDIO, handle_file))
    app.add_handler(MessageHandler(filters.VOICE, handle_file))
    app.add_handler(MessageHandler(filters.VIDEO_NOTE, handle_file))
    
    print("🤖 Advanced Upload Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()`;

  const nodeBotCode = `const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Configuration
const API_KEY = 'YOUR_API_KEY_HERE'; // Get from Settings -> API tab
const BASE_URL = 'https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1';
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '👋 Welcome! Send me any file and I\\'ll upload it to your cloud storage.\\n\\n' +
    'Supported: Documents, Images, Videos, Audio, and more!'
  );
});

bot.on('document', async (msg) => {
  await uploadFile(msg, msg.document.file_id, msg.document.file_name, msg.document.mime_type);
});

bot.on('photo', async (msg) => {
  const photo = msg.photo[msg.photo.length - 1];
  await uploadFile(msg, photo.file_id, \`photo_\${photo.file_unique_id}.jpg\`, 'image/jpeg');
});

bot.on('video', async (msg) => {
  await uploadFile(msg, msg.video.file_id, msg.video.file_name || \`video_\${msg.video.file_unique_id}.mp4\`, msg.video.mime_type || 'video/mp4');
});

async function uploadFile(msg, fileId, fileName, mimeType) {
  const statusMsg = await bot.sendMessage(msg.chat.id, '⏳ Uploading...');
  
  try {
    const file = await bot.getFile(fileId);
    const fileUrl = \`https://api.telegram.org/file/bot\${TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
    
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const fileData = Buffer.from(response.data).toString('base64');
    
    const uploadResponse = await axios.post(\`\${BASE_URL}/telegram-upload\`, {
      file_name: fileName,
      file_data: fileData,
      mime_type: mimeType
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (uploadResponse.data.success) {
      await bot.editMessageText(
        \`✅ Uploaded successfully!\\n\\n📁 \${uploadResponse.data.file.name}\\n📦 \${uploadResponse.data.file.size_bytes} bytes\`,
        { chat_id: msg.chat.id, message_id: statusMsg.message_id }
      );
    } else {
      await bot.editMessageText(
        \`❌ Upload failed: \${uploadResponse.data.error}\`,
        { chat_id: msg.chat.id, message_id: statusMsg.message_id }
      );
    }
  } catch (error) {
    await bot.editMessageText(
      \`❌ Error: \${error.message}\`,
      { chat_id: msg.chat.id, message_id: statusMsg.message_id }
    );
  }
}

console.log('Bot is running...');`;

  const requirementsBasic = `python-telegram-bot>=20.0
requests`;

  const requirementsAdvanced = `python-telegram-bot>=20.0
requests`;

  const npmInstallCode = `npm install node-telegram-bot-api axios`;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Telegram Bot Integration
          </h1>
          <p className="text-muted-foreground mt-2">
            Upload files directly to your cloud storage via Telegram
          </p>
        </div>

        {/* Step 1: Get API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Step 1: Get Your API Key
            </CardTitle>
            <CardDescription>
              Generate an API key from your settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to <strong>Settings → API</strong> tab</li>
              <li>Click <strong>"Generate API Key"</strong></li>
              <li>Copy and save your API key securely</li>
            </ol>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard/settings'}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Create Telegram Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Step 2: Create a Telegram Bot
            </CardTitle>
            <CardDescription>
              Get your bot token from BotFather
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Open Telegram and search for <strong>@BotFather</strong></li>
              <li>Send <code className="bg-muted px-1 rounded">/newbot</code> command</li>
              <li>Follow the prompts to name your bot</li>
              <li>Copy the bot token provided by BotFather</li>
            </ol>
          </CardContent>
        </Card>

        {/* Step 3: Bot Code with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Step 3: Deploy the Bot
            </CardTitle>
            <CardDescription>
              Choose between basic or advanced bot with folder support
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="advanced" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="advanced" className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  Advanced (Python)
                </TabsTrigger>
                <TabsTrigger value="basic">Basic (Python)</TabsTrigger>
                <TabsTrigger value="node">Node.js</TabsTrigger>
              </TabsList>
              
              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Advanced Features:
                  </p>
                  <ul className="text-sm space-y-1 ml-6 list-disc">
                    <li>📁 Browse and select upload folders</li>
                    <li>📂 Create new folders via /newfolder</li>
                    <li>🎯 Set default upload destination</li>
                    <li>📤 Chunked upload for large files (5MB chunks)</li>
                    <li>📊 Real-time progress bar</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">requirements.txt</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(requirementsAdvanced, 'requirements-adv')}
                    >
                      {copiedSection === 'requirements-adv' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
                    {requirementsAdvanced}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">advanced_bot.py</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(pythonAdvancedBotCode, 'python-advanced')}
                    >
                      {copiedSection === 'python-advanced' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    {pythonAdvancedBotCode}
                  </pre>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">Bot Commands:</p>
                  <ul className="text-sm space-y-1 font-mono">
                    <li><code>/start</code> - Welcome message</li>
                    <li><code>/folders</code> - Browse your folders</li>
                    <li><code>/newfolder &lt;name&gt;</code> - Create a new folder</li>
                    <li><code>/setfolder</code> - Choose upload destination</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">requirements.txt</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(requirementsBasic, 'requirements-basic')}
                    >
                      {copiedSection === 'requirements-basic' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
                    {requirementsBasic}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">bot.py</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(pythonBasicBotCode, 'python-basic')}
                    >
                      {copiedSection === 'python-basic' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    {pythonBasicBotCode}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="node" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Install dependencies</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(npmInstallCode, 'npm')}
                    >
                      {copiedSection === 'npm' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-sm font-mono">
                    {npmInstallCode}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">bot.js</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(nodeBotCode, 'node')}
                    >
                      {copiedSection === 'node' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    {nodeBotCode}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Replace <code>YOUR_API_KEY_HERE</code> and <code>YOUR_TELEGRAM_BOT_TOKEN</code> with your actual credentials
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Run Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Run Your Bot</CardTitle>
            <CardDescription>
              Start the bot and test file uploads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Python:</p>
              <pre className="p-3 rounded-lg bg-muted text-sm font-mono">
                pip install -r requirements.txt{'\n'}python advanced_bot.py
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Node.js:</p>
              <pre className="p-3 rounded-lg bg-muted text-sm font-mono">
                node bot.js
              </pre>
            </div>
            <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-sm">
                📱 Open your bot in Telegram and send a file to test the upload!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TelegramGuide;
