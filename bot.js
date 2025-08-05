require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const {
    getUser,
    updateUser,
    incrementUserActivity,
    getLeaderboard,
    trackInteraction,
    checkRateLimit,
    saveData,
    getUserData,
    getAnalytics,
    createBackup,
    listBackups,
    restoreBackup
} = require('./api/_shared-data');

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://your-app.onrender.com`;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required in environment variables');
    process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN);
const app = express();

// Middleware
app.use(express.json());

// Rate limiting middleware
app.use('/webhook', (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!checkRateLimit(clientIP, 30, 60000)) {
        console.log(`🚫 Rate limit exceeded for IP: ${clientIP}`);
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    next();
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook error:', error.message);
        res.sendStatus(500);
    }
});

// Fallback webhook endpoints
app.post('/webhook/telegram', (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Telegram webhook error:', error.message);
        res.sendStatus(500);
    }
});

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
        
        // Track interaction
        trackInteraction(userId, messageType);
        
        // Update user info
        updateUser(userId, {
            username: msg.from.username,
            firstName: msg.from.first_name
        });
        
        // Increment activity
        incrementUserActivity(userId, messageType);
        
        console.log(`📨 ${messageType} from ${msg.from.first_name || 'Unknown'} (@${msg.from.username || 'no_username'})`);
        
        // Handle commands
        if (msg.text && msg.text.startsWith('/')) {
            const command = msg.text.split(' ')[0].substring(1);
            trackInteraction(userId, 'command', command);
            await handleCommand(msg, command);
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
                `🎉 Welcome to the Activity Tracker Bot!\n\n` +
                `I track messages and stickers to create leaderboards.\n\n` +
                `📊 Use /leaderboard to see rankings\n` +
                `📈 Use /stats to see your statistics\n` +
                `ℹ️ Use /help for more commands`
            );
            break;
            
        case 'help':
            await bot.sendMessage(chatId,
                `🤖 **Bot Commands**\n\n` +
                `🏆 /leaderboard - View activity rankings\n` +
                `📊 /stats - Your personal statistics\n` +
                `ℹ️ /info - Bot information\n` +
                `📈 /analytics - Bot analytics (admin)\n` +
                `💾 /backup - Create data backup (admin)\n` +
                `🔄 /save - Force save data\n\n` +
                `Just send messages and stickers to participate in the leaderboard!`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'leaderboard':
            const leaderboard = getLeaderboard(10);
            if (leaderboard.length === 0) {
                await bot.sendMessage(chatId, '📊 No activity recorded yet! Start chatting to appear on the leaderboard.');
            } else {
                let message = '🏆 **Activity Leaderboard**\n\n';
                leaderboard.forEach(user => {
                    const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '🏅';
                    const name = user.firstName || user.username || `User ${user.id}`;
                    message += `${medal} **${user.rank}.** ${name}\n`;
                    message += `   💬 ${user.messageCount} messages | 🎭 ${user.stickerCount} stickers\n`;
                    message += `   📊 Total: ${user.totalActivity} activities\n\n`;
                });
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
            break;
            
        case 'stats':
            const user = getUser(userId);
            const rank = getLeaderboard().findIndex(u => u.id === userId) + 1;
            
            await bot.sendMessage(chatId,
                `📊 **Your Statistics**\n\n` +
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
            await bot.sendMessage(chatId, '❓ Unknown command. Use /help to see available commands.');
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
    
    // Set webhook in production
    if (process.env.NODE_ENV === 'production' && WEBHOOK_URL) {
        bot.setWebHook(`${WEBHOOK_URL}/webhook`)
            .then(() => console.log('✅ Webhook set successfully'))
            .catch(err => console.error('❌ Webhook error:', err.message));
    } else {
        // Use polling in development
        console.log('🔄 Starting polling mode...');
        bot.startPolling({ restart: true });
    }
});

console.log('🎉 Telegram Activity Tracker Bot started!');
console.log('📊 Features: Activity tracking, Leaderboards, Analytics, Backups, Rate limiting');
console.log('🔧 Ready to track user interactions!');

module.exports = { bot, app };