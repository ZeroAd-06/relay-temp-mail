import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FirefoxRelayProvider } from './relay-api';
import { HttpClient } from './http';
import { AuthError, NotFoundError, NetworkError } from './errors';

describe('FirefoxRelayProvider', () => {
  let provider: FirefoxRelayProvider;
  let mockHttpClient: { request: ReturnType<typeof vi.fn> };
  let originalFetch: typeof fetch;

  const csrfToken = 'test-csrf-token';
  const sessionId = 'test-session-id';
  const expectedHeaders = {
    'Origin': 'https://relay.firefox.com',
    'Referer': 'https://relay.firefox.com/accounts/profile/?',
    'Accept': 'application/json',
    'X-CSRFToken': csrfToken,
    'Cookie': `sessionid=${sessionId}; csrftoken=${csrfToken}`,
  };

  beforeEach(() => {
    originalFetch = global.fetch;
    mockHttpClient = {
      request: vi.fn(),
    };
    provider = new FirefoxRelayProvider(csrfToken, sessionId, mockHttpClient as unknown as HttpClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates provider with csrfToken and sessionId', () => {
      const provider = new FirefoxRelayProvider('token', 'session');
      expect(provider).toBeDefined();
    });

    it('uses provided httpClient when given', () => {
      const mockHttp = { request: vi.fn() };
      const provider = new FirefoxRelayProvider('token', 'session', mockHttp as unknown as HttpClient);
      expect(provider).toBeDefined();
    });

    it('creates default HttpClient when not provided', () => {
      const provider = new FirefoxRelayProvider('token', 'session');
      expect(provider).toBeDefined();
    });
  });

  describe('listAliases', () => {
    it('returns RelayAlias[] on successful response', async () => {
      const mockResponse = [
        {
          id: 17901547,
          address: 't1ou9gl4l',
          full_address: 't1ou9gl4l@mozmail.com',
          enabled: true,
          created_at: '2024-01-01T00:00:00Z',
          domain: 2,
          mask_type: 'random',
          description: null,
          num_forwarded: 5,
          num_blocked: 2,
          last_modified_at: '2024-01-02T00:00:00Z',
          last_used_at: '2024-01-03T00:00:00Z',
          num_level_one_trackers_blocked: 1,
          num_replied: 0,
          num_spam: 0,
          block_list_emails: false,
          generated_for: null,
          used_on: null,
        },
      ];

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.listAliases();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(17901547);
      expect(result[0].address).toBe('t1ou9gl4l');
      expect(result[0].fullAddress).toBe('t1ou9gl4l@mozmail.com');
      expect(result[0].maskType).toBe('random');
    });

    it('sends correct auth headers', async () => {
      mockHttpClient.request.mockResolvedValueOnce([]);

      await provider.listAliases();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/relayaddresses/',
        {
          headers: expectedHeaders,
        }
      );
    });

    it('maps snake_case to camelCase correctly', async () => {
      const mockResponse = [
        {
          id: 1,
          address: 'test',
          full_address: 'test@mozmail.com',
          enabled: true,
          created_at: '2024-01-01T00:00:00Z',
          domain: 2,
          mask_type: 'random',
          num_forwarded: 10,
          num_blocked: 5,
          last_modified_at: '2024-01-02T00:00:00Z',
          last_used_at: '2024-01-03T00:00:00Z',
          num_level_one_trackers_blocked: 3,
          num_replied: 1,
          num_spam: 2,
          block_list_emails: true,
          generated_for: 'example.com',
          used_on: 'https://example.com',
        },
      ];

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.listAliases();

      expect(result[0].fullAddress).toBe('test@mozmail.com');
      expect(result[0].maskType).toBe('random');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z');
      expect(result[0].lastModifiedAt).toBe('2024-01-02T00:00:00Z');
      expect(result[0].lastUsedAt).toBe('2024-01-03T00:00:00Z');
      expect(result[0].numForwarded).toBe(10);
      expect(result[0].numBlocked).toBe(5);
      expect(result[0].numLevelOneTrackersBlocked).toBe(3);
      expect(result[0].numReplied).toBe(1);
      expect(result[0].numSpam).toBe(2);
      expect(result[0].blockListEmails).toBe(true);
      expect(result[0].generatedFor).toBe('example.com');
      expect(result[0].usedOn).toBe('https://example.com');
    });

    it('throws AuthError on 401', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new AuthError('Authentication failed', 401)
      );

      await expect(provider.listAliases()).rejects.toThrow(AuthError);
    });

    it('throws NetworkError on network failure', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new NetworkError('Network request failed')
      );

      await expect(provider.listAliases()).rejects.toThrow(NetworkError);
    });
  });

  describe('createAlias', () => {
    it('returns new RelayAlias on successful creation', async () => {
      const mockResponse = {
        id: 17902636,
        address: 'adbpzj5e2',
        full_address: 'adbpzj5e2@mozmail.com',
        enabled: true,
        created_at: '2024-01-01T00:00:00Z',
        domain: 2,
        mask_type: 'random',
        description: null,
        num_forwarded: 0,
        num_blocked: 0,
        last_modified_at: null,
        last_used_at: null,
        num_level_one_trackers_blocked: 0,
        num_replied: 0,
        num_spam: 0,
        block_list_emails: false,
        generated_for: null,
        used_on: null,
      };

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.createAlias();

      expect(result.id).toBe(17902636);
      expect(result.address).toBe('adbpzj5e2');
      expect(result.fullAddress).toBe('adbpzj5e2@mozmail.com');
    });

    it('sends correct auth headers', async () => {
      mockHttpClient.request.mockResolvedValueOnce({});

      await provider.createAlias();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/relayaddresses/',
        {
          headers: expectedHeaders,
          body: { enabled: true },
        }
      );
    });

    it('throws AuthError on 401', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new AuthError('Authentication failed', 401)
      );

      await expect(provider.createAlias()).rejects.toThrow(AuthError);
    });
  });

  describe('deleteAlias', () => {
    it('succeeds on successful deletion', async () => {
      mockHttpClient.request.mockResolvedValueOnce(undefined);

      await expect(provider.deleteAlias(17901547)).resolves.toBeUndefined();
    });

    it('sends correct auth headers and ID in path', async () => {
      mockHttpClient.request.mockResolvedValueOnce(undefined);

      await provider.deleteAlias(17901547);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'DELETE',
        '/api/v1/relayaddresses/17901547/',
        {
          headers: expectedHeaders,
        }
      );
    });

    it('throws NotFoundError on 404', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new NotFoundError('Resource not found')
      );

      await expect(provider.deleteAlias(999999)).rejects.toThrow(NotFoundError);
    });

    it('throws AuthError on 401', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new AuthError('Authentication failed', 401)
      );

      await expect(provider.deleteAlias(1)).rejects.toThrow(AuthError);
    });
  });

  describe('error handling', () => {
    it('propagates error from HttpClient', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        new NetworkError('Server error', 500)
      );

      await expect(provider.listAliases()).rejects.toThrow(NetworkError);
    });
  });

  describe('implements AliasProvider', () => {
    it('has listAliases method', () => {
      expect(typeof provider.listAliases).toBe('function');
    });

    it('has createAlias method', () => {
      expect(typeof provider.createAlias).toBe('function');
    });

    it('has deleteAlias method', () => {
      expect(typeof provider.deleteAlias).toBe('function');
    });
  });
});
