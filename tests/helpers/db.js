// ========== IN-MEMORY TEST DATABASE ==========
// Spins up a real MongoDB instance in RAM for the duration of a test run.
// Tests get a genuine database to read and write, but it is disposable and
// never connects to Atlas or any production data.
//
// Usage in a test file:
//   beforeAll(connect);
//   afterEach(clearDatabase);
//   afterAll(closeDatabase);

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// Start the in-memory server and point Mongoose at it.
const connect = async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
};

// Wipe every collection between tests so each test starts from a clean slate.
const clearDatabase = async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
};

// Tear everything down so Jest can exit cleanly with no open handles.
const closeDatabase = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongod) await mongod.stop();
};

module.exports = { connect, clearDatabase, closeDatabase };
