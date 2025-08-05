const fs = require('fs');
const path = require('path');

// Data file paths
const DATA_FILE = path.join(__dirname, '..', 'userData.json');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Initialize data structure
let userData = {
    users: {},
    analytics: {
        totalInteractions: 0,
        commandUsage: {},
        dailyStats: {},
        hourlyStats: {},
        messageTypes: {
            text: 0,
            sticker: 0,
            photo: 0,
            video: 0,
            document: 0,
            voice: 0,
            other: 0
        }
    },
    metadata: {
        lastSaved: null,
        version: '2.0.0',
        created: new Date().toISOString()
    }
};

// Rate limiting storage
const rateLimits = new Map();

// Load existing data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            userData = { ...userData, ...data };
            console.log('✅ Data loaded successfully');
        } else {
            console.log('📁 No existing data file, starting fresh');
        }
    } catch (error) {
        console.error('❌ Error loading data:', error.message);
    }
}

// Save data to file
function saveData() {
    try {
        userData.metadata.lastSaved = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));
        console.log('💾 Data saved successfully');
    } catch (error) {
        console.error('❌ Error saving data:', error.message);
    }
}

// Auto-save every 5 minutes
setInterval(saveData, 5 * 60 * 1000);

// Rate limiting functions
function checkRateLimit(identifier, limit = 30, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimits.has(identifier)) {
        rateLimits.set(identifier, []);
    }
    
    const requests = rateLimits.get(identifier);
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= limit) {
        return false;
    }
    
    validRequests.push(now);
    rateLimits.set(identifier, validRequests);
    return true;
}

// Analytics functions
function trackInteraction(userId, type = 'message', command = null) {
    userData.analytics.totalInteractions++;
    
    // Track message types
    if (userData.analytics.messageTypes[type] !== undefined) {
        userData.analytics.messageTypes[type]++;
    } else {
        userData.analytics.messageTypes.other++;
    }
    
    // Track command usage
    if (command) {
        userData.analytics.commandUsage[command] = (userData.analytics.commandUsage[command] || 0) + 1;
    }
    
    // Track daily stats
    const today = new Date().toISOString().split('T')[0];
    userData.analytics.dailyStats[today] = (userData.analytics.dailyStats[today] || 0) + 1;
    
    // Track hourly stats
    const hour = new Date().getHours();
    userData.analytics.hourlyStats[hour] = (userData.analytics.hourlyStats[hour] || 0) + 1;
}

// User management functions
function getUser(userId) {
    if (!userData.users[userId]) {
        userData.users[userId] = {
            id: userId,
            messageCount: 0,
            stickerCount: 0,
            totalActivity: 0,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            username: null,
            firstName: null
        };
    }
    return userData.users[userId];
}

function updateUser(userId, updates) {
    const user = getUser(userId);
    Object.assign(user, updates);
    user.lastSeen = new Date().toISOString();
    user.totalActivity = user.messageCount + user.stickerCount;
}

function incrementUserActivity(userId, type = 'message') {
    const user = getUser(userId);
    if (type === 'sticker') {
        user.stickerCount++;
    } else {
        user.messageCount++;
    }
    user.totalActivity = user.messageCount + user.stickerCount;
    user.lastSeen = new Date().toISOString();
}

// Leaderboard functions
function getLeaderboard(limit = 10) {
    const users = Object.values(userData.users)
        .filter(user => user.totalActivity > 0)
        .sort((a, b) => b.totalActivity - a.totalActivity)
        .slice(0, limit);
    
    return users.map((user, index) => ({
        rank: index + 1,
        ...user
    }));
}

// Backup functions
function createBackup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
        
        const backupData = {
            ...userData,
            backupInfo: {
                created: new Date().toISOString(),
                version: userData.metadata.version
            }
        };
        
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        
        // Keep only last 10 backups
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('backup-'))
            .sort()
            .reverse();
        
        if (backups.length > 10) {
            backups.slice(10).forEach(file => {
                fs.unlinkSync(path.join(BACKUP_DIR, file));
            });
        }
        
        return backupFile;
    } catch (error) {
        console.error('❌ Error creating backup:', error.message);
        return null;
    }
}

function listBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            return [];
        }
        
        return fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('backup-'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    created: stats.birthtime.toISOString(),
                    size: stats.size
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
    } catch (error) {
        console.error('❌ Error listing backups:', error.message);
        return [];
    }
}

function restoreBackup(filename) {
    try {
        const backupFile = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(backupFile)) {
            return false;
        }
        
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        userData = backupData;
        saveData();
        
        return true;
    } catch (error) {
        console.error('❌ Error restoring backup:', error.message);
        return false;
    }
}

// Initialize data on module load
loadData();

// Export functions
module.exports = {
    // Data access
    getUserData: () => userData,
    getUsers: () => userData.users,
    getAnalytics: () => userData.analytics,
    
    // User functions
    getUser,
    updateUser,
    incrementUserActivity,
    
    // Leaderboard
    getLeaderboard,
    
    // Analytics
    trackInteraction,
    
    // Rate limiting
    checkRateLimit,
    
    // Data management
    saveData,
    loadData,
    
    // Backup functions
    createBackup,
    listBackups,
    restoreBackup
};