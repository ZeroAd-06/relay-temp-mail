import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleLoginProvider } from './simplelogin-api';
import { HttpClient } from './http';
import { AuthError, NotFoundError, NetworkError } from './errors';

describe('SimpleLoginProvider', () => {
  let provider: SimpleLoginProvider;
  let mockHttpClient: { request: ReturnType<typeof vi.fn> };
  let originalFetch: typeof fetch;

  const apiKey = 'test-api-key';
  const expectedHeaders = {
    'Authentication': apiKey,
  };

  beforeEach(() => {
    originalFetch = global.fetch;
    mockHttpClient = {
      request: vi.fn(),
    };
    provider = new SimpleLoginProvider(apiKey, undefined, mockHttpClient as unknown as HttpClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates provider with apiKey', () => {
      const provider = new SimpleLoginProvider('my-key');
      expect(provider).toBeDefined();
    });

    it('creates provider with apiKey and custom apiUrl', () => {
      const provider = new SimpleLoginProvider('my-key', 'https://sl.example.com');
      expect(provider).toBeDefined();
    });

    it('uses provided httpClient when given', () => {
      const mockHttp = { request: vi.fn() };
      const provider = new SimpleLoginProvider('my-key', undefined, mockHttp as unknown as HttpClient);
      expect(provider).toBeDefined();
    });

    it('creates default HttpClient when not provided', () => {
      const provider = new SimpleLoginProvider('my-key');
      expect(provider).toBeDefined();
    });
  });

  describe('listAliases', () => {
    it('returns mapped RelayAlias[] on successful response', async () => {
      const mockResponse = {
        aliases: [
          {
            id: 123,
            email: 'testalias@slmail.me',
            name: 'Test Alias',
            enabled: true,
            creation_timestamp: 1704067200,
            creation_date: '2024-01-01T00:00:00Z',
            note: 'My test alias',
            nb_block: 3,
            nb_forward: 10,
            nb_reply: 1,
          },
        ],
      };

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.listAliases();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(123);
      expect(result[0].address).toBe('testalias');
      expect(result[0].fullAddress).toBe('testalias@slmail.me');
      expect(result[0].enabled).toBe(true);
      expect(result[0].maskType).toBe('random');
    });

    it('sends correct auth headers', async () => {
      mockHttpClient.request.mockResolvedValueOnce({ aliases: [] });

      await provider.listAliases();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v2/aliases?page_id=0',
        {
          headers: expectedHeaders,
        }
      );
    });

    it('maps snake_case API response to camelCase RelayAlias correctly', async () => {
      const mockResponse = {
        aliases: [
          {
            id: 456,
            email: 'myalias@slmail.me',
            name: null,
            enabled: true,
            creation_timestamp: 1704067200,
            creation_date: '2024-01-01T00:00:00Z',
            note: 'some note',
            nb_block: 5,
            nb_forward: 20,
            nb_reply: 3,
          },
        ],
      };

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.listAliases();

      expect(result[0].fullAddress).toBe('myalias@slmail.me');
      expect(result[0].address).toBe('myalias');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z');
      expect(result[0].domain).toBe(4);
      expect(result[0].maskType).toBe('random');
      expect(result[0].description).toBe('some note');
      expect(result[0].numForwarded).toBe(20);
      expect(result[0].numBlocked).toBe(5);
      expect(result[0].numReplied).toBe(3);
    });

    it('handles pagination (multiple pages)', async () => {
      // First page: 20 aliases (full page = more pages)
      const firstPageAliases = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        email: `alias${i + 1}@slmail.me`,
        name: null,
        enabled: true,
        creation_timestamp: 1704067200 + i,
        creation_date: '2024-01-01T00:00:00Z',
        note: null,
        nb_block: 0,
        nb_forward: 0,
        nb_reply: 0,
      }));

      // Second page: 5 aliases (partial page = no more pages)
      const secondPageAliases = Array.from({ length: 5 }, (_, i) => ({
        id: i + 21,
        email: `alias${i + 21}@slmail.me`,
        name: null,
        enabled: true,
        creation_timestamp: 1704067200 + i + 20,
        creation_date: '2024-01-02T00:00:00Z',
        note: null,
        nb_block: 0,
        nb_forward: 0,
        nb_reply: 0,
      }));

      mockHttpClient.request
        .mockResolvedValueOnce({ aliases: firstPageAliases })
        .mockResolvedValueOnce({ aliases: secondPageAliases });

      const result = await provider.listAliases();

      expect(result).toHaveLength(25);
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        1,
        'GET',
        '/api/v2/aliases?page_id=0',
        { headers: expectedHeaders }
      );
      expect(mockHttpClient.request).toHaveBeenNthCalledWith(
        2,
        'GET',
        '/api/v2/aliases?page_id=1',
        { headers: expectedHeaders }
      );
    });

    it('returns empty array when no aliases', async () => {
      mockHttpClient.request.mockResolvedValueOnce({ aliases: [] });

      const result = await provider.listAliases();

      expect(result).toHaveLength(0);
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
        id: 789,
        email: 'newalias@slmail.me',
        name: null,
        enabled: true,
        creation_timestamp: 1704067200,
        creation_date: '2024-01-01T00:00:00Z',
        note: null,
        nb_block: 0,
        nb_forward: 0,
        nb_reply: 0,
      };

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.createAlias();

      expect(result.id).toBe(789);
      expect(result.address).toBe('newalias');
      expect(result.fullAddress).toBe('newalias@slmail.me');
    });

    it('sends correct auth headers', async () => {
      mockHttpClient.request.mockResolvedValueOnce({
        id: 1,
        email: 'test@sl.lan',
        name: null,
        enabled: true,
        creation_timestamp: 1704067200,
        creation_date: '2024-01-01T00:00:00Z',
        note: null,
        nb_block: 0,
        nb_forward: 0,
        nb_reply: 0,
      });

      await provider.createAlias();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/alias/random/new',
        {
          headers: expectedHeaders,
        }
      );
    });

    it('maps response correctly (email → fullAddress, extract address part before @)', async () => {
      const mockResponse = {
        id: 100,
        email: 'my.custom.alias@example.com',
        name: 'Custom Alias',
        enabled: true,
        creation_timestamp: 1704067200,
        creation_date: '2024-06-15T12:30:00Z',
        note: 'Important alias',
        nb_block: 2,
        nb_forward: 15,
        nb_reply: 4,
      };

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.createAlias();

      expect(result.fullAddress).toBe('my.custom.alias@example.com');
      expect(result.address).toBe('my.custom.alias');
      expect(result.description).toBe('Important alias');
      expect(result.numForwarded).toBe(15);
      expect(result.numBlocked).toBe(2);
      expect(result.numReplied).toBe(4);
    });

    it('handles null note → undefined description', async () => {
      const mockResponse = {
        id: 200,
        email: 'nonote@slmail.me',
        name: null,
        enabled: true,
        creation_timestamp: 1704067200,
        creation_date: '2024-01-01T00:00:00Z',
        note: null,
        nb_block: 0,
        nb_forward: 0,
        nb_reply: 0,
      };

      mockHttpClient.request.mockResolvedValueOnce(mockResponse);

      const result = await provider.createAlias();

      expect(result.description).toBeUndefined();
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

      await expect(provider.deleteAlias(123)).resolves.toBeUndefined();
    });

    it('sends correct auth headers and ID in path', async () => {
      mockHttpClient.request.mockResolvedValueOnce(undefined);

      await provider.deleteAlias(123);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'DELETE',
        '/api/aliases/123',
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
