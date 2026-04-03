import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from './http';
import {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  RateLimitError,
} from './errors';

describe('HttpClient', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates client with default values', () => {
      const client = new HttpClient('https://api.example.com');
      expect(client).toBeDefined();
    });

    it('creates client with custom timeout and retries', () => {
      const client = new HttpClient('https://api.example.com', 5000, 3);
      expect(client).toBeDefined();
    });

    it('removes trailing slash from base URL', () => {
      const client = new HttpClient('https://api.example.com/');
      expect(client).toBeDefined();
    });
  });

  describe('successful requests', () => {
    it('returns parsed JSON for successful GET request', async () => {
      const mockData = { id: 1, name: 'test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockData)),
      } as Response);

      const client = new HttpClient('https://api.example.com');
      const result = await client.request('GET', '/users/1');

      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns empty object for empty response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      } as Response);

      const client = new HttpClient('https://api.example.com');
      const result = await client.request('DELETE', '/users/1');

      expect(result).toEqual({});
    });

    it('sends request with custom headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      } as Response);

      const client = new HttpClient('https://api.example.com');
      await client.request('GET', '/users', {
        headers: { Authorization: 'Bearer token123' },
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        })
      );
    });

    it('sends JSON body for POST request', async () => {
      const requestBody = { name: 'test user' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve('{}'),
      } as Response);

      const client = new HttpClient('https://api.example.com');
      await client.request('POST', '/users', { body: requestBody });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
    });
  });

  describe('timeout handling', () => {
    it('times out requests when AbortError is thrown', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const client = new HttpClient('https://api.example.com', 1000);

      await expect(client.request('GET', '/slow')).rejects.toThrow(NetworkError);
      await expect(client.request('GET', '/slow')).rejects.toThrow('Request timed out');
    });

    it('uses custom timeout from options', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const client = new HttpClient('https://api.example.com', 10000);

      await expect(client.request('GET', '/slow', { timeout: 5000 })).rejects.toThrow(NetworkError);
    });
  });

  describe('retry logic', () => {
    it('retries on network errors and succeeds eventually', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{}'),
        } as Response);
      });

      const client = new HttpClient('https://api.example.com', 1000, 3);

      const result = await client.request('GET', '/users');

      expect(result).toEqual({});
      expect(attempts).toBe(3);
    });

    it('retries on 5xx server errors', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{}'),
        } as Response);
      });

      const client = new HttpClient('https://api.example.com', 1000, 2);

      const result = await client.request('GET', '/users');
      expect(result).toEqual({});
      expect(attempts).toBe(2);
    });

    it('does not retry on 4xx client errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const client = new HttpClient('https://api.example.com', 1000, 2);

      await expect(client.request('GET', '/users')).rejects.toThrow(RelayTempMailError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('respects retry count from options', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        return Promise.reject(new TypeError('Failed to fetch'));
      });

      const client = new HttpClient('https://api.example.com', 1000, 5);

      await expect(client.request('GET', '/users', { retries: 2 })).rejects.toThrow();

      expect(attempts).toBe(3);
    });

    it('does not retry when retries is 0', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new HttpClient('https://api.example.com', 1000, 0);

      await expect(client.request('GET', '/users')).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error classification', () => {
    it('throws AuthError for 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users')).rejects.toThrow(AuthError);
      await expect(client.request('GET', '/users')).rejects.toThrow('Authentication failed');
    });

    it('throws AuthError for 403 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users')).rejects.toThrow(AuthError);
    });

    it('throws NotFoundError for 404 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users/999')).rejects.toThrow(NotFoundError);
      await expect(client.request('GET', '/users/999')).rejects.toThrow('Resource not found');
    });

    it('throws RateLimitError for 429 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users')).rejects.toThrow(RateLimitError);
      await expect(client.request('GET', '/users')).rejects.toThrow('Rate limit exceeded');
    });

    it('throws NetworkError for 5xx responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users')).rejects.toThrow(NetworkError);
      await expect(client.request('GET', '/users')).rejects.toThrow('Server error');
    });

    it('throws NetworkError for network failures', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users')).rejects.toThrow(NetworkError);
      await expect(client.request('GET', '/users')).rejects.toThrow('Network request failed');
    });

    it('throws generic RelayTempMailError for other errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 418,
        statusText: "I'm a teapot",
      } as Response);

      const client = new HttpClient('https://api.example.com');

      await expect(client.request('GET', '/users')).rejects.toThrow(RelayTempMailError);
    });
  });
});
