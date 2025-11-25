const JwtTokenProvider = require('../src/infrastructure/providers/JwtTokenProvider');

describe('JwtTokenProvider (unit)', () => {
  const OLD = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = OLD;
  });

  test('generate and verify token', () => {
    const provider = new JwtTokenProvider();
    const token = provider.generate({ id: 'user1' });
    expect(typeof token).toBe('string');
    const decoded = provider.verify(token);
    expect(decoded).toHaveProperty('id', 'user1');
  });

  test('throws when secret missing', () => {
    const old = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const provider = new JwtTokenProvider();
    expect(() => provider.generate({})).toThrow();
    expect(() => provider.verify('x')).toThrow();
    process.env.JWT_SECRET = old;
  });
});
