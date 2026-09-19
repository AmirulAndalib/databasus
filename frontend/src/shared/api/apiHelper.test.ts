import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_ERROR_CODES, type ApiError } from './ApiError';
import { apiHelper } from './apiHelper';

const REPEAT_TRIES_COUNT = 30;
const REPEAT_INTERVAL_MS = 3_000;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Compared by name rather than instanceof: the retry tests load a fresh copy of the module graph.
const catchError = async (request: Promise<unknown>): Promise<ApiError> => {
  try {
    await request;
  } catch (e) {
    if (e instanceof Error && e.name === 'ApiError') {
      return e as ApiError;
    }
    throw e;
  }
  throw new Error('request did not fail');
};

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('apiHelper failures, first try is the last', () => {
  it('turns a fetch rejection into network_unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await catchError(apiHelper.fetchGetJson('/api/v1/x'));

    expect(error.code).toBe(API_ERROR_CODES.networkUnreachable);
    expect(error.status).toBeUndefined();
    expect(error.message).toBe('');
  });

  it('turns a 502 into request_failed with its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));

    const error = await catchError(apiHelper.fetchGetJson('/api/v1/x'));

    expect(error.code).toBe(API_ERROR_CODES.requestFailed);
    expect(error.status).toBe(502);
    expect(error.message).toBe('');
  });

  it('turns a 500 without a JSON body into request_failed with its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));

    const error = await catchError(apiHelper.fetchPostJson('/api/v1/x'));

    expect(error.code).toBe(API_ERROR_CODES.requestFailed);
    expect(error.status).toBe(500);
    expect(error.message).toBe('');
  });

  it('keeps the code, message and status of a JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { message: 'bad host', code: 'host_unreachable' })),
    );

    const error = await catchError(apiHelper.fetchPostJson('/api/v1/x'));

    expect(error.code).toBe('host_unreachable');
    expect(error.message).toBe('bad host');
    expect(error.status).toBe(400);
  });

  it('keeps an error without code or message empty rather than filling in the URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, {})));

    const error = await catchError(apiHelper.fetchGetJson('/api/v1/x'));

    expect(error.code).toBeUndefined();
    expect(error.message).toBe('');
    expect(error.status).toBe(404);
  });
});

describe('apiHelper failures with isRetryOnError', () => {
  // The rate limiter starts its refill interval when the module loads, so the module is loaded
  // again after the fake timers are installed; otherwise the 31st try waits for a real refill.
  const runWithRetries = async (fetchMock: ReturnType<typeof vi.fn>) => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubGlobal('fetch', fetchMock);
    const { apiHelper: freshApiHelper } = await import('./apiHelper');

    const result = catchError(freshApiHelper.fetchGetJson('/api/v1/x', undefined, true));
    await vi.advanceTimersByTimeAsync((REPEAT_TRIES_COUNT + 1) * REPEAT_INTERVAL_MS * 2);

    return result;
  };

  it('gives network_unreachable after the last retry', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await runWithRetries(fetchMock);

    expect(error.code).toBe(API_ERROR_CODES.networkUnreachable);
    expect(fetchMock).toHaveBeenCalledTimes(REPEAT_TRIES_COUNT + 1);
  });

  it('gives request_failed with the status after the last retry', async () => {
    const error = await runWithRetries(
      vi.fn().mockImplementation(async () => new Response('Gateway Timeout', { status: 504 })),
    );

    expect(error.code).toBe(API_ERROR_CODES.requestFailed);
    expect(error.status).toBe(504);
  });

  it('keeps a backend code through the retries', async () => {
    const error = await runWithRetries(
      vi
        .fn()
        .mockImplementation(async () => jsonResponse(422, { message: 'wal gap', code: 'wal_gap' })),
    );

    expect(error.code).toBe('wal_gap');
    expect(error.message).toBe('wal gap');
    expect(error.status).toBe(422);
  });
});
