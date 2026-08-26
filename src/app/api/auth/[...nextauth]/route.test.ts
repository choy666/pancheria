import { NextRequest } from 'next/server';
import { GET, POST } from './route';

jest.mock('@/auth', () => ({
  handlers: {
    GET: jest.fn().mockResolvedValue(new Response('GET auth')),
    POST: jest.fn().mockResolvedValue(new Response('POST auth')),
  },
}));

describe('Auth handlers', () => {
  test('exporta GET delegando a NextAuth', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signin');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  test('exporta POST delegando a NextAuth', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
