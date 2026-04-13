import { HttpClient } from './http.js';
import { RelayTempMailError } from './errors.js';
import type { AliasProvider, RelayAlias, DuckDuckGoAliasStore } from './types.js';

interface DuckDuckGoCreateAddressResponse {
  address: string;
}

export class InMemoryDuckDuckGoAliasStore implements DuckDuckGoAliasStore {
  private aliases: RelayAlias[] = [];

  getAll(): RelayAlias[] {
    return [...this.aliases];
  }

  add(alias: RelayAlias): void {
    this.aliases.push(alias);
  }

  remove(id: number): void {
    this.aliases = this.aliases.filter((a) => a.id !== id);
  }
}

export class DuckDuckGoEmailProvider implements AliasProvider {
  private jwtToken: string;
  private httpClient: HttpClient;
  private store: DuckDuckGoAliasStore;
  private nextId: number;

  constructor(
    jwtToken: string,
    store?: DuckDuckGoAliasStore,
    httpClient?: HttpClient
  ) {
    this.jwtToken = jwtToken;
    this.store = store ?? new InMemoryDuckDuckGoAliasStore();
    this.httpClient =
      httpClient ?? new HttpClient('https://quack.duckduckgo.com');
    this.nextId = 1;
  }

  async listAliases(): Promise<RelayAlias[]> {
    return this.store.getAll();
  }

  async createAlias(): Promise<RelayAlias> {
    const response =
      await this.httpClient.request<DuckDuckGoCreateAddressResponse>(
        'POST',
        '/api/email/addresses',
        {
          headers: {
            Authorization: `Bearer ${this.jwtToken}`,
          },
        }
      );

    const fullAddress = `${response.address}@duck.com`;

    const existing = await this.store.getAll();
    if (existing.some((a) => a.fullAddress === fullAddress)) {
      throw new RelayTempMailError(
        `DuckDuckGo returned a duplicate alias: ${fullAddress}`,
        'DUPLICATE_ALIAS',
        201
      );
    }

    const alias: RelayAlias = {
      id: this.nextId++,
      address: response.address,
      fullAddress,
      enabled: true,
      createdAt: new Date().toISOString(),
      domain: 3,
      maskType: 'random',
    };

    await this.store.add(alias);
    return alias;
  }

  async deleteAlias(id: number): Promise<void> {
    await this.store.remove(id);
  }
}
