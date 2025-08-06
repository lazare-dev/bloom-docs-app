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

// Create organized embed with file list
function createBrowseEmbed(files, currentFolderId) {
    const embed = new EmbedBuilder()
        .setTitle('📁 Google Drive Browser')
        .setColor(0x4285f4);

    // Separate folders and documents
    const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    const documents = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    let description = '';

    // Add navigation info
    if (currentFolderId !== process.env.GOOGLE_DRIVE_FOLDER_ID) {
        description += '⬅️ **Use the Back button to go up one level**\n\n';
    }

    // Add folders section
    if (folders.length > 0) {
        description += '📁 **Folders:**\n';
        folders.slice(0, 10).forEach((folder, index) => {
            const truncatedName = folder.name.length > 50 ? folder.name.substring(0, 47) + '...' : folder.name;
            description += `${index + 1}. 📂 ${truncatedName}\n`;
        });
        description += '\n';
    }

    // Add documents section
    if (documents.length > 0) {
        description += '📄 **Documents:**\n';
        documents.slice(0, 10).forEach((doc, index) => {
            const truncatedName = doc.name.length > 50 ? doc.name.substring(0, 47) + '...' : doc.name;
            description += `${index + 1}. 📝 ${truncatedName}\n`;
        });
    }

    if (folders.length === 0 && documents.length === 0) {
        description = '📭 This folder is empty.';
    }

    // Add footer info
    const totalItems = folders.length + documents.length;
    if (totalItems > 20) {
        description += `\n*Showing first 20 of ${totalItems} items*`;
    }

    embed.setDescription(description);

    // Add fields for better organization
    if (folders.length > 0 || documents.length > 0) {
        embed.addFields(
            { name: '📊 Summary', value: `${folders.length} folders • ${documents.length} documents`, inline: true },
            { name: '💡 How to use', value: 'Click the numbered buttons below to navigate', inline: true }
        );
    }

    return embed;
}

// Create browse embed with clickable links (no buttons needed)
function createBrowseEmbedWithLinks(files, currentFolderId, userId) {
    const embed = new EmbedBuilder()
        .setTitle('📁 Google Drive Browser')
        .setColor(0x4285f4);

    // Separate folders and documents
    const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    const documents = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    let description = '';

    // Add navigation info
    if (currentFolderId !== process.env.GOOGLE_DRIVE_FOLDER_ID) {
        description += '⬅️ **[← Back to Parent Folder](https://discord.com/channels/@me)**\n\n';
    }

    // Add folders section with clickable links
    if (folders.length > 0) {
        description += '📁 **Folders:**\n';
        folders.slice(0, 6).forEach((folder, index) => {
            const truncatedName = folder.name.length > 40 ? folder.name.substring(0, 37) + '...' : folder.name;
            // Create a custom link that will trigger folder browsing
            description += `${index + 1}. 📂 [${truncatedName}](https://drive.google.com/drive/folders/${folder.id})\n`;
        });
        description += '\n';
    }

    // Add documents section with direct Google Docs links
    if (documents.length > 0) {
        description += '📄 **Documents:**\n';
        documents.slice(0, 8).forEach((doc, index) => {
            const truncatedName = doc.name.length > 40 ? doc.name.substring(0, 37) + '...' : doc.name;
            // Direct link to Google Docs
            description += `${index + 1}. 📝 [${truncatedName}](https://docs.google.com/document/d/${doc.id}/edit)\n`;
        });
    }

    if (folders.length === 0 && documents.length === 0) {
        description = '📭 This folder is empty.';
    }

    // Add footer info
    const totalItems = folders.length + documents.length;
    if (totalItems > 20) {
        description += `\n*Showing first 20 of ${totalItems} items*`;
    }

    embed.setDescription(description);

    // Add fields for better organization
    if (folders.length > 0 || documents.length > 0) {
        embed.addFields(
            { name: '📊 Summary', value: `${folders.length} folders • ${documents.length} documents`, inline: true },
            { name: '💡 How to use', value: 'Click the links above to open in Google Drive/Docs', inline: true }
        );
    }

    return embed;
}

// Create search results embed
function createSearchEmbed(files, query) {
    const embed = new EmbedBuilder()
        .setTitle(`🔍 Search Results for "${query}"`)
        .setColor(0xfbbc04);

    const documents = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    let description = '';

    if (documents.length > 0) {
        description += '📄 **Found Documents:**\n';
        documents.slice(0, 15).forEach((doc, index) => {
            const truncatedName = doc.name.length > 50 ? doc.name.substring(0, 47) + '...' : doc.name;
            description += `${index + 1}. 📝 ${truncatedName}\n`;
        });

        if (documents.length > 15) {
            description += `\n*Showing first 15 of ${documents.length} results*`;
        }
    } else {
        description = `📭 No documents found matching "${query}"`;
    }

    embed.setDescription(description);

    if (documents.length > 0) {
        embed.addFields(
            { name: '📊 Results', value: `${documents.length} documents found`, inline: true },
            { name: '💡 How to use', value: 'Click the numbered buttons below to view documents', inline: true }
        );
    }

    return embed;
}

// Create search results embed with clickable links
function createSearchEmbedWithLinks(files, query) {
    const embed = new EmbedBuilder()
        .setTitle(`🔍 Search Results for "${query}"`)
        .setColor(0xfbbc04);

    const documents = files.filter(file => file.mimeType === 'application/vnd.google-apps.document');

    let description = '';

    if (documents.length > 0) {
        description += '📄 **Found Documents:**\n';
        documents.slice(0, 15).forEach((doc, index) => {
            const truncatedName = doc.name.length > 45 ? doc.name.substring(0, 42) + '...' : doc.name;
            // Direct link to Google Docs
            description += `${index + 1}. 📝 [${truncatedName}](https://docs.google.com/document/d/${doc.id}/edit)\n`;
        });

        if (documents.length > 15) {
            description += `\n*Showing first 15 of ${documents.length} results*`;
        }
    } else {
        description = `📭 No documents found matching "${query}"`;
    }

    embed.setDescription(description);

    if (documents.length > 0) {
        embed.addFields(
            { name: '📊 Results', value: `${documents.length} documents found`, inline: true },
            { name: '💡 How to use', value: 'Click the links above to open documents', inline: true }
        );
    }

    return embed;
}

// Create numbered navigation buttons
function createNavigationButtons(files, currentFolderId) {
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    // Add back button if not at root
    if (currentFolderId !== process.env.GOOGLE_DRIVE_FOLDER_ID) {
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId('back')
                .setLabel('⬅️ Back')
                .setStyle(ButtonStyle.Secondary)
        );
        buttonCount++;
    }

    // Filter and limit files
    const validFiles = files.filter(file =>
        file.mimeType === 'application/vnd.google-apps.folder' ||
        file.mimeType === 'application/vnd.google-apps.document'
    ).slice(0, 20);

    // Create numbered buttons
    validFiles.forEach((file, index) => {
        if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }

        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const buttonNumber = index + 1;

        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`${isFolder ? 'folder' : 'doc'}:${file.id}`)
                .setLabel(`${buttonNumber}`)
                .setStyle(isFolder ? ButtonStyle.Primary : ButtonStyle.Success)
        );
        buttonCount++;
    });

    if (buttonCount > 0) rows.push(currentRow);
    return rows;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Test Google Drive connection
    try {
        console.log('Testing Google Drive connection...');
        const testResponse = await drive.files.list({
            q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1
        });
        console.log('Google Drive connection successful!');
        console.log(`Root folder ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
    } catch (error) {
        console.error('Google Drive connection failed:', error);
    }
    
    // Register slash command
    const command = new SlashCommandBuilder()
        .setName('docs')
        .setDescription('Browse Google Drive and view documents')
        .addSubcommand(subcommand =>
            subcommand
                .setName('browse')
                .setDescription('Browse Google Drive folders (private by default)')
                .addBooleanOption(option =>
                    option.setName('share')
                        .setDescription('Share with everyone in the channel (default: private)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search for documents (private by default)')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Search term')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('share')
                        .setDescription('Share with everyone in the channel (default: private)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show help and usage examples')
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
            const share = interaction.options.getBoolean('share') || false;

            if (subcommand === 'browse') {
                await handleBrowse(interaction, process.env.GOOGLE_DRIVE_FOLDER_ID, share);
            } else if (subcommand === 'search') {
                const query = interaction.options.getString('query');
                await handleSearch(interaction, query, share);
            } else if (subcommand === 'help') {
                await handleHelp(interaction);
            }
        }
    } else if (interaction.isButton()) {
        const [type, id] = interaction.customId.split(':');

        if (type === 'folder') {
            await handleBrowse(interaction, id, false);
        } else if (type === 'doc') {
            await handleDocument(interaction, id);
        } else if (type === 'back') {
            await handleBack(interaction);
        } else if (type === 'pdf') {
            await handlePdfDownload(interaction, id);
        } else if (type === 'preview') {
            await handlePreview(interaction, id);
        }
    }
});

async function handleBrowse(interaction, folderId, share = false) {
    try {
        await interaction.deferReply({ ephemeral: !share });
        console.log(`Browsing folder: ${folderId}, shared: ${share}`);

        // Update user history
        const userId = interaction.user.id;
        if (!userHistory.has(userId)) {
            userHistory.set(userId, []);
        }

        if (folderId !== process.env.GOOGLE_DRIVE_FOLDER_ID) {
            userHistory.get(userId).push(folderId);
        }

        console.log('Fetching folder contents...');
        const files = await getFolderContents(folderId);
        console.log(`Found ${files.length} files`);

        if (files.length === 0) {
            await interaction.editReply('This folder is empty or you don\'t have access to it.');
            return;
        }

        const embed = createBrowseEmbedWithLinks(files, folderId, userId);

        await interaction.editReply({
            embeds: [embed]
        });
        console.log('Browse response sent successfully');
    } catch (error) {
        console.error('Error in handleBrowse:', error);
        await interaction.editReply('Error: Could not browse folder. Please check the logs.');
    }
}

async function handleDocument(interaction, docId) {
    await interaction.deferReply();

    try {
        // Get document metadata
        const doc = await docs.documents.get({ documentId: docId });
        const title = doc.data.title || 'Untitled Document';

        // Create web viewer URL (Google Docs public viewer)
        const viewerUrl = `https://docs.google.com/document/d/${docId}/edit`;

        const embed = new EmbedBuilder()
            .setTitle(`📄 ${title}`)
            .setDescription('Click the button below to view the full document')
            .setColor(0x34a853)
            .addFields(
                { name: 'Document ID', value: docId, inline: true },
                { name: 'View Options', value: 'Web viewer or download as PDF', inline: true }
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('📖 View Document')
                    .setStyle(ButtonStyle.Link)
                    .setURL(viewerUrl),
                new ButtonBuilder()
                    .setLabel('📥 Download PDF')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`pdf:${docId}`),
                new ButtonBuilder()
                    .setLabel('📝 Preview Text')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`preview:${docId}`)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error handling document:', error);
        await interaction.editReply('Error: Could not load document.');
    }
}

async function handleBack(interaction) {
    const userId = interaction.user.id;
    const history = userHistory.get(userId);
    
    if (!history || history.length === 0) {
        await handleBrowse(interaction, process.env.GOOGLE_DRIVE_FOLDER_ID, false);
        return;
    }

    // Remove current folder and go to previous
    history.pop();
    const previousFolder = history.length > 0 ? history[history.length - 1] : process.env.GOOGLE_DRIVE_FOLDER_ID;

    await handleBrowse(interaction, previousFolder, false);
}

async function handleHelp(interaction) {
    await interaction.reply({
        ephemeral: true,
        embeds: [
            new EmbedBuilder()
                .setTitle('📚 Google Docs Bot Help')
                .setDescription('Here are all the available commands and options:')
                .setColor(0x34a853)
                .addFields(
                    {
                        name: '🔒 Private Commands (Only you can see)',
                        value: '`/docs browse` - Browse folders privately\n`/docs search query: your search` - Search documents privately',
                        inline: false
                    },
                    {
                        name: '📢 Shared Commands (Everyone can see)',
                        value: '`/docs browse share: true` - Browse folders publicly\n`/docs search query: your search share: true` - Search documents publicly',
                        inline: false
                    },
                    {
                        name: '💡 How it works',
                        value: '• **Private by default** - responses only visible to you\n• **Add `share: true`** to make responses visible to everyone\n• **Click links** to open documents in Google Drive/Docs\n• **No buttons needed** - direct links work better!',
                        inline: false
                    },
                    {
                        name: '🔍 Search Examples',
                        value: '`/docs search query: meeting notes`\n`/docs search query: project plan share: true`\n`/docs search query: design document`',
                        inline: false
                    }
                )
                .setFooter({ text: 'Tip: Use /docs help anytime to see this help message!' })
        ]
    });
}

async function handlePdfDownload(interaction, docId) {
    await interaction.deferReply();

    try {
        // Create PDF export URL
        const pdfUrl = `https://docs.google.com/document/d/${docId}/export?format=pdf`;

        const embed = new EmbedBuilder()
            .setTitle('📥 PDF Download')
            .setDescription('Click the link below to download the document as PDF')
            .setColor(0xea4335);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('📥 Download PDF')
                    .setStyle(ButtonStyle.Link)
                    .setURL(pdfUrl)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error creating PDF download:', error);
        await interaction.editReply('Error: Could not create PDF download link.');
    }
}

async function handlePreview(interaction, docId) {
    await interaction.deferReply();

    try {
        const markdown = await convertDocToMarkdown(docId);

        // Limit preview to first 1500 characters
        const preview = markdown.length > 1500 ? markdown.substring(0, 1500) + '...' : markdown;

        const embed = new EmbedBuilder()
            .setTitle('📝 Document Preview')
            .setDescription('Here\'s a preview of the document content:')
            .setColor(0x34a853);

        await interaction.editReply({
            embeds: [embed],
            content: `\`\`\`markdown\n${preview}\n\`\`\``
        });
    } catch (error) {
        console.error('Error creating preview:', error);
        await interaction.editReply('Error: Could not create document preview.');
    }
}

async function handleSearch(interaction, query, share = false) {
    await interaction.deferReply({ ephemeral: !share });

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

        const embed = createSearchEmbedWithLinks(files, query);

        await interaction.editReply({
            embeds: [embed]
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
