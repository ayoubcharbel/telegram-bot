require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required in environment variables');
    process.exit(1);
}

// Initialize bot with polling
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

console.log('🤖 Bot is starting...');

// Simple in-memory storage for user activity
const userActivity = new Map();

// Helper function to get or create user
function getUser(userId) {
    if (!userActivity.has(userId)) {
        userActivity.set(userId, {
            messageCount: 0,
            stickerCount: 0,
            firstName: '',
            username: ''
        });
    }
    return userActivity.get(userId);
}

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = getUser(userId);
    
    // Update user info
    user.firstName = msg.from.first_name || '';
    user.username = msg.from.username || '';
    
    bot.sendMessage(chatId, `👋 Hello ${user.firstName || 'there'}! I'm your activity tracker bot.\n\n` +
        '📊 Use /rankings to see the leaderboard\n' +
        '💬 Send messages and stickers to track your activity!');
});

// Handle /rankings command
bot.onText(/\/rankings/, (msg) => {
    const chatId = msg.chat.id;
    
    // Convert user activity to array and sort by total activity
    const rankings = Array.from(userActivity.entries())
        .map(([userId, data]) => ({
            userId,
            ...data,
            totalActivity: data.messageCount + data.stickerCount
        }))
        .sort((a, b) => b.totalActivity - a.totalActivity)
        .slice(0, 10); // Top 10 users
    
    if (rankings.length === 0) {
        bot.sendMessage(chatId, '📊 No activity recorded yet! Start chatting to appear on the rankings.');
        return;
    }
    
    // Create leaderboard message
    let message = '🏆 *Activity Rankings*\n\n';
    
    rankings.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
        const name = user.firstName || `User ${user.userId}`;
        
        message += `${medal} *${index + 1}.* ${name}\n`;
        message += `   💬 ${user.messageCount} messages | 🎭 ${user.stickerCount} stickers\n`;
        message += `   📊 Total: ${user.totalActivity} activities\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Track regular messages
bot.on('message', (msg) => {
    // Skip commands
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = msg.from.id;
    const user = getUser(userId);
    
    // Update user info
    user.firstName = msg.from.first_name || user.firstName;
    user.username = msg.from.username || user.username;
    
    // Count messages and stickers
    if (msg.sticker) {
        user.stickerCount += 1;
    } else if (msg.text) {
        user.messageCount += 1;
    }
    
    console.log(`📝 Activity updated for user ${userId}:`, {
        messages: user.messageCount,
        stickers: user.stickerCount
    });
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

console.log('✅ Bot is ready and waiting for commands...');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Bot status endpoint
app.get('/bot-status', async (req, res) => {
    try {
        const me = await bot.getMe();
        const userData = getUserData();
        
        res.json({
            bot: {
                id: me.id,
                username: me.username,
                first_name: me.first_name,
                is_bot: me.is_bot
            },
            stats: {
                totalUsers: Object.keys(userData.users).length,
                totalInteractions: userData.analytics.totalInteractions,
                uptime: process.uptime()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analytics endpoint
app.get('/analytics', (req, res) => {
    try {
        const analytics = getAnalytics();
        const userData = getUserData();
        
        res.json({
            analytics,
            summary: {
                totalUsers: Object.keys(userData.users).length,
                activeToday: Object.values(userData.users)
                    .filter(user => {
                        const today = new Date().toISOString().split('T')[0];
                        return user.lastSeen && user.lastSeen.startsWith(today);
                    }).length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Backup management endpoints
app.post('/create-backup', (req, res) => {
    try {
        const backupFile = createBackup();
        if (backupFile) {
            res.json({ 
                success: true, 
                backup: backupFile,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({ error: 'Failed to create backup' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/list-backups', (req, res) => {
    try {
        const backups = listBackups();
        res.json({ backups, count: backups.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/restore-backup', (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }
        
        const success = restoreBackup(filename);
        if (success) {
            res.json({ 
                success: true, 
                message: `Backup ${filename} restored successfully`,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({ error: 'Failed to restore backup' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({
        message: 'Bot is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Bot event handlers
bot.on('message', async (msg) => {
    try {
        const userId = msg.from.id.toString();
        const chatId = msg.chat.id;
        const messageType = getMessageType(msg);
        const isCommand = msg.text && msg.text.startsWith('/');
        const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
        
        // DEBUG: Log chat details
        console.log(`🔍 DEBUG: Chat type: ${msg.chat.type}, isCommand: ${isCommand}, isGroupChat: ${isGroupChat}, text: ${msg.text || 'no text'}`);
        
        // Handle commands (but don't count them as activity)
        if (isCommand) {
            const command = msg.text.split(' ')[0].substring(1);
            trackInteraction(userId, 'command', command);
            console.log(`🔧 Command /${command} from ${msg.from.first_name || 'Unknown'} (@${msg.from.username || 'no_username'}) - NO POINTS ADDED`);
            await handleCommand(msg, command);
            return; // Don't count commands as activity - EXIT HERE!
        }
        
        // Only track activity for group messages (not commands, not private messages)
        if (isGroupChat && !isCommand) {
            // Update user info only when counting activity
            updateUser(userId, {
                username: msg.from.username,
                firstName: msg.from.first_name
            });
            
            // Track interaction for analytics
            trackInteraction(userId, messageType);
            
            // Increment activity for leaderboard
            incrementUserActivity(userId, messageType);
            
            console.log(`📨 ${messageType} from ${msg.from.first_name || 'Unknown'} (@${msg.from.username || 'no_username'}) in group: ${msg.chat.title || 'Unknown Group'} - POINTS ADDED ✅`);
        } else if (!isGroupChat && !isCommand) {
            // Update user info for private messages but don't count activity
            updateUser(userId, {
                username: msg.from.username,
                firstName: msg.from.first_name
            });
            console.log(`💬 Private ${messageType} from ${msg.from.first_name || 'Unknown'} (not counted for leaderboard) - NO POINTS ADDED`);
        } else {
            console.log(`🚫 Message ignored - isGroupChat: ${isGroupChat}, isCommand: ${isCommand} - NO POINTS ADDED`);
        }
        
    } catch (error) {
        console.error('❌ Message handling error:', error.message);
    }
});

// Command handlers
async function handleCommand(msg, command) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    switch (command) {
        case 'start':
            await bot.sendMessage(chatId, 
                `🎉 Welcome to the Activity Tracker Bot!

` +
                `I track messages and stickers to create rankings.

` +
                `📊 Use /rankings to see rankings
` +
                `📈 Use /myprogress to see your progress
` +
                `ℹ️ Use /help for more commands`
            );
            break;
            
        case 'help':
            await bot.sendMessage(chatId,
                `🤖 **Bot Commands**\n\n` +
                `**🏆 Rankings & Progress:**\n` +
                `🏆 /rankings - View activity rankings\n` +
                `📊 /myprogress - Your personal progress\n` +
                `ℹ️ /info - Bot information\n\n` +
                `📈 /analytics - Bot analytics (admin)\n` +
                `💾 /backup - Create data backup (admin)\n` +
                `🔄 /save - Force save data\n\n` +
                `Just send messages and stickers to participate in the leaderboard!`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'rankings':
            try {
                console.log('Fetching leaderboard...');
                const leaderboard = getLeaderboard(10);
                console.log('Leaderboard data:', JSON.stringify(leaderboard, null, 2));
                
                if (leaderboard.length === 0) {
                    await bot.sendMessage(chatId, '📊 No activity recorded yet! Start chatting to appear on the rankings.');
                    return;
                }
                
                // Build a simple text-based leaderboard
                let message = '🏆 Activity Rankings\n\n';
                
                leaderboard.forEach(user => {
                    const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '🔹';
                    let name = user.firstName || user.username || `User ${user.id}`;
                    
                    // Remove any markdown characters
                    name = name.replace(/[\_*\[\]()~`>#+\-=\|{}.!]/g, '');
                    
                    message += `${medal} ${user.rank}. ${name}\n`;
                    message += `   💬 ${user.messageCount || 0} messages | 🎭 ${user.stickerCount || 0} stickers\n`;
                    message += `   📊 Total: ${user.totalActivity || 0} activities\n\n`;
                });
                
                console.log('Sending leaderboard message...');
                await bot.sendMessage(chatId, message);
                console.log('Leaderboard sent successfully');
                
            } catch (error) {
                console.error('❌ Error in rankings command:', error);
                await bot.sendMessage(chatId, '❌ Sorry, there was an error displaying the rankings. Please try again later.');
            }
            break;
            
        case 'myprogress':
            const user = getUser(userId);
            const rank = getLeaderboard().findIndex(u => u.id === userId) + 1;
            
            await bot.sendMessage(chatId,
                `📊 **Your Progress**\n\n` +
                `👤 Name: ${user.firstName || 'Unknown'}\n` +
                `🏆 Rank: ${rank > 0 ? `#${rank}` : 'Unranked'}\n` +
                `💬 Messages: ${user.messageCount}\n` +
                `🎭 Stickers: ${user.stickerCount}\n` +
                `📈 Total Activity: ${user.totalActivity}\n` +
                `📅 First Seen: ${new Date(user.firstSeen).toLocaleDateString()}\n` +
                `🕐 Last Seen: ${new Date(user.lastSeen).toLocaleString()}`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'info':
            const userData = getUserData();
            const analytics = getAnalytics();
            
            await bot.sendMessage(chatId,
                `ℹ️ **Bot Information**\n\n` +
                `🤖 Version: ${userData.metadata.version}\n` +
                `👥 Total Users: ${Object.keys(userData.users).length}\n` +
                `📊 Total Interactions: ${analytics.totalInteractions}\n` +
                `📅 Created: ${new Date(userData.metadata.created).toLocaleDateString()}\n` +
                `💾 Last Saved: ${userData.metadata.lastSaved ? new Date(userData.metadata.lastSaved).toLocaleString() : 'Never'}\n\n` +
                `🚀 Uptime: ${Math.floor(process.uptime() / 60)} minutes`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'analytics':
            const fullAnalytics = getAnalytics();
            const topCommands = Object.entries(fullAnalytics.commandUsage)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);
            
            let analyticsMsg = `📈 **Bot Analytics**\n\n`;
            analyticsMsg += `📊 Total Interactions: ${fullAnalytics.totalInteractions}\n\n`;
            
            analyticsMsg += `🎯 **Message Types:**\n`;
            Object.entries(fullAnalytics.messageTypes).forEach(([type, count]) => {
                if (count > 0) {
                    analyticsMsg += `   ${getTypeEmoji(type)} ${type}: ${count}\n`;
                }
            });
            
            if (topCommands.length > 0) {
                analyticsMsg += `\n🔧 **Top Commands:**\n`;
                topCommands.forEach(([cmd, count]) => {
                    analyticsMsg += `   /${cmd}: ${count}\n`;
                });
            }
            
            await bot.sendMessage(chatId, analyticsMsg, { parse_mode: 'Markdown' });
            break;
            
        case 'backup':
            const backupFile = createBackup();
            if (backupFile) {
                await bot.sendMessage(chatId, `💾 Backup created successfully!\n📁 ${backupFile}`);
            } else {
                await bot.sendMessage(chatId, '❌ Failed to create backup.');
            }
            break;
            
        case 'save':
            saveData();
            await bot.sendMessage(chatId, '💾 Data saved successfully!');
            break;
            
        default:
            // Only respond to unknown commands in private chats, ignore in groups
            if (msg.chat.type === 'private') {
                await bot.sendMessage(chatId, '❓ Unknown command. Use /help to see available commands.');
            }
            // Silently ignore unknown commands in groups (they might be for other bots)
    }
}

// Helper functions
function getMessageType(msg) {
    if (msg.sticker) return 'sticker';
    if (msg.photo) return 'photo';
    if (msg.video) return 'video';
    if (msg.document) return 'document';
    if (msg.voice) return 'voice';
    if (msg.text) return 'text';
    return 'other';
}

function getTypeEmoji(type) {
    const emojis = {
        text: '💬',
        sticker: '🎭',
        photo: '📷',
        video: '🎥',
        document: '📄',
        voice: '🎤',
        other: '❓'
    };
    return emojis[type] || '❓';
}

// Error handling
bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down bot...');
    saveData();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 Bot token: ${BOT_TOKEN.substring(0, 10)}...`);
    
    // Use polling in development
    console.log('🔄 Starting polling mode...');
    bot.startPolling({ restart: true });
});

console.log('🎉 Telegram Activity Tracker Bot started!');
console.log('📊 Features: Activity tracking, Leaderboards, Analytics, Backups, Rate limiting');
console.log('🔧 Ready to track user interactions!');

module.exports = { bot, app };

// ✅ Set the webhook
bot.setWebHook(`${WEBHOOK_URL}/webhook`);
console.log(`✅ Webhook set to: ${WEBHOOK_URL}/webhook`);
