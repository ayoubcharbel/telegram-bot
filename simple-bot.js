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

// Initialize database first, then start the bot
async function initializeApp() {
  try {
    console.log('🚀 Starting bot initialization...');
    
    // Initialize database
    console.log('🔄 Initializing database...');
    await db.initDB();
    
    // Start the bot
    console.log('🤖 Starting bot polling...');
    await startPolling();
    
    console.log('✅ Bot is now running!');
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
}

// Start the application
initializeApp();

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
        console.log('📊 Fetching leaderboard...');
        
        // Test database connection first
        try {
            await db.pool.query('SELECT 1');
            console.log('✅ Database connection test successful');
        } catch (dbError) {
            console.error('❌ Database connection error:', dbError);
            throw new Error(`Database connection failed: ${dbError.message}`);
        }
        
        const leaderboard = await db.getLeaderboard(10);
        console.log('📋 Leaderboard data:', JSON.stringify(leaderboard, null, 2));
        
        if (!leaderboard || leaderboard.length === 0) {
            console.log('ℹ️ No leaderboard data found');
            await bot.sendMessage(chatId, '📊 No activity recorded yet! Send me a message first.');
            return;
        }
        
        let message = '🏆 *Leaderboard*\n\n';
        
        leaderboard.forEach((user) => {
            try {
                const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '🔹';
                const name = user.first_name || user.last_name || `User ${user.id}`;
                const username = user.username ? `(@${user.username})` : '';
                const total = (user.message_count || 0) + (user.sticker_count || 0);
                
                message += `${medal} *${user.rank}.* ${name} ${username}\n`;
                message += `   💬 ${user.message_count || 0} messages | 🎭 ${user.sticker_count || 0} stickers\n`;
                message += `   📊 Total: ${total}\n\n`;
            } catch (formatError) {
                console.error('Error formatting user entry:', formatError);
                console.error('Problematic user data:', JSON.stringify(user, null, 2));
            }
        });
        
        // Add timestamp
        message += `\n_Last updated: ${new Date().toLocaleString()}_`;
        
        await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('❌ Error in /rankings command:', error);
        const errorMessage = error.message || 'Unknown error occurred';
        
        // Send detailed error to admin (you)
        if (process.env.ADMIN_CHAT_ID) {
            await bot.sendMessage(
                process.env.ADMIN_CHAT_ID,
                `❌ Leaderboard Error:\n${errorMessage}\n\nStack Trace:\n${error.stack}`
            );
        }
        
        // Send user-friendly error
        await bot.sendMessage(
            chatId,
            '⚠️ Oops! Something went wrong while fetching the leaderboard. ' +
            'The issue has been reported. Please try again later.'
        );
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
