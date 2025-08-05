# Telegram Activity Tracker Bot

Enterprise-ready Telegram bot that tracks user activity and creates leaderboards.

## Features

- 📊 **Activity Tracking** - Messages, stickers, photos, videos, and more
- 🏆 **Leaderboard System** - Real-time rankings based on user activity
- 📈 **Advanced Analytics** - Command usage, daily/hourly patterns, message types
- 💾 **Backup/Restore System** - Automated backups with rotation
- 🛡️ **Rate Limiting** - Protection against spam (30 requests/minute)
- 🔄 **Auto-Save** - Data automatically saved every 5 minutes
- 🌐 **Web API** - Health checks, analytics, and backup management endpoints

## Bot Commands

- `/start` - Welcome message and bot introduction
- `/help` - List all available commands
- `/leaderboard` - View activity rankings (top 10 users)
- `/stats` - Your personal statistics and rank
- `/info` - Bot information and system stats
- `/analytics` - Detailed bot analytics (admin)
- `/backup` - Create data backup (admin)
- `/save` - Force save data immediately

## Deployment

This bot is configured for deployment on **Render** with the included `render.yaml` file.

### Environment Variables Required:
- `BOT_TOKEN` - Your Telegram bot token from @BotFather
- `PORT` - Server port (default: 3000)
- `WEBHOOK_URL` - Your deployment URL (for production webhook mode)

## Local Development

1. Install dependencies: `npm install`
2. Set your bot token in `.env` file
3. Start the bot: `npm start`

## Data Storage

- User data stored in `userData.json`
- Automatic backups in `backups/` directory
- Data persists between restarts
- Auto-save every 5 minutes + on shutdown

## API Endpoints

- `GET /health` - Health check
- `GET /bot-status` - Bot information and stats
- `GET /analytics` - Analytics data
- `POST /create-backup` - Create backup
- `GET /list-backups` - List all backups
- `POST /restore-backup` - Restore from backup

## Version

2.0.0 - Enterprise Edition with advanced features
