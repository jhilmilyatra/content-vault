import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Bot, Code, Key, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TelegramGuide = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, section: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(section);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const pythonBotCode = `import os
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

  const nodeBotCode = `const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

// Configuration
const API_KEY = 'YOUR_API_KEY_HERE'; // Get from Settings -> API tab
const API_URL = 'https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1/telegram-upload';
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
    // Get file from Telegram
    const file = await bot.getFile(fileId);
    const fileUrl = \`https://api.telegram.org/file/bot\${TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
    
    // Download file
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const fileData = Buffer.from(response.data).toString('base64');
    
    // Upload to API
    const uploadResponse = await axios.post(API_URL, {
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

  const requirementsCode = `python-telegram-bot>=20.0
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

        {/* Step 3: Python Bot Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Step 3: Deploy the Bot (Python)
            </CardTitle>
            <CardDescription>
              Copy and run this Python bot code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">requirements.txt</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(requirementsCode, 'requirements')}
                >
                  {copiedSection === 'requirements' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
                {requirementsCode}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">bot.py</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(pythonBotCode, 'python')}
                >
                  {copiedSection === 'python' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                {pythonBotCode}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Replace <code>YOUR_API_KEY_HERE</code> and <code>YOUR_TELEGRAM_BOT_TOKEN</code> with your actual credentials
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alternative: Node.js */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Alternative: Node.js Bot
            </CardTitle>
            <CardDescription>
              If you prefer JavaScript/Node.js
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                pip install -r requirements.txt{'\n'}python bot.py
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
