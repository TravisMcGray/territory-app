const mongoose = require('mongoose');
require('dotenv').config();
const Achievement = require('../models/achievement');

const achievements = [
    // ========== WALKS: COMMON/LEGENDARY ==========
    {
        name: 'First Steps',
        description: 'Completed your first walk into the Hex',
        category: 'ACTIVITY',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalWalks',
            operator: '>=',
            value: 1
        },
        rarity: 'COMMON' 
    },
    {
        name: 'Rookie',
        description: 'Found and captured 10 hexagons',
        category: 'ACTIVITY',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 10
        },
        rarity: 'COMMON'
    },

    // ===== WALKS: UNCOMMON =====
    {
        name: 'Strider',
        description: 'Explore the hex by doing 20+ walks',
        category: 'ACTIVITY',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalWalks',
            operator: '>=',
            value: 20
        },
        rarity: 'UNCOMMON'
    },
    {
        name: 'Hex Capturer',
        description: 'Find and capture 50 hexagons',
        category: 'ACTIVITY',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 50
        },
        rarity: 'UNCOMMON'
    },

    // ===== WALKS: RARE =====
    {
        name: 'Territory Explorer',
        description: 'Capture 300+ hexagons while walking',
        category: 'TERRITORY',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 300
        },
        rarity: 'RARE'
    },
    {
        name: 'Pathfinder',
        description: 'Walk 100+ miles total',
        category: 'DISTANCE',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalDistance',
            operator: '>=',
            value: 100
        },
        rarity: 'RARE'
    },

    // ========== WALKS: LEGENDARY ==========
    {
        name: 'Hexagon Master',
        description: 'Capture 500+ hexagons while walking',
        category: 'TERRITORY',
        activityType: 'WALK',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 500
        },
        rarity: 'LEGENDARY'
    },

     // ========== RUNS: COMMON ==========
    {
        name: 'First Run',
        description: 'Complete your first run into the hex',
        category: 'ACTIVITY',
        activityType: 'RUN',
        condition: {
            field: 'stats.totalRuns',
            operator: '>=',
            value: 1
        },
        rarity: 'COMMON'
    },

    // ========== RUNS: UNCOMMON ==========
    {
        name: 'Hex Raider',
        description: 'Complete 10+ runs',
        category: 'ACTIVITY',
        activityType: 'RUN',
        condition: {
            field: 'stats.totalRuns',
            operator: '>=',
            value: 10
        },
        rarity: 'UNCOMMON'
    },

    // ========== RUNS: RARE ==========
    {
        name: 'Route Conqueror',
        description: 'Capture 100+ unique hexagons while running',
        category: 'TERRITORY',
        activityType: 'RUN',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 100
        },
        rarity: 'RARE'
    },

    // ========== RUNS: EPIC ==========
    {
        name: 'Territory Master',
        description: 'Capture 250+ hexagons in a single run',
        category: 'TERRITORY',
        activityType: 'RUN',
        condition: {
            field: 'singleActivityHexagons',
            operator: '>=',
            value: 250
        },
        rarity: 'EPIC'
    },

    // ========== RUNS: LEGENDARY ==========
    {
        name: 'Ultramarathoner',
        description: 'Run 26+ miles in a single activity',
        category: 'DISTANCE',
        activityType: 'RUN',
        condition: {
            field: 'singleActivityDistance',
            operator: '>=',
            value: 26
        },
        rarity: 'LEGENDARY'
    }
];

async function seedAchievements() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing achievements
        await Achievement.deleteMany({});
        console.log('Cleared existing achievements');

        // Insert new Achievements
        const created = await Achievement.insertMany(achievements);
        console.log(`\nSuccessfully seeded ${created.length} achievements!\n`);

        // Display by activity type and rarity
        console.log('========== WALK ACHIEVEMENTS ==========');
        const walkAchievements = created.filter(a => a.activityType === 'WALK');

        console.log('\n COMMON:');
        walkAchievements.filter(a => a.rarity === 'COMMON').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n UNCOMMON:');
        walkAchievements.filter(a => a.rarity === 'UNCOMMON').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n RARE:');
        walkAchievements.filter(a => a.rarity === 'RARE').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n LEGENDARY:');
        walkAchievements.filter(a => a.rarity === 'LEGENDARY').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('========== RUN ACHIEVEMENTS ==========');
        const runAchievements = created.filter(a => a.activityType === 'RUN');

        console.log('\n COMMON:');
        runAchievements.filter(a => a.rarity === 'COMMON').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n UNCOMMON:');
        runAchievements.filter(a => a.rarity === 'UNCOMMON').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n RARE:');
        runAchievements.filter(a => a.rarity === 'RARE').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n EPIC:');
        runAchievements.filter(a => a.rarity === 'EPIC').forEach(a => {
            console.log(`${a.name}`);
        });

        console.log('\n LEGENDARY:');
        runAchievements.filter(a => a.rarity === 'LEGENDARY').forEach(a => {
            console.log(`${a.name}`);
        });

        await mongoose.connection.close();
        console.log(`\n Seeding complete!\n`);

    } catch (error) {
        console.error('Error seeding achievements:', error.message);
        process.exit(1);
    }
}

seedAchievements();