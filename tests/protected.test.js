// ========== PROTECTED ROUTE + DATA LEAK TESTS ==========
// Two security boundaries are exercised here:
//   1. authenticateToken: protected routes must reject missing, invalid, and
//      expired tokens, and accept a valid one (via cookie or Authorization).
//   2. Field exposure: a public profile must never leak private fields such as
//      email or weight to another user.

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the email client so requiring the routes never constructs a real Resend
// client or sends mail. None of the routes tested here send email.
jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: { send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }) },
    })),
}));

const app = require('../app');
const { connect, clearDatabase, closeDatabase } = require('./helpers/db');
const { createUser } = require('./helpers/auth');

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

describe('authenticateToken middleware (GET /api/user/profile)', () => {
    it('rejects a request with no token', async () => {
        const res = await request(app).get('/api/user/profile');

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('NO_TOKEN');
    });

    it('rejects an invalid token', async () => {
        const res = await request(app)
            .get('/api/user/profile')
            .set('Authorization', 'Bearer not-a-real-token');

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('rejects an expired token', async () => {
        const { user } = await createUser();
        // Negative expiresIn produces a token whose exp is already in the past.
        const expired = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: -10 }
        );

        const res = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${expired}`);

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('accepts a valid token sent as an httpOnly cookie', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .get('/api/user/profile')
            .set('Cookie', [`token=${token}`]);

        expect(res.status).toBe(200);
        expect(res.body.profile.username).toBe('AuthUser');
        expect(res.body.profile.tilesOwned).toBe(0);
    });

    it('accepts a valid token sent as a Bearer header (mobile path)', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.profile.username).toBe('AuthUser');
    });
});

describe('public profile does not leak private fields (GET /api/users/:userId)', () => {
    it('returns username but never email or weight', async () => {
        const { user: target } = await createUser({
            email: 'target@example.com',
            username: 'TargetUser',
            weight: 200,
        });
        const { token: viewerToken } = await createUser({
            email: 'viewer@example.com',
            username: 'ViewerUser',
        });

        const res = await request(app)
            .get(`/api/users/${target._id}`)
            .set('Authorization', `Bearer ${viewerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.username).toBe('TargetUser');
        // The leak guard: these private fields must be absent from a public view.
        expect(res.body.user.email).toBeUndefined();
        expect(res.body.user.weight).toBeUndefined();
    });
});
