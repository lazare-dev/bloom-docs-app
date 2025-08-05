# Complete Setup Guide for Render Deployment

## Step-by-Step Instructions

### 1. Google Cloud Console Setup (5 minutes)

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Click "Select a project" → "New Project"
   - Name: "discord-docs-bot"
   - Click "Create"

2. **Enable APIs**
   - In the search bar, type "Google Drive API"
   - Click on it and press "Enable"
   - Go back and search "Google Docs API"
   - Click on it and press "Enable"

3. **Create Service Account**
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Name: "discord-docs-bot"
   - Description: "Service account for Discord bot"
   - Click "Create and Continue"
   - Skip role assignment, click "Continue"
   - Click "Done"

4. **Generate Credentials**
   - Click on your new service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON"
   - Click "Create" - this downloads a JSON file
   - **SAVE THIS FILE SECURELY** - you'll need it later

### 2. Discord Bot Setup (3 minutes)

1. **Create Discord Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Name: "Google Docs Bot"
   - Click "Create"

2. **Create Bot**
   - Go to "Bot" section in left sidebar
   - Click "Add Bot"
   - Copy the "Token" - **SAVE THIS TOKEN SECURELY**

3. **Set Permissions**
   - Go to "OAuth2" → "URL Generator"
   - Scopes: Check "bot" and "applications.commands"
   - Bot Permissions: Check "Send Messages", "Use Slash Commands", "Embed Links"
   - Copy the generated URL at the bottom

4. **Invite Bot to Server**
   - Open the URL you copied
   - Select your Discord server
   - Click "Authorize"

### 3. Google Drive Setup (2 minutes)

1. **Share Folder with Bot**
   - Open Google Drive
   - Navigate to the folder you want the bot to access
   - Right-click → "Share"
   - In the JSON file you downloaded, find "client_email"
   - Add that email address to the share
   - Set permission to "Viewer"
   - Click "Send"

2. **Get Folder ID**
   - While in the folder, look at the URL
   - Copy the long string after `/folders/`
   - Example: `https://drive.google.com/drive/folders/1ABC123DEF456GHI789JKL`
   - The folder ID is: `1ABC123DEF456GHI789JKL`

### 4. Render Deployment (5 minutes)

1. **Upload Code to GitHub**
   - Create a new repository on GitHub
   - Upload all the files from this project
   - Make sure to commit and push

2. **Deploy to Render**
   - Go to https://render.com/
   - Sign up/login with GitHub
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: google-docs-discord-bot
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: Free

3. **Set Environment Variables**
   Click "Advanced" and add these environment variables:
   
   - **DISCORD_TOKEN**: 
     - Paste your Discord bot token
   
   - **ROOT_FOLDER_ID**: 
     - Paste your Google Drive folder ID
   
   - **GOOGLE_CREDENTIALS**: 
     - Open your downloaded JSON file
     - Copy the ENTIRE contents (all the JSON)
     - Paste it as one line (remove line breaks)

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete (2-3 minutes)
   - Check logs to ensure no errors

### 5. Test the Bot (1 minute)

1. **In Discord**
   - Type `/docs browse`
   - You should see your Google Drive folder contents
   - Click on folders to browse
   - Click on documents to view them

## Troubleshooting

### Bot doesn't respond to commands
- Check Render logs for errors
- Verify Discord token is correct
- Make sure bot has proper permissions in Discord

### Can't access Google Drive
- Verify service account email is shared on the folder
- Check that APIs are enabled in Google Cloud
- Ensure GOOGLE_CREDENTIALS is properly formatted (no line breaks)

### Documents don't load
- Check that the service account has access to the specific documents
- Verify Google Docs API is enabled

## Environment Variables Format

Your `.env` should look like this:

```
DISCORD_TOKEN=your_actual_discord_bot_token_here
ROOT_FOLDER_ID=your_google_drive_folder_id_here
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project-id","private_key_id":"your-key-id","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com","client_id":"your-client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"}
```

## Success!

Once deployed, your bot will be available 24/7 on Render's free tier. Users can browse your Google Drive and view documents directly in Discord!
