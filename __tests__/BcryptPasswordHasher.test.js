const BcryptPasswordHasher = require('../src/infrastructure/providers/BcryptPasswordHasher');

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (p, s) => `hashed-${p}`),
  compare: jest.fn(async (plain, hash) => hash === `hashed-${plain}`),
}));

describe('BcryptPasswordHasher (unit)', () => {
  test('hash and compare work together', async () => {
    const hasher = new BcryptPasswordHasher();
    const pw = 'secret';
    const h = await hasher.hash(pw);
    expect(typeof h).toBe('string');
    const ok = await hasher.compare(pw, h);
    expect(ok).toBe(true);
    const bad = await hasher.compare('nope', h);
    expect(bad).toBe(false);
  });
});
