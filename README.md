# Google Docs Discord Bot

A Discord bot that allows you to browse Google Drive folders and view Google Docs as formatted markdown directly in Discord.

## Features

- 📁 Browse Google Drive folders with interactive buttons
- 📄 View Google Docs converted to markdown
- 🔍 Search for documents by name
- ⬅️ Navigate back through folders
- 🎨 Proper formatting (bold, italic, headings)
- 📱 Handles long documents by splitting across messages

## Setup Instructions

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Drive API
   - Google Docs API
4. Create a Service Account:
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Give it a name like "discord-docs-bot"
   - Click "Create and Continue"
   - Skip role assignment for now
   - Click "Done"
5. Create a key for the service account:
   - Click on your service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose JSON format
   - Download the file (keep it secure!)

### 2. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name like "Google Docs Bot"
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the bot token (keep it secure!)
7. Under "Privileged Gateway Intents", enable:
   - Server Members Intent (if needed)
   - Message Content Intent (if needed)

### 3. Google Drive Permissions

1. Open the Google Drive folder you want the bot to access
2. Click "Share"
3. Add the service account email (found in your JSON file as "client_email")
4. Give it "Viewer" permissions
5. Copy the folder ID from the URL (the long string after `/folders/`)

### 4. Deploy to Render

1. Fork this repository or upload it to GitHub
2. Go to [Render](https://render.com/)
3. Sign up/login with GitHub
4. Click "New" → "Web Service"
5. Connect your repository
6. Configure:
   - **Name**: google-docs-discord-bot
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
7. Add Environment Variables:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `ROOT_FOLDER_ID`: Your Google Drive folder ID
   - `GOOGLE_CREDENTIALS`: Your entire JSON credentials file (as one line)

### 5. Invite Bot to Discord

1. In Discord Developer Portal, go to OAuth2 → URL Generator
2. Select scopes: `bot` and `applications.commands`
3. Select permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
4. Copy the generated URL and open it
5. Select your server and authorize

## Usage

### Commands

- `/docs browse` - Browse the root Google Drive folder
- `/docs search <query>` - Search for documents by name

### Navigation

- Click folder buttons to browse deeper
- Click document buttons to view content
- Use the "← Back" button to go up one level
- Each user has their own navigation history

## Environment Variables

Create a `.env` file (for local development) or set these in Render:

```env
DISCORD_TOKEN=your_discord_bot_token
ROOT_FOLDER_ID=your_google_drive_folder_id
GOOGLE_CREDENTIALS={"type":"service_account",...}
```

## Local Development

1. Clone this repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Run `npm start`

## Troubleshooting

### Bot doesn't respond
- Check that the bot is online in your Discord server
- Verify the Discord token is correct
- Check Render logs for errors

### Can't access Google Drive
- Verify the service account has access to your folder
- Check that both Google Drive and Docs APIs are enabled
- Ensure the GOOGLE_CREDENTIALS environment variable is properly formatted

### Documents don't display properly
- The bot converts Google Docs to markdown format
- Some complex formatting may not translate perfectly
- Very long documents are split across multiple messages

## Support

If you encounter issues:
1. Check the Render logs for error messages
2. Verify all environment variables are set correctly
3. Ensure the service account has proper permissions

## License

MIT License - feel free to modify and use as needed!
