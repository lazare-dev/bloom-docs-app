const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();

// Initialize Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Google Drive setup
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly']
});

const drive = google.drive({ version: 'v3', auth });
const docs = google.docs({ version: 'v1', auth });

// Store user navigation history
const userHistory = new Map();

// Helper function to get folder contents
async function getFolderContents(folderId) {
    try {
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType)',
            orderBy: 'folder,name'
        });
        return response.data.files;
    } catch (error) {
        console.error('Error fetching folder contents:', error);
        return [];
    }
}

// Helper function to convert Google Doc to markdown
async function convertDocToMarkdown(docId) {
    try {
        const doc = await docs.documents.get({ documentId: docId });
        let markdown = '';
        
        if (doc.data.body && doc.data.body.content) {
            for (const element of doc.data.body.content) {
                if (element.paragraph) {
                    const paragraph = element.paragraph;
                    let text = '';
                    
                    if (paragraph.elements) {
                        for (const elem of paragraph.elements) {
                            if (elem.textRun && elem.textRun.content) {
                                let content = elem.textRun.content;
                                
                                // Apply formatting
                                if (elem.textRun.textStyle) {
                                    const style = elem.textRun.textStyle;
                                    if (style.bold) content = `**${content}**`;
                                    if (style.italic) content = `*${content}*`;
                                }
                                
                                text += content;
                            }
                        }
                    }
                    
                    // Handle headings
                    if (paragraph.paragraphStyle && paragraph.paragraphStyle.namedStyleType) {
                        const styleType = paragraph.paragraphStyle.namedStyleType;
                        if (styleType.includes('HEADING_1')) text = `# ${text}`;
                        else if (styleType.includes('HEADING_2')) text = `## ${text}`;
                        else if (styleType.includes('HEADING_3')) text = `### ${text}`;
                    }
                    
                    markdown += text;
                }
            }
        }
        
        return markdown.trim() || 'Document appears to be empty.';
    } catch (error) {
        console.error('Error converting document:', error);
        return 'Error: Could not read document content.';
    }
}

// Helper function to split long messages
function splitMessage(content, maxLength = 2000) {
    if (content.length <= maxLength) return [content];
    
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > maxLength) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

// Create folder/file buttons
function createNavigationButtons(files, currentFolderId) {
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;
    
    // Add back button if not at root
    if (currentFolderId !== process.env.GOOGLE_DRIVE_FOLDER_ID) {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId('back')
                .setLabel('← Back')
                .setStyle(ButtonStyle.Secondary)
        );
        buttonCount++;
    }
    
    for (const file of files.slice(0, 20)) { // Limit to 20 items
        if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
        
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const isDoc = file.mimeType === 'application/vnd.google-apps.document';
        
        if (isFolder || isDoc) {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${isFolder ? 'folder' : 'doc'}:${file.id}`)
                    .setLabel(file.name.length > 80 ? file.name.substring(0, 77) + '...' : file.name)
                    .setStyle(isFolder ? ButtonStyle.Primary : ButtonStyle.Success)
            );
            buttonCount++;
        }
    }
    
    if (buttonCount > 0) rows.push(currentRow);
    return rows;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Register slash command
    const command = new SlashCommandBuilder()
        .setName('docs')
        .setDescription('Browse Google Drive and view documents')
        .addSubcommand(subcommand =>
            subcommand
                .setName('browse')
                .setDescription('Browse Google Drive folders')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search for documents')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Search term')
                        .setRequired(true)
                )
        );
    
    try {
        await client.application.commands.create(command);
        console.log('Slash command registered successfully!');
    } catch (error) {
        console.error('Error registering slash command:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        
        if (commandName === 'docs') {
            const subcommand = interaction.options.getSubcommand();
            
            if (subcommand === 'browse') {
                await handleBrowse(interaction, process.env.GOOGLE_DRIVE_FOLDER_ID);
            } else if (subcommand === 'search') {
                const query = interaction.options.getString('query');
                await handleSearch(interaction, query);
            }
        }
    } else if (interaction.isButton()) {
        const [type, id] = interaction.customId.split(':');
        
        if (type === 'folder') {
            await handleBrowse(interaction, id);
        } else if (type === 'doc') {
            await handleDocument(interaction, id);
        } else if (type === 'back') {
            await handleBack(interaction);
        }
    }
});

async function handleBrowse(interaction, folderId) {
    await interaction.deferReply();
    
    // Update user history
    const userId = interaction.user.id;
    if (!userHistory.has(userId)) {
        userHistory.set(userId, []);
    }
    
    if (folderId !== process.env.GOOGLE_DRIVE_FOLDER_ID) {
        userHistory.get(userId).push(folderId);
    }
    
    const files = await getFolderContents(folderId);
    
    if (files.length === 0) {
        await interaction.editReply('This folder is empty or you don\'t have access to it.');
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('📁 Google Drive Browser')
        .setDescription('Click a folder to browse or a document to view')
        .setColor(0x4285f4);
    
    const buttons = createNavigationButtons(files, folderId);
    
    await interaction.editReply({
        embeds: [embed],
        components: buttons
    });
}

async function handleDocument(interaction, docId) {
    await interaction.deferReply();
    
    try {
        const markdown = await convertDocToMarkdown(docId);
        const chunks = splitMessage(markdown);
        
        const embed = new EmbedBuilder()
            .setTitle('📄 Document Content')
            .setColor(0x34a853);
        
        // Send first chunk with embed
        await interaction.editReply({
            embeds: [embed],
            content: `\`\`\`markdown\n${chunks[0]}\n\`\`\``
        });
        
        // Send remaining chunks as follow-up messages
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({
                content: `\`\`\`markdown\n${chunks[i]}\n\`\`\``
            });
        }
    } catch (error) {
        console.error('Error handling document:', error);
        await interaction.editReply('Error: Could not load document.');
    }
}

async function handleBack(interaction) {
    const userId = interaction.user.id;
    const history = userHistory.get(userId);
    
    if (!history || history.length === 0) {
        await handleBrowse(interaction, process.env.GOOGLE_DRIVE_FOLDER_ID);
        return;
    }
    
    // Remove current folder and go to previous
    history.pop();
    const previousFolder = history.length > 0 ? history[history.length - 1] : process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    await handleBrowse(interaction, previousFolder);
}

async function handleSearch(interaction, query) {
    await interaction.deferReply();
    
    try {
        const response = await drive.files.list({
            q: `name contains '${query}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
            fields: 'files(id, name)',
            orderBy: 'name'
        });
        
        const files = response.data.files;
        
        if (files.length === 0) {
            await interaction.editReply(`No documents found matching "${query}".`);
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🔍 Search Results for "${query}"`)
            .setDescription(`Found ${files.length} document(s)`)
            .setColor(0xfbbc04);
        
        const buttons = createNavigationButtons(files, null);
        
        await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    } catch (error) {
        console.error('Error searching:', error);
        await interaction.editReply('Error: Could not perform search.');
    }
}

// Simple HTTP server to keep Render happy
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord bot is running!');
});

server.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);
