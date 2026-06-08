// ========== JEST CONFIG (backend) ==========
// testEnvironment 'node' because this is a server, not a browser.
// setupFiles runs BEFORE each test file loads, so required env vars exist
// before any module reads process.env at require time (for example the
// JWT_SECRET check in middleware/auth.js, which exits the process if missing).

module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setup-env.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    // mongodb-memory-server may download a binary on first run, so allow extra time.
    testTimeout: 30000,
};
