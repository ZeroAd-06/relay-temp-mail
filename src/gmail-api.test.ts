import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GmailProvider } from './gmail-api';
import { AuthError, NetworkError, RateLimitError, RelayTempMailError } from './errors';

describe('GmailProvider', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('constructor', () => {
    it('creates provider with accessToken', () => {
      const provider = new GmailProvider({ accessToken: 'ya29.test' });
      expect(provider).toBeDefined();
    });

    it('creates provider with OAuth2 refresh token credentials', () => {
      const provider = new GmailProvider({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
      });
      expect(provider).toBeDefined();
    });

    it('throws RelayTempMailError when neither accessToken nor refresh credentials provided', () => {
      expect(() => new GmailProvider({})).toThrow(RelayTempMailError);
    });

    it('throws RelayTempMailError when only clientId provided without refreshToken', () => {
      expect(() => new GmailProvider({ clientId: 'id' })).toThrow(RelayTempMailError);
    });
  });

  describe('getMails', () => {
    const provider = new GmailProvider({ accessToken: 'ya29.test' });

    it('returns empty array when no messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ resultSizeEstimate: 0 }),
      });

      const emails = await provider.getMails(20, 0);
      expect(emails).toEqual([]);
    });

    it('returns mapped Email array from Gmail API', async () => {
      const listResponse = {
        messages: [{ id: 'msg1' }, { id: 'msg2' }],
        resultSizeEstimate: 2,
      };

      const msg1Response = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'Hello',
        internalDate: '1713000000000',
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@gmail.com' },
            { name: 'Message-ID', value: '<msg1@mail.com>' },
          ],
          body: {
            data: btoa('From: sender@example.com\r\nSubject: Test\r\n\r\nHello'),
          },
        },
      };

      const msg2Response = {
        id: 'msg2',
        threadId: 'thread2',
        snippet: 'World',
        internalDate: '1713000001000',
        payload: {
          headers: [
            { name: 'From', value: 'other@example.com' },
            { name: 'To', value: 'me@gmail.com' },
            { name: 'Message-ID', value: '<msg2@mail.com>' },
          ],
          body: {
            data: btoa('From: other@example.com\r\nSubject: Hi\r\n\r\nWorld'),
          },
        },
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => listResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => msg1Response })
        .mockResolvedValueOnce({ ok: true, json: async () => msg2Response });

      const emails = await provider.getMails(20, 0);

      expect(emails).toHaveLength(2);
      expect(emails[0].messageId).toBe('<msg1@mail.com>');
      expect(emails[0].source).toBe('sender@example.com');
      expect(emails[0].address).toBe('me@gmail.com');
      expect(emails[1].messageId).toBe('<msg2@mail.com>');
    });

    it('sends Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ resultSizeEstimate: 0 }),
      });

      await provider.getMails();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer ya29.test' },
        }),
      );
    });

    it('applies offset by skipping messages', async () => {
      const listResponse = {
        messages: [{ id: 'msg1' }, { id: 'msg2' }, { id: 'msg3' }],
        resultSizeEstimate: 3,
      };

      const msg3Response = {
        id: 'msg3',
        internalDate: '1713000000000',
        payload: {
          headers: [
            { name: 'From', value: 'a@b.com' },
            { name: 'To', value: 'me@gmail.com' },
          ],
          body: { data: btoa('test') },
        },
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => listResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => msg3Response });

      const emails = await provider.getMails(1, 2);

      expect(emails).toHaveLength(1);
      expect(emails[0].id).toBeDefined();
    });
  });

  describe('error handling', () => {
    const provider = new GmailProvider({ accessToken: 'ya29.test' });

    it('throws AuthError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      await expect(provider.getMails()).rejects.toThrow(AuthError);
    });

    it('throws AuthError on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Forbidden',
      });

      await expect(provider.getMails()).rejects.toThrow(AuthError);
    });

    it('throws RelayTempMailError on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
      });

      await expect(provider.getMails()).rejects.toThrow(RelayTempMailError);
    });

    it('throws RateLimitError on 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: () => null },
        text: async () => 'Rate limited',
      });

      await expect(provider.getMails()).rejects.toThrow(RateLimitError);
    });

    it('throws NetworkError on 5xx', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(provider.getMails()).rejects.toThrow(NetworkError);
    });
  });

  describe('OAuth2 token refresh', () => {
    it('refreshes access token using refresh token', async () => {
      const provider = new GmailProvider({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'ya29.refreshed',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ resultSizeEstimate: 0 }),
      });

      await provider.getMails();

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws AuthError when token refresh fails', async () => {
      const provider = new GmailProvider({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_grant',
      });

      await expect(provider.getMails()).rejects.toThrow(AuthError);
    });
  });

  describe('implements MailProvider', () => {
    it('has getMails method', () => {
      const provider = new GmailProvider({ accessToken: 'test' });
      expect(typeof provider.getMails).toBe('function');
    });
  });
});
