import { CFTempMailProvider } from './cf-api.js';
import { EmailParser } from './parser.js';
import { FirefoxRelayProvider } from './relay-api.js';
import { SimpleLoginProvider } from './simplelogin-api.js';
import { DuckDuckGoEmailProvider, InMemoryDuckDuckGoAliasStore } from './duckduckgo-api.js';
import { GmailProvider } from './gmail-api.js';
import { HttpClient } from './http.js';
import { RelayTempMailError } from './errors.js';
import type {
  TempMailConfig,
  RelayConfig,
  AliasProvider,
  MailProvider,
  RelayAlias,
  ParsedEmail,
  GetEmailsOptions,
} from './types.js';

function createAliasProvider(config: TempMailConfig, httpClient: HttpClient): AliasProvider {
  const aliasConfig = config.aliasProvider;
  switch (aliasConfig.type) {
    case 'firefox-relay':
      return new FirefoxRelayProvider(
        aliasConfig.csrfToken,
        aliasConfig.sessionId,
        httpClient
      );
    case 'simplelogin':
      return new SimpleLoginProvider(
        aliasConfig.apiKey,
        aliasConfig.apiUrl,
        httpClient
      );
    case 'duckduckgo':
      return new DuckDuckGoEmailProvider(
        aliasConfig.jwtToken,
        new InMemoryDuckDuckGoAliasStore(),
        httpClient
      );
    default:
      throw new RelayTempMailError(
        `Unsupported alias provider type: ${(aliasConfig as any).type}`,
        'INVALID_PROVIDER_TYPE'
      );
  }
}

function createMailProvider(config: TempMailConfig): MailProvider {
  const mailConfig = config.mailProvider;
  switch (mailConfig.type) {
    case 'cf-temp-mail':
      return new CFTempMailProvider(
        mailConfig.apiUrl,
        mailConfig.token
      );
    case 'gmail':
      return new GmailProvider({
        userId: mailConfig.userId,
        accessToken: mailConfig.accessToken,
        clientId: mailConfig.clientId,
        clientSecret: mailConfig.clientSecret,
        refreshToken: mailConfig.refreshToken,
      });
    default:
      throw new RelayTempMailError(
        `Unsupported mail provider type: ${(mailConfig as any).type}`,
        'INVALID_PROVIDER_TYPE'
      );
  }
}

export class TempMailClient {
  private readonly aliasProvider: AliasProvider;
  private readonly mailProvider: MailProvider;
  private readonly parser: EmailParser;

  constructor(config: TempMailConfig) {
    const timeout = config.timeout ?? 30000;
    const httpClient = new HttpClient('https://relay.firefox.com', timeout);
    this.aliasProvider = createAliasProvider(config, httpClient);
    this.mailProvider = createMailProvider(config);
    this.parser = new EmailParser();
  }

  async listAliases(): Promise<RelayAlias[]> {
    return this.aliasProvider.listAliases();
  }

  async createAlias(): Promise<RelayAlias> {
    return this.aliasProvider.createAlias();
  }

  async deleteAlias(id: number): Promise<void> {
    return this.aliasProvider.deleteAlias(id);
  }

  async getEmails(
    aliasAddress?: string,
    options?: GetEmailsOptions
  ): Promise<ParsedEmail[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const emails = await this.mailProvider.getMails(limit, offset);

    const parsedEmails: ParsedEmail[] = emails.map((email) => {
      const parsed = this.parser.parseEmail(email.raw);
      return {
        ...parsed,
        id: email.id,
        messageId: email.messageId,
        source: email.source,
        address: email.address,
        createdAt: email.createdAt,
        metadata: email.metadata,
      };
    });

    if (aliasAddress) {
      const normalizedAlias = aliasAddress.toLowerCase();
      return parsedEmails.filter(
        (email) =>
          email.relayAlias?.toLowerCase() === normalizedAlias ||
          email.address.toLowerCase() === normalizedAlias
      );
    }

    return parsedEmails;
  }
}

/** @deprecated Use TempMailClient instead */
export const RelayClient = TempMailClient;
