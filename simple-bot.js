require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Initialize express for health checks
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required in environment variables');
    process.exit(1);
}

// Initialize bot with polling
console.log('🤖 Starting simple bot...');
const bot = new TelegramBot(BOT_TOKEN, {
    polling: true,
    request: {
        proxy: process.env.PROXY || null
    }
});

// Handle bot errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);    
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

console.log('✅ Bot initialized with polling');

// Simple storage for user activity
const users = new Map();

// Helper function to get user display name
function getUserDisplayName(user) {
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    }
    return user.first_name || user.username || `User ${user.id}`;
}

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userId = user.id;
    const name = user.first_name || 'there';
    
    // Initialize user if not exists
    if (!users.has(userId)) {
        users.set(userId, {
            messages: 0,
            stickers: 0,
            username: user.username || '',
            firstName: user.first_name || '',
            lastName: user.last_name || ''
        });
    } else {
        // Update user info if exists
        const userData = users.get(userId);
        userData.username = user.username || userData.username;
        userData.firstName = user.first_name || userData.firstName;
        userData.lastName = user.last_name || userData.lastName;
    }
    
    bot.sendMessage(chatId, `👋 Hello ${name}! I'm your activity tracker bot.\n\n` +
        '📊 Use /rankings to see the leaderboard\n' +
        '📈 Use /myprogress to see your stats\n' +
        '💬 Send me messages or stickers!');
});

// Handle /myprogress command
bot.onText(/\/myprogress/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!users.has(userId)) {
        bot.sendMessage(chatId, "You haven't sent any messages or stickers yet!");
        return;
    }
    
    const user = users.get(userId);
    const name = user.firstName || `User ${userId}`;
    const total = user.messages + user.stickers;
    
    let message = `📊 *Your Activity Stats*\n\n`;
    message += `👤 *Name:* ${name}\n`;
    if (user.username) message += `🔗 *Username:* @${user.username}\n`;
    message += `\n📈 *Activity Summary*\n`;
    message += `💬 *Messages:* ${user.messages}\n`;
    message += `🎭 *Stickers:* ${user.stickers}\n`;
    message += `🏆 *Total Activity:* ${total}`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Handle /rankings command
bot.onText(/\/rankings/, (msg) => {
    const chatId = msg.chat.id;
    
    if (users.size === 0) {
        bot.sendMessage(chatId, '📊 No activity recorded yet! Send me a message first.');
        return;
    }
    
    // Create leaderboard
    const leaderboard = Array.from(users.entries())
        .map(([userId, data]) => ({
            userId,
            ...data,
            total: data.messages + data.stickers
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    
    let message = '🏆 *Leaderboard*\n\n';
    leaderboard.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
        const name = user.firstName || `User ${user.userId}`;
        
        message += `${medal} *${index + 1}.* ${name}`;
        if (user.username) message += ` (@${user.username})`;
        message += `\n`;
        message += `   💬 ${user.messages} messages | 🎭 ${user.stickers} stickers\n`;
        message += `   📊 Total: ${user.total}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Track messages
bot.on('message', (msg) => {
    // Skip commands
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = msg.from.id;
    const userInfo = msg.from;
    
    // Initialize user if not exists
    if (!users.has(userId)) {
        users.set(userId, {
            messages: 0,
            stickers: 0,
            username: userInfo.username || '',
            firstName: userInfo.first_name || '',
            lastName: userInfo.last_name || ''
        });
    } else {
        // Update user info if exists
        const user = users.get(userId);
        user.username = userInfo.username || user.username;
        user.firstName = userInfo.first_name || user.firstName;
        user.lastName = userInfo.last_name || user.lastName;
    }
    
    const user = users.get(userId);
    
    // Count messages and stickers
    if (msg.sticker) {
        user.stickers += 1;
    } else if (msg.text) {
        user.messages += 1;
    }
    
    const name = user.firstName || `User ${userId}`;
    console.log(`📝 Activity: ${name} - Messages: ${user.messages}, Stickers: ${user.stickers}`);
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

console.log('✅ Bot is running!');
