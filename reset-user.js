// reset-username.js
// Resets a user's username to a new value.
// Usage: node reset-username.js <currentUsername> <newUsername>
// Example: node reset-username.js baduser123 user_4821
//
// Bypasses the 100 hexagon requirement — admin only.
// Still enforces format rules and profanity filter.
// Sends a notification to the user so they know their username was changed.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const { validateUsername } = require('./middleware/profanity');

// Lazy-load notification model
let Notification;
try { Notification = require('./models/notification'); } catch {}

const [,, currentUsername, newUsername] = process.argv;

if (!currentUsername || !newUsername) {
    console.error('Usage: node reset-username.js <currentUsername> <newUsername>');
    process.exit(1);
}

async function resetUsername() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // ===== Step 1: Find the user =====
    const user = await User.findOne({ username: currentUsername });

    if (!user) {
        console.error(`❌ User "${currentUsername}" not found`);
        process.exit(1);
    }

    console.log('Found user:');
    console.log(`  Username : ${user.username}`);
    console.log(`  Email    : ${user.email}`);
    console.log(`  ID       : ${user._id}`);
    console.log('');

    // ===== Step 2: Validate new username =====
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
        console.error(`❌ New username invalid: ${validation.message}`);
        process.exit(1);
    }

    // ===== Step 3: Check new username isn't taken =====
    const existing = await User.findOne({ username: newUsername });
    if (existing && existing._id.toString() !== user._id.toString()) {
        console.error(`❌ Username "${newUsername}" is already taken`);
        process.exit(1);
    }

    // ===== Step 4: Confirm =====
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    await new Promise(resolve => {
        rl.question(`Change "${currentUsername}" → "${newUsername}"? Type YES to confirm: `, answer => {
            rl.close();
            if (answer !== 'YES') {
                console.log('Aborted.');
                process.exit(0);
            }
            resolve();
        });
    });

    // ===== Step 5: Update username =====
    const oldUsername = user.username;
    user.username = newUsername;
    user.usernameChangedAt = new Date();
    await user.save();
    console.log(`✅ Username changed: "${oldUsername}" → "${newUsername}"`);

    // ===== Step 6: Send notification to user =====
    // This tells them their username was changed when they next log in
    if (Notification) {
        try {
            await Notification.create({
                user: user._id,
                type: 'SYSTEM',
                title: 'Username Updated',
                message: `Your username has been updated to "${newUsername}" by a moderator. If you'd like to choose your own username, you can change it in your profile settings (requires 100 hexagons captured).`,
                read: false
            });
            console.log(`✅ Notification sent to user`);
        } catch (err) {
            console.log(`⚠️  Could not send notification: ${err.message}`);
        }
    }

    console.log(`\n✅ Done! User will see a notification on next login.`);
    process.exit(0);
}

resetUsername().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});