/**
 * @jest-environment node
 */
import { GET } from './route';
import { db } from '@/db';

jest.mock('@/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

const mockedExecute = db.execute as jest.MockedFunction<typeof db.execute>;

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 200 con db "up" cuando la base responde', async () => {
    mockedExecute.mockResolvedValue([] as never);

    const response = await GET();
    const body = (await response.json()) as {
      ok: boolean;
      db: string;
      now: string;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
    expect(body.now).toBeDefined();
  });

  test('devuelve 503 con db "down" cuando la base falla', async () => {
    mockedExecute.mockRejectedValue(new Error('connection refused'));

    const response = await GET();
    const body = (await response.json()) as { ok: boolean; db: string };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.db).toBe('down');
  });
});
