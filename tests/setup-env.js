// ========== TEST ENVIRONMENT VARIABLES ==========
// Loaded by jest.config.js (setupFiles) before any application module is
// required. This guarantees JWT_SECRET exists so middleware/auth.js does not
// call process.exit during a test run, and pins NODE_ENV to 'test' so the
// app uses non-production cookie settings and never emits stack traces.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long-000';
