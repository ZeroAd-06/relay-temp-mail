import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { CFTempMailProvider, type HttpClient } from './cf-api';
import { AuthError, NetworkError, NotFoundError, RateLimitError, RelayTempMailError } from './errors';

describe('CFTempMailProvider', () => {
  const apiUrl = 'https://example.com';
  const token = 'test-token';
  let mockGet: Mock;
  let mockHttpClient: HttpClient;
  let provider: CFTempMailProvider;

  beforeEach(() => {
    mockGet = vi.fn();
    mockHttpClient = { get: mockGet };
    provider = new CFTempMailProvider(apiUrl, token, mockHttpClient);
  });

  describe('getMails', () => {
    it('returns mapped Email array', async () => {
      const mockResponse = {
        results: [{
          id: 516,
          message_id: '<test@mail.com>',
          source: 'sender@example.com',
          address: 'tmpnie91@example.dpdns.org',
          raw: 'DKIM-Signature: ...',
          metadata: null,
          created_at: '2026-04-03 17:12:55',
        }],
        count: 1,
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const emails = await provider.getMails();

      expect(emails).toHaveLength(1);
      expect(emails[0]).toEqual({
        id: 516,
        messageId: '<test@mail.com>',
        source: 'sender@example.com',
        address: 'tmpnie91@example.dpdns.org',
        raw: 'DKIM-Signature: ...',
        metadata: null,
        createdAt: '2026-04-03 17:12:55',
      });
    });

    it('sends correct Authorization header', async () => {
      mockGet.mockResolvedValueOnce({ results: [], count: 0 });

      await provider.getMails();

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/mails'),
        {
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );
    });

    it('sends correct query params with defaults', async () => {
      mockGet.mockResolvedValueOnce({ results: [], count: 0 });

      await provider.getMails();

      const calledUrl = mockGet.mock.calls[0][0];
      expect(calledUrl).toContain('limit=20');
      expect(calledUrl).toContain('offset=0');
    });

    it('sends correct query params with custom values', async () => {
      mockGet.mockResolvedValueOnce({ results: [], count: 0 });

      await provider.getMails(50, 10);

      const calledUrl = mockGet.mock.calls[0][0];
      expect(calledUrl).toContain('limit=50');
      expect(calledUrl).toContain('offset=10');
    });

    it('normalizes trailing slashes in apiUrl before requesting mails', async () => {
      const trailingSlashProvider = new CFTempMailProvider('https://example.com/', token, mockHttpClient);
      mockGet.mockResolvedValueOnce({ results: [], count: 0 });

      await trailingSlashProvider.getMails();

      expect(mockGet).toHaveBeenCalledWith(
        'https://example.com/api/mails?limit=20&offset=0',
        {
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );
    });

    it('throws AuthError on 401', async () => {
      const error = new RelayTempMailError('Unauthorized', 'HTTP_ERROR', 401, 'Unauthorized');
      mockGet.mockRejectedValueOnce(error);

      await expect(provider.getMails()).rejects.toThrow(AuthError);
    });

    it('throws AuthError on 403', async () => {
      const error = new RelayTempMailError('Forbidden', 'HTTP_ERROR', 403, 'Forbidden');
      mockGet.mockRejectedValueOnce(error);

      await expect(provider.getMails()).rejects.toThrow(AuthError);
    });

    it('throws NotFoundError on 404', async () => {
      const error = new RelayTempMailError('Not Found', 'HTTP_ERROR', 404, 'Not Found');
      mockGet.mockRejectedValueOnce(error);

      await expect(provider.getMails()).rejects.toThrow(NotFoundError);
    });

    it('throws RateLimitError on 429', async () => {
      const error = new RelayTempMailError('Rate Limited', 'HTTP_ERROR', 429, 'Rate Limited');
      mockGet.mockRejectedValueOnce(error);

      await expect(provider.getMails()).rejects.toThrow(RateLimitError);
    });

    it('throws NetworkError on TypeError', async () => {
      mockGet.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(provider.getMails()).rejects.toThrow(NetworkError);
    });
  });

  describe('implements MailProvider', () => {
    it('has getMails method', () => {
      expect(typeof provider.getMails).toBe('function');
    });
  });
});
