// ========== SERVER ENTRY POINT ==========
// The only file that produces side effects: it loads environment variables,
// connects to MongoDB, and starts the HTTP listener. The app itself is built
// in app.js so that tests can import it without booting a server or a database.

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

// ========== DATABASE ==========
connectDB();

// ========== START ==========
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
