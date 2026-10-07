/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

const ORIGINAL_ENV = { ...process.env };
const fetchMock = jest.fn();

beforeAll(() => {
  process.env.CRON_SECRET = 'secreto-cron';
  process.env.NOTIFY_WEBHOOK_URL = 'https://ntfy.example.com/topic';
  process.env.NTFY_TOKEN = 'tk_test';
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function buildRequest(body: unknown, authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/alert', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/cron/alert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  test('devuelve 401 sin bearer token', async () => {
    const response = await POST(buildRequest({ message: 'x' }));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rechaza payloads sin message', async () => {
    const response = await POST(
      buildRequest({ title: 'solo titulo' }, 'Bearer secreto-cron')
    );
    const body = (await response.json()) as { delivered: boolean };

    expect(response.status).toBe(200);
    expect(body.delivered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reenvia el mensaje a ntfy con headers formateados', async () => {
    const response = await POST(
      buildRequest(
        {
          title: 'Panchería caída',
          message: 'health check devolvio 503',
          priority: 5,
          tags: ['rotating_light'],
          click: 'https://pancheria-alpha.vercel.app/api/health',
        },
        'Bearer secreto-cron'
      )
    );
    const body = (await response.json()) as {
      delivered: boolean;
      upstreamStatus: number;
    };

    expect(body).toEqual({ ok: true, delivered: true, upstreamStatus: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ntfy.example.com/topic',
      expect.objectContaining({
        method: 'POST',
        body: 'health check devolvio 503',
        headers: expect.objectContaining({
          Title: `=?UTF-8?B?${Buffer.from('Panchería caída', 'utf8').toString('base64')}?=`,
          Priority: '5',
          Tags: 'rotating_light',
          Click: 'https://pancheria-alpha.vercel.app/api/health',
          Authorization: 'Bearer tk_test',
        }),
      })
    );
  });

  test('ignora click que no sea https', async () => {
    await POST(
      buildRequest(
        { message: 'caida', click: 'javascript:alert(1)' },
        'Bearer secreto-cron'
      )
    );

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Click).toBeUndefined();
  });

  test('reporta delivered:false cuando ntfy responde error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    const response = await POST(
      buildRequest({ message: 'caida' }, 'Bearer secreto-cron')
    );
    const body = (await response.json()) as {
      delivered: boolean;
      upstreamStatus: number;
    };

    expect(body).toEqual({ ok: true, delivered: false, upstreamStatus: 429 });
  });
});
