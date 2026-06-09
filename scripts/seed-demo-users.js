// ========== SEED DEMO USERS ==========
// Creates three fake players with clustered territory in different states so the
// map looks alive for demos (and screenshots/recordings) without exposing the
// real user's location.
//
//   node scripts/seed-demo-users.js          seed (or top up) the demo users
//   node scripts/seed-demo-users.js --clean  remove the demo users + their tiles
//
// Identified by the fixed emails in DEMO_USERS, so --clean removes exactly these
// three and nothing else. Idempotent: re-running seed skips users/hexes that
// already exist (territory hexagonId is globally unique).

require('dotenv').config();
const mongoose = require('mongoose');
const { latLngToCell, gridDisk } = require('h3-js');
const User = require('../models/user');
const Territory = require('../models/territory');

// Must match the app's capture resolution (H3_RESOLUTION in the frontend).
const H3_RES = 10;

// Throwaway password: valid for the schema (>= 8 chars), never used to log in.
const PASSWORD = 'DemoSeed!2026';

// Tier color the map shows is driven by a tile's capture count (timesVisited):
// 1-3 green (T1), 4-6 blue (T2), 7-9 gold (T3), 10+ pink (T4). tierMin/tierMax
// keep every tile inside one band, so a player's whole cluster renders a single
// tier color.
const DEMO_USERS = [
    { email: 'seed-co@hexcapture.com', username: 'RidgelineRoamer', city: 'Denver, CO',       center: [39.7392, -104.9903], count: 38, tierMin: 7,  tierMax: 9,  activity: 'RUN'  }, // T3 gold
    { email: 'seed-in@hexcapture.com', username: 'HoosierHustle',   city: 'Indianapolis, IN', center: [39.7684, -86.1581],  count: 24, tierMin: 4,  tierMax: 6,  activity: 'WALK' }, // T2 blue
    { email: 'seed-ca@hexcapture.com', username: 'PacificPacer',    city: 'San Diego, CA',    center: [32.7157, -117.1611], count: 55, tierMin: 10, tierMax: 14, activity: 'RUN'  }, // T4 pink
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// A contiguous cluster of `count` hex ids around a lat/lng center.
function hexCluster([lat, lng], count) {
    const center = latLngToCell(lat, lng, H3_RES);
    let k = 1;
    let cells = gridDisk(center, k);
    while (cells.length < count) {
        k += 1;
        cells = gridDisk(center, k);
    }
    return cells.slice(0, count);
}

async function seed() {
    for (const d of DEMO_USERS) {
        let user = await User.findOne({ email: d.email });
        if (!user) {
            user = await User.create({
                email: d.email,
                password: PASSWORD,
                username: d.username,
                isEmailVerified: true,
                stats: {
                    totalHexagonsCaptured: d.count,
                    totalRuns: d.activity === 'RUN' ? 5 : 0,
                    totalWalks: d.activity === 'WALK' ? 5 : 0,
                },
            });
            console.log(`Created user ${d.username} (${d.city})`);
        } else {
            console.log(`User ${d.username} already exists, reusing`);
        }

        // Wipe this demo user's existing tiles so re-seeding applies fresh values.
        await Territory.deleteMany({ ownerId: user._id });

        const cells = hexCluster(d.center, d.count);
        let inserted = 0;
        for (const hexagonId of cells) {
            try {
                await Territory.create({
                    hexagonId,
                    ownerId: user._id,
                    ownerActivityType: d.activity,
                    // Every tile sits inside the same tier band, so the whole
                    // cluster renders one tier color.
                    timesVisited: rand(d.tierMin, d.tierMax),
                    capturedAt: new Date(Date.now() - rand(0, 60) * 86400000),
                });
                inserted += 1;
            } catch (err) {
                if (err.code !== 11000) throw err; // ignore hexes owned by a real user
            }
        }

        // Keep the profile stat honest about how many tiles are actually owned.
        const owned = await Territory.countDocuments({ ownerId: user._id });
        user.stats.totalHexagonsCaptured = owned;
        await user.save();
        console.log(`  ${d.username}: ${inserted} hexes, all tier band ${d.tierMin}-${d.tierMax} (${owned} total)`);
    }
}

async function clean() {
    for (const d of DEMO_USERS) {
        const user = await User.findOne({ email: d.email });
        if (!user) {
            console.log(`${d.username} not found, skipping`);
            continue;
        }
        const { deletedCount } = await Territory.deleteMany({ ownerId: user._id });
        await User.deleteOne({ _id: user._id });
        console.log(`Removed ${d.username} and ${deletedCount} territories`);
    }
}

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI not set in .env');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const cleaning = process.argv.includes('--clean');
    if (cleaning) {
        console.log('Cleaning demo users...');
        await clean();
    } else {
        console.log('Seeding demo users...');
        await seed();
    }

    await mongoose.connection.close();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Seed script failed:', err);
    process.exit(1);
});
