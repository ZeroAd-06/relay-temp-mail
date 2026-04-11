import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuckDuckGoEmailProvider, InMemoryDuckDuckGoAliasStore } from './duckduckgo-api';
import { HttpClient } from './http';
import { RelayTempMailError } from './errors';
import type { DuckDuckGoAliasStore, RelayAlias } from './types';

describe('InMemoryDuckDuckGoAliasStore', () => {
  let store: InMemoryDuckDuckGoAliasStore;

  beforeEach(() => {
    store = new InMemoryDuckDuckGoAliasStore();
  });

  it('starts empty', () => {
    expect(store.getAll()).toEqual([]);
  });

  it('adds and retrieves aliases', () => {
    const alias: RelayAlias = {
      id: 1,
      address: 'abc-def',
      fullAddress: 'abc-def@duck.com',
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      domain: 3,
      maskType: 'random',
    };
    store.add(alias);
    expect(store.getAll()).toEqual([alias]);
  });

  it('removes aliases by id', () => {
    const alias1: RelayAlias = {
      id: 1,
      address: 'aaa-bbb',
      fullAddress: 'aaa-bbb@duck.com',
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      domain: 3,
      maskType: 'random',
    };
    const alias2: RelayAlias = {
      id: 2,
      address: 'ccc-ddd',
      fullAddress: 'ccc-ddd@duck.com',
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      domain: 3,
      maskType: 'random',
    };
    store.add(alias1);
    store.add(alias2);
    store.remove(1);
    expect(store.getAll()).toEqual([alias2]);
  });

  it('returns a copy from getAll', () => {
    const alias: RelayAlias = {
      id: 1,
      address: 'abc-def',
      fullAddress: 'abc-def@duck.com',
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      domain: 3,
      maskType: 'random',
    };
    store.add(alias);
    const retrieved = store.getAll();
    retrieved.pop();
    expect(store.getAll()).toHaveLength(1);
  });
});

describe('DuckDuckGoEmailProvider', () => {
  let provider: DuckDuckGoEmailProvider;
  let mockHttpClient: { request: ReturnType<typeof vi.fn> };
  const jwtToken = 'test-jwt-token';

  beforeEach(() => {
    mockHttpClient = {
      request: vi.fn(),
    };
    provider = new DuckDuckGoEmailProvider(
      jwtToken,
      undefined,
      mockHttpClient as unknown as HttpClient
    );
  });

  describe('constructor', () => {
    it('creates provider with jwtToken', () => {
      const provider = new DuckDuckGoEmailProvider('token');
      expect(provider).toBeDefined();
    });

    it('creates provider with custom store', () => {
      const store = new InMemoryDuckDuckGoAliasStore();
      const provider = new DuckDuckGoEmailProvider('token', store);
      expect(provider).toBeDefined();
    });

    it('creates provider with custom httpClient', () => {
      const provider = new DuckDuckGoEmailProvider(
        'token',
        undefined,
        mockHttpClient as unknown as HttpClient
      );
      expect(provider).toBeDefined();
    });

    it('creates default InMemoryDuckDuckGoAliasStore when not provided', () => {
      const provider = new DuckDuckGoEmailProvider('token');
      expect(provider).toBeDefined();
    });
  });

  describe('createAlias', () => {
    it('returns RelayAlias with @duck.com address', async () => {
      mockHttpClient.request.mockResolvedValueOnce({
        address: 'abc-def-ghi',
      });

      const result = await provider.createAlias();

      expect(result.address).toBe('abc-def-ghi');
      expect(result.fullAddress).toBe('abc-def-ghi@duck.com');
      expect(result.enabled).toBe(true);
      expect(result.domain).toBe(3);
      expect(result.maskType).toBe('random');
      expect(result.createdAt).toBeDefined();
    });

    it('sends correct Authorization header', async () => {
      mockHttpClient.request.mockResolvedValueOnce({
        address: 'test-addr',
      });

      await provider.createAlias();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/email/addresses',
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );
    });

    it('assigns incrementing IDs', async () => {
      mockHttpClient.request
        .mockResolvedValueOnce({ address: 'first-addr' })
        .mockResolvedValueOnce({ address: 'second-addr' });

      const first = await provider.createAlias();
      const second = await provider.createAlias();

      expect(first.id).toBe(1);
      expect(second.id).toBe(2);
    });

    it('throws DUPLICATE_ALIAS when API returns an already-stored address', async () => {
      mockHttpClient.request
        .mockResolvedValueOnce({ address: 'dup-addr' })
        .mockResolvedValueOnce({ address: 'dup-addr' });

      await provider.createAlias();

      const duplicateCall = provider.createAlias();
      await expect(duplicateCall).rejects.toThrow(RelayTempMailError);
      await expect(duplicateCall).rejects.toMatchObject({
        code: 'DUPLICATE_ALIAS',
      });
    });

    it('stores created alias for later retrieval', async () => {
      mockHttpClient.request.mockResolvedValueOnce({
        address: 'stored-addr',
      });

      const created = await provider.createAlias();
      const aliases = await provider.listAliases();

      expect(aliases).toHaveLength(1);
      expect(aliases[0].fullAddress).toBe(created.fullAddress);
    });
  });

  describe('listAliases', () => {
    it('returns empty array when no aliases created', async () => {
      const result = await provider.listAliases();
      expect(result).toEqual([]);
    });

    it('returns all created aliases', async () => {
      mockHttpClient.request
        .mockResolvedValueOnce({ address: 'addr-one' })
        .mockResolvedValueOnce({ address: 'addr-two' });

      await provider.createAlias();
      await provider.createAlias();

      const result = await provider.listAliases();

      expect(result).toHaveLength(2);
      expect(result[0].fullAddress).toBe('addr-one@duck.com');
      expect(result[1].fullAddress).toBe('addr-two@duck.com');
    });
  });

  describe('deleteAlias', () => {
    it('removes alias from store', async () => {
      mockHttpClient.request.mockResolvedValueOnce({
        address: 'to-delete',
      });

      const created = await provider.createAlias();
      expect(await provider.listAliases()).toHaveLength(1);

      await provider.deleteAlias(created.id);
      expect(await provider.listAliases()).toHaveLength(0);
    });

    it('does not throw when deleting non-existent id', async () => {
      await expect(provider.deleteAlias(999)).resolves.toBeUndefined();
    });

    it('only removes the specified alias', async () => {
      mockHttpClient.request
        .mockResolvedValueOnce({ address: 'keep-this' })
        .mockResolvedValueOnce({ address: 'remove-this' });

      const first = await provider.createAlias();
      const second = await provider.createAlias();

      await provider.deleteAlias(second.id);

      const remaining = await provider.listAliases();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(first.id);
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

  describe('custom store', () => {
    it('uses provided custom store', async () => {
      const customStore: DuckDuckGoAliasStore = {
        getAll: vi.fn().mockReturnValue([]),
        add: vi.fn(),
        remove: vi.fn(),
      };

      const provider = new DuckDuckGoEmailProvider(
        jwtToken,
        customStore,
        mockHttpClient as unknown as HttpClient
      );

      mockHttpClient.request.mockResolvedValueOnce({
        address: 'custom-addr',
      });

      await provider.createAlias();

      expect(customStore.add).toHaveBeenCalledOnce();
      expect(customStore.getAll).toHaveBeenCalledOnce();
    });
  });
});
