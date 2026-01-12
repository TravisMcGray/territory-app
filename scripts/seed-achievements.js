const mongoose = require('mongoose');
require('dotenv').config();
const Achievement = require('../models/achievement');

const achievements = [
    // Walk achievements
    {
        name: 'First walk',
        description: 'Log your first walk activity',
        type: 'WALK',
        condition: {
            field: 'stats.totalWalks',
            operator: '>=',
            value: 1
        },
        rarity: 'COMMON',
        points: 10
    },
    {
        name: 'Century Hiker',
        description: 'Walk 100+ miles total',
        type: 'DISTANCE',
        condition: {
            field: 'stats.totalDistance',
            operator: '>=',
            value: 100
        },
        rarity: 'RARE',
        points: 50
    },

    // Run achievements
    {
        name: 'Marathon Runner',
        description: 'Run 26+ miles in a single activity',
        type: 'RUN',
        condition: {
            field: 'singleActivityDistance',
            operator: '>=',
            value: 26
        },
        rarity: 'LEGENDARY',
        points: 100
    },

    // Territory achievements
    {
        name: 'Territory Conqueror',
        description: 'Capture 50+ hexagons',
        type: 'TERRITORY',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 50
        },
        rarity: 'RARE',
        points: 75
    },
    {
        name: 'Hexagon Master',
        description: 'Capture 100+ hexagons',
        type: 'TERRITORY',
        condition: {
            field: 'stats.totalHexagonsCaptured',
            operator: '>=',
            value: 100
        },
        rarity: 'LEGENDARY',
        points: 150
    },
    {
        name: 'Social Butterfly',
        description: 'Get 10+ followers',
        type: 'SOCIAL',
        condition: {
            field: 'followers',
            operator: '>=',
            value: 10
        },
        rarity: 'RARE',
        points: 40
    },

    // Distance achievements
    {
        name: 'Distance Demon',
        description: 'Walk/Run 10+ miles in a single activity',
        type: 'DISTANCE',
        condition: {
            field: 'singleActivityDistance',
            operator: '>=',
            value: 10
        },
        rarity: 'RARE',
        points: 60
    },

    // Activity achievements
    {
        name: 'Getting Active',
        description: 'Record 5+ activites total',
        type: 'ACTIVITY',
        condition: {
            field: 'totalActivities',
            operator: '>=',
            value: 5
        },
        rarity: 'COMMON',
        points: 25
    }
];

async function seedAchievements() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing achievements
        await Achievement.deleteMany({});
        console.log('Cleared existing achievements');

        // Insert new achievements
        const created = await Achievement.insertMany(achievements);
        console.log(`Successfully seeded ${created.length} achievements!`);

        created.forEach(achievement => {
            console.log(` - ${achievement.name} (${achievement.rarity})`);
        });

        await mongoose.connection.close();
        console.log('Seeding complete!');

    } catch (error) {
        console.error('Error seeding achievements:', error.message);
        process.exit(1);
    }
}

seedAchievements();