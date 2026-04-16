import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { TempMailClient } from './client';
import type { RelayAlias, Email, ParsedEmail, TempMailConfig } from './types';

vi.mock('./cf-api', () => ({
  CFTempMailProvider: vi.fn().mockImplementation(() => ({
    getMails: vi.fn(),
  })),
  DefaultHttpClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('./http', () => ({
  HttpClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('./relay-api', () => ({
  FirefoxRelayProvider: vi.fn().mockImplementation(() => ({
    listAliases: vi.fn(),
    createAlias: vi.fn(),
    deleteAlias: vi.fn(),
  })),
}));

vi.mock('./parser', () => ({
  EmailParser: vi.fn().mockImplementation(() => ({
    parseEmail: vi.fn(),
  })),
}));

import { CFTempMailProvider } from './cf-api';
import { FirefoxRelayProvider } from './relay-api';
import { EmailParser } from './parser';

const createMockAlias = (overrides: Partial<RelayAlias> = {}): RelayAlias => ({
  id: 1,
  address: 'test',
  fullAddress: 'test@mozmail.com',
  enabled: true,
  createdAt: '2024-01-01T00:00:00Z',
  domain: 2,
  maskType: 'random',
  ...overrides,
});

const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  messageId: '<test@example.com>',
  source: 'sender@example.com',
  address: 'test@mozmail.com',
  raw: 'To: test@mozmail.com\nFrom: sender@example.com\nSubject: Test\n\nBody',
  metadata: null,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const baseConfig: TempMailConfig = {
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: 'csrf-token',
    sessionId: 'session-id',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://cf.example.com',
    token: 'cf-token',
  },
};

describe('TempMailClient', () => {
  let client: TempMailClient;
  let mockMailProvider: { getMails: ReturnType<typeof vi.fn> };
  let mockAliasProvider: {
    listAliases: ReturnType<typeof vi.fn>;
    createAlias: ReturnType<typeof vi.fn>;
    deleteAlias: ReturnType<typeof vi.fn>;
  };
  let mockParser: { parseEmail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    client = new TempMailClient(baseConfig);

    const cfResults = (CFTempMailProvider as unknown as MockInstance).mock.results;
    const relayResults = (FirefoxRelayProvider as unknown as MockInstance).mock.results;
    const parserResults = (EmailParser as unknown as MockInstance).mock.results;

    mockMailProvider = cfResults[cfResults.length - 1].value as { getMails: ReturnType<typeof vi.fn> };
    mockAliasProvider = relayResults[relayResults.length - 1].value as typeof mockAliasProvider;
    mockParser = parserResults[parserResults.length - 1].value as { parseEmail: ReturnType<typeof vi.fn> };
  });

  describe('listAliases', () => {
    it('returns RelayAlias[]', async () => {
      const aliases = [createMockAlias({ id: 1 }), createMockAlias({ id: 2 })];
      mockAliasProvider.listAliases.mockResolvedValue(aliases);

      const result = await client.listAliases();

      expect(result).toEqual(aliases);
      expect(mockAliasProvider.listAliases).toHaveBeenCalledOnce();
    });
  });

  describe('createAlias', () => {
    it('returns new RelayAlias', async () => {
      const newAlias = createMockAlias({ id: 3, address: 'newalias' });
      mockAliasProvider.createAlias.mockResolvedValue(newAlias);

      const result = await client.createAlias();

      expect(result).toEqual(newAlias);
      expect(mockAliasProvider.createAlias).toHaveBeenCalledOnce();
    });
  });

  describe('deleteAlias', () => {
    it('succeeds', async () => {
      mockAliasProvider.deleteAlias.mockResolvedValue(undefined);

      await client.deleteAlias(1);

      expect(mockAliasProvider.deleteAlias).toHaveBeenCalledWith(1);
    });
  });

  describe('getEmails', () => {
    it('without filter returns all parsed emails', async () => {
      const emails = [createMockEmail({ id: 1 }), createMockEmail({ id: 2 })];
      mockMailProvider.getMails.mockResolvedValue(emails);

      const parsedEmails: ParsedEmail[] = [
        { ...emails[0], relayAlias: 'test@mozmail.com' },
        { ...emails[1], relayAlias: 'test@mozmail.com' },
      ];
      mockParser.parseEmail
        .mockReturnValueOnce(parsedEmails[0])
        .mockReturnValueOnce(parsedEmails[1]);

      const result = await client.getEmails();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(mockMailProvider.getMails).toHaveBeenCalledWith(20, 0);
    });

    it('with aliasAddress filters correctly', async () => {
      const emails = [
        createMockEmail({ id: 1, address: 'alias1@mozmail.com' }),
        createMockEmail({ id: 2, address: 'alias2@mozmail.com' }),
      ];
      mockMailProvider.getMails.mockResolvedValue(emails);

      const parsedEmails: ParsedEmail[] = [
        { ...emails[0], relayAlias: 'alias1@mozmail.com' },
        { ...emails[1], relayAlias: 'alias2@mozmail.com' },
      ];
      mockParser.parseEmail
        .mockReturnValueOnce(parsedEmails[0])
        .mockReturnValueOnce(parsedEmails[1]);

      const result = await client.getEmails('alias1@mozmail.com');

      expect(result).toHaveLength(1);
      expect(result[0].relayAlias).toBe('alias1@mozmail.com');
    });

    it('with aliasAddress filters case-insensitively', async () => {
      const emails = [createMockEmail({ id: 1 })];
      mockMailProvider.getMails.mockResolvedValue(emails);

      mockParser.parseEmail.mockReturnValue({
        ...emails[0],
        relayAlias: 'Test@Mozmail.COM',
      });

      const result = await client.getEmails('test@mozmail.com');

      expect(result).toHaveLength(1);
    });

    it('with aliasAddress falls back to api address when relayAlias is missing', async () => {
      const email = createMockEmail({
        id: 1,
        address: 'tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org',
        raw: 'To: tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org\nFrom: sender@example.com\nSubject: Test\n\nBody',
      });
      mockMailProvider.getMails.mockResolvedValue([email]);

      mockParser.parseEmail.mockReturnValue({
        ...email,
        relayAlias: undefined,
      });

      const result = await client.getEmails('tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org');

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org');
    });

    it('passes pagination options', async () => {
      mockMailProvider.getMails.mockResolvedValue([]);
      mockParser.parseEmail.mockReturnValue({
        id: 0,
        messageId: '',
        source: '',
        address: '',
        raw: '',
        metadata: null,
        createdAt: '',
      });

      await client.getEmails(undefined, { limit: 50, offset: 10 });

      expect(mockMailProvider.getMails).toHaveBeenCalledWith(50, 10);
    });

    it('preserves original email metadata over parsed values', async () => {
      const email = createMockEmail({
        id: 123,
        messageId: '<original@mail.com>',
        source: 'original@sender.com',
        address: 'original@mozmail.com',
        createdAt: '2024-05-01T10:00:00Z',
        metadata: { key: 'value' },
      });
      mockMailProvider.getMails.mockResolvedValue([email]);

      mockParser.parseEmail.mockReturnValue({
        id: 0,
        messageId: '<parsed@mail.com>',
        source: 'parsed@sender.com',
        address: 'parsed@mozmail.com',
        raw: email.raw,
        metadata: null,
        createdAt: '2024-01-01T00:00:00Z',
        relayAlias: 'test@mozmail.com',
      });

      const result = await client.getEmails();

      expect(result[0].id).toBe(123);
      expect(result[0].messageId).toBe('<original@mail.com>');
      expect(result[0].source).toBe('original@sender.com');
      expect(result[0].address).toBe('original@mozmail.com');
      expect(result[0].createdAt).toBe('2024-05-01T10:00:00Z');
      expect(result[0].metadata).toEqual({ key: 'value' });
      expect(result[0].relayAlias).toBe('test@mozmail.com');
    });

    it('filters out emails without relayAlias when aliasAddress is provided', async () => {
      const emails = [createMockEmail({ id: 1 }), createMockEmail({ id: 2 })];
      mockMailProvider.getMails.mockResolvedValue(emails);

      mockParser.parseEmail
        .mockReturnValueOnce({
          ...emails[0],
          relayAlias: 'alias1@mozmail.com',
        } as ParsedEmail)
        .mockReturnValueOnce({
          ...emails[1],
          relayAlias: undefined,
        } as ParsedEmail);

      const result = await client.getEmails('alias1@mozmail.com');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('error handling', () => {
    it('propagates errors from AliasProvider', async () => {
      const error = new Error('Auth failed');
      mockAliasProvider.listAliases.mockRejectedValue(error);

      await expect(client.listAliases()).rejects.toThrow('Auth failed');
    });

    it('propagates errors from MailProvider', async () => {
      const error = new Error('Network error');
      mockMailProvider.getMails.mockRejectedValue(error);

      await expect(client.getEmails()).rejects.toThrow('Network error');
    });
  });

  describe('constructor', () => {
    it('creates client with firefox-relay and cf-temp-mail providers', () => {
      const client = new TempMailClient(baseConfig);
      expect(client).toBeDefined();
    });

    it('passes csrfToken and sessionId to FirefoxRelayProvider', () => {
      new TempMailClient(baseConfig);

      expect(FirefoxRelayProvider).toHaveBeenCalledWith(
        'csrf-token',
        'session-id'
      );
    });

    it('passes apiUrl and token to CFTempMailProvider', () => {
      new TempMailClient(baseConfig);

      expect(CFTempMailProvider).toHaveBeenCalledWith(
        'https://cf.example.com',
        'cf-token'
      );
    });
  });
});
