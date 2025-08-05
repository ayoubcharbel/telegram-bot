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

console.log('🤖 Test bot is running...');

// Simple command handler
bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    console.log('Test command received from chat:', chatId);
    bot.sendMessage(chatId, '✅ Test bot is working!');
});

// Simple leaderboard command
bot.onText(/\/simpleleaderboard/, async (msg) => {
    const chatId = msg.chat.id;
    console.log('Simple leaderboard command received');
    
    try {
        // Create some test data
        const testData = [
            { rank: 1, name: 'Test User 1', messageCount: 10, stickerCount: 5, totalActivity: 15 },
            { rank: 2, name: 'Test User 2', messageCount: 8, stickerCount: 3, totalActivity: 11 },
            { rank: 3, name: 'Test User 3', messageCount: 5, stickerCount: 2, totalActivity: 7 }
        ];
        
        let message = '🏆 Simple Leaderboard\n\n';
        testData.forEach(user => {
            message += `${user.rank}. ${user.name}\n`;
            message += `   Messages: ${user.messageCount} | Stickers: ${user.stickerCount}\n`;
            message += `   Total: ${user.totalActivity}\n\n`;
        });
        
        console.log('Sending test leaderboard...');
        await bot.sendMessage(chatId, message);
        console.log('Test leaderboard sent successfully');
        
    } catch (error) {
        console.error('❌ Error in test leaderboard:', error);
        bot.sendMessage(chatId, '❌ Error: ' + error.message);
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
});

bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

console.log('✅ Bot is ready and waiting for commands...');
