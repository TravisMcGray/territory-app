// ========== AUTH FLOW TESTS ==========
// Exercises signup and login end to end against the real Express app and a
// real (in-memory) database. Email delivery is mocked so no network call is
// made and no real email is sent.

const request = require('supertest');

// Replace the Resend email client with a stub. jest.mock is hoisted above the
// requires below, so routes/auth.js picks up this mock when it loads.
jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: { send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }) },
    })),
}));

const app = require('../app');
const User = require('../models/user');
const { connect, clearDatabase, closeDatabase } = require('./helpers/db');

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

// Valid against all three validators: password strength, email format, and
// the profanity-aware username rules.
const validUser = {
    email: 'tester@example.com',
    password: 'TestPass123',
    username: 'Tester01',
};

describe('POST /api/auth/signup', () => {
    it('creates an unverified user and does not issue a token', async () => {
        const res = await request(app).post('/api/auth/signup').send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.requiresVerification).toBe(true);
        expect(res.body.token).toBeUndefined();

        const user = await User.findOne({ email: validUser.email });
        expect(user).not.toBeNull();
        expect(user.isEmailVerified).toBe(false);
    });

    it('rejects a weak password', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send({ ...validUser, password: 'weak' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PASSWORD_TOO_WEAK');
    });

    it('rejects a duplicate email', async () => {
        await request(app).post('/api/auth/signup').send(validUser);

        const res = await request(app)
            .post('/api/auth/signup')
            .send({ ...validUser, username: 'Tester02' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('EMAIL_IN_USE');
    });
});

describe('POST /api/auth/login', () => {
    it('blocks login until the email is verified', async () => {
        await request(app).post('/api/auth/signup').send(validUser);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('logs in a verified user and sets an httpOnly cookie', async () => {
        await request(app).post('/api/auth/signup').send(validUser);
        await User.updateOne({ email: validUser.email }, { isEmailVerified: true });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();

        const cookies = res.headers['set-cookie'];
        expect(cookies.some(c => c.startsWith('token=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('rejects an invalid password', async () => {
        await request(app).post('/api/auth/signup').send(validUser);
        await User.updateOne({ email: validUser.email }, { isEmailVerified: true });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: 'WrongPass123' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
});
