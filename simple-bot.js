require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const db = require('./db');

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

// Bot configuration with instance tracking
console.log('🤖 Starting simple bot...');

// Track if we're the active instance
let isActiveInstance = false;
let pollingInterval = null;
const INSTANCE_CHECK_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 5;
let retryCount = 0;

// Create bot instance without auto-polling
const bot = new TelegramBot(BOT_TOKEN, {
    polling: false, // We'll handle polling manually
    request: {
        proxy: process.env.PROXY || null
    }
});

// Function to safely stop polling
const stopPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    bot.stopPolling();
    isActiveInstance = false;
    console.log('🛑 Polling stopped');
};

// Handle bot errors
bot.on('polling_error', (error) => {
    console.error('🔴 Polling error:', error.message);
    if (error.code === 409) {
        console.log('⚠️  Conflict detected - another instance might be running');
        isActiveInstance = false;
        retryCount++;
        
        if (retryCount >= MAX_RETRIES) {
            console.error(`❌ Max retries (${MAX_RETRIES}) reached. Giving up.`);
            process.exit(1);
        }
    }
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('🔴 Unhandled promise rejection:', error);
});

// Clean up on exit
process.on('SIGINT', stopPolling);
process.on('SIGTERM', stopPolling);

// Function to start polling with safety checks
const startPolling = async () => {
    try {
        console.log('🔄 Attempting to start polling...');
        
        // Stop any existing polling
        stopPolling();
        
        // Start a new polling instance
        await bot.startPolling({
            restart: true,
            polling: {
                interval: 300, // ms between polling requests
                autoStart: true,
                params: {
                    timeout: 60,
                    limit: 100,
                    allowed_updates: ['message', 'callback_query']
                }
            }
        });
        
        isActiveInstance = true;
        retryCount = 0;
        console.log('✅ Successfully started polling');
        
        // Periodically check if we're still the active instance
        pollingInterval = setInterval(() => {
            if (!isActiveInstance) {
                console.log('⚠️  Lost active instance status, stopping polling...');
                stopPolling();
                process.exit(0);
            }
        }, INSTANCE_CHECK_INTERVAL);
        
    } catch (error) {
        console.error('❌ Failed to start polling:', error.message);
        
        if (retryCount < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff
            console.log(`🔄 Retrying in ${delay/1000} seconds... (${retryCount + 1}/${MAX_RETRIES})`);
            setTimeout(startPolling, delay);
            retryCount++;
        } else {
            console.error(`❌ Max retries (${MAX_RETRIES}) reached. Exiting.`);
            process.exit(1);
        }
    }
};

// Start the bot
startPolling().catch(console.error);

// Initialize database
db.initDB().catch(console.error);

// Helper function to get user display name
function getUserDisplayName(user) {
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    }
    return user.first_name || user.username || `User ${user.id}`;
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const name = user.first_name || 'there';
    
    try {
        // Create or update user in database
        await db.createOrUpdateUser(user);
        
        await bot.sendMessage(chatId, `👋 Hello ${name}! I'm your activity tracker bot.\n\n` +
            '📊 Use /rankings to see the leaderboard\n' +
            '📈 Use /myprogress to see your stats\n' +
            '💬 Send me messages or stickers!');
    } catch (error) {
        console.error('Error in /start command:', error);
        await bot.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
    }
});

// Handle /myprogress command
bot.onText(/\/myprogress/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const user = await db.getUser(userId);
        
        if (!user) {
            await bot.sendMessage(chatId, "You haven't sent any messages or stickers yet!");
            return;
        }
        
        const name = user.first_name || `User ${userId}`;
        const total = user.message_count + user.sticker_count;
        
        let message = `📊 *Your Activity Stats*\n\n`;
        message += `👤 *Name:* ${name}\n`;
        if (user.username) message += `🔗 *Username:* @${user.username}\n`;
        message += `\n📈 *Activity Summary*\n`;
        message += `💬 *Messages:* ${user.message_count}\n`;
        message += `🎭 *Stickers:* ${user.sticker_count}\n`;
        message += `🏆 *Total Activity:* ${total}\n`;
        message += `⏱️ *Last Active:* ${new Date(user.last_activity).toLocaleString()}`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /myprogress command:', error);
        await bot.sendMessage(chatId, '⚠️ An error occurred while fetching your stats.');
    }
});

// Handle /rankings command
bot.onText(/\/rankings/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const leaderboard = await db.getLeaderboard(10);
        
        if (leaderboard.length === 0) {
            await bot.sendMessage(chatId, '📊 No activity recorded yet! Send me a message first.');
            return;
        }
        
        let message = '🏆 *Leaderboard*\n\n';
        leaderboard.forEach((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
            const name = user.first_name || `User ${user.id}`;
            
            message += `${medal} *${user.rank}.* ${name}`;
            if (user.username) message += ` (@${user.username})`;
            message += `\n`;
            message += `   💬 ${user.message_count} messages | 🎭 ${user.sticker_count} stickers\n`;
            message += `   📊 Total: ${user.total_activity}\n\n`;
        });
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in /rankings command:', error);
        await bot.sendMessage(chatId, '⚠️ An error occurred while fetching the leaderboard.');
    }
});

// Track messages
bot.on('message', async (msg) => {
    // Skip commands
    if (msg.text && msg.text.startsWith('/')) return;
    
    const user = msg.from;
    
    try {
        // Create or update user in database
        await db.createOrUpdateUser(user);
        
        // Update activity count
        if (msg.sticker) {
            await db.incrementStickerCount(user.id);
        } else if (msg.text) {
            await db.incrementMessageCount(user.id);
        }
        
        const name = user.first_name || `User ${user.id}`;
        console.log(`📝 Activity: ${name} - ${msg.sticker ? 'Sticker' : 'Message'} sent`);
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

console.log('✅ Bot is running!');
