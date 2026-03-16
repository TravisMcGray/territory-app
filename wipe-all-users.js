// wipe-all-users.js
// Deletes ALL users, territories, activities, comments, kudos, notifications, and achievements.
// Run this ONCE before deploying the new verification system.
// Usage: node wipe-all-users.js

require('dotenv').config();
const mongoose = require('mongoose');

async function wipeAll() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    await new Promise(resolve => {
        rl.question('⚠️  This will DELETE EVERYTHING permanently. Type WIPE to confirm: ', answer => {
            rl.close();
            if (answer !== 'WIPE') {
                console.log('Aborted.');
                process.exit(0);
            }
            resolve();
        });
    });

    const collections = [
        'users',
        'territories',
        'activities',
        'activitycomments',
        'activitykudos',
        'notifications',
        'achievements',
    ];

    for (const name of collections) {
        try {
            const result = await mongoose.connection.collection(name).deleteMany({});
            console.log(`✅ ${name}: ${result.deletedCount} documents deleted`);
        } catch (err) {
            console.log(`⚠️  ${name}: skipped (${err.message})`);
        }
    }

    console.log('\n🗑️  Everything wiped. Fresh start ready.');
    process.exit(0);
}

wipeAll().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});