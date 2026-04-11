# relay-temp-mail

[English](README.md) | [中文](README.zh-CN.md)

A modular TypeScript/JavaScript package for managing email aliases and retrieving temporary emails through pluggable providers.

Built on a provider architecture — combine any **alias provider** with any **mail provider** to fit your workflow. Currently ships with Firefox Relay, DuckDuckGo Email Protection, and CloudFlare Temp Mail support.

## Features

- **Provider-based architecture** — mix and match alias + mail providers
- **Firefox Relay** — create, list, and delete email aliases
- **DuckDuckGo Email Protection** — create email aliases with local storage
- **CloudFlare Temp Mail** — retrieve and parse emails via API
- **TypeScript support** — full type definitions for all APIs, including provider interfaces
- **ESM + CommonJS support** — works with both module systems
- **Extensible** — implement `AliasProvider` or `MailProvider` to add new services

## Installation

```bash
npm install @z_06/relay-temp-mail
# or
pnpm add @z_06/relay-temp-mail
# or
bun add @z_06/relay-temp-mail
```

## Quick Start

```typescript
import { TempMailClient } from '@z_06/relay-temp-mail';

const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: 'your-csrf-token',
    sessionId: 'your-session-id',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://your-cf-api.com',
    token: 'your-cf-token',
  },
});

// Create a new alias
const alias = await client.createAlias();
console.log('New alias:', alias.fullAddress);

// List all aliases
const aliases = await client.listAliases();

// Get emails for a specific alias
const emails = await client.getEmails(alias.fullAddress, { limit: 10 });
```

## Providers

The library uses two types of providers that can be combined independently:

| Provider Type | Interface | Current Implementations |
|---|---|---|
| **Alias Provider** | `AliasProvider` | `firefox-relay`, `duckduckgo-email` |
| **Mail Provider** | `MailProvider` | `cf-temp-mail` |

### Alias Providers

#### `firefox-relay`

Manages email aliases through [Firefox Relay](https://relay.firefox.com).

**Configuration:**

```typescript
{
  type: 'firefox-relay',
  csrfToken: string;   // CSRF token from relay.firefox.com cookies
  sessionId: string;   // Session ID from relay.firefox.com cookies
}
```

**Getting your tokens:**

1. Login to [relay.firefox.com](https://relay.firefox.com)
2. Open your browser's developer tools (F12)
3. Go to the Application/Storage tab
4. Find Cookies for `relay.firefox.com`
5. Copy the values for `csrftoken` and `sessionid`

#### `duckduckgo-email`

Manages email aliases through [DuckDuckGo Email Protection](https://duckduckgo.com/email/).

Since the DuckDuckGo API does not provide endpoints for listing or deleting aliases, this provider uses a local store. A default in-memory store is included; implement `DuckDuckGoAliasStore` for custom persistence (e.g., file-based, database).

**Configuration:**

```typescript
{
  type: 'duckduckgo-email',
  jwtToken: string;             // JWT token from DuckDuckGo Email Protection
  store?: DuckDuckGoAliasStore; // Optional custom store (default: in-memory)
}
```

**Getting your JWT token:**

1. Visit [duckduckgo.com/email](https://duckduckgo.com/email/) and register an account
2. Open your browser's developer tools (F12)
3. Click "Generate New Address" in the DuckDuckGo Email UI
4. In the Network tab, find the request to `quack.duckduckgo.com`
5. Copy the Bearer token from the `Authorization` header

**Custom persistence:**

```typescript
import type { DuckDuckGoAliasStore, RelayAlias } from '@z_06/relay-temp-mail';

class MyFileStore implements DuckDuckGoAliasStore {
  getAll(): RelayAlias[] { /* read from file */ }
  add(alias: RelayAlias): void { /* append to file */ }
  remove(id: number): void { /* remove from file */ }
}

const client = new TempMailClient({
  aliasProvider: {
    type: 'duckduckgo-email',
    jwtToken: 'your-jwt-token',
    store: new MyFileStore(),
  },
  mailProvider: { /* ... */ },
});
```

**Duplicate detection:** The DuckDuckGo API may occasionally return a previously-generated address with a 201 response. The provider detects this and throws a `RelayTempMailError` with code `DUPLICATE_ALIAS`.

### Mail Providers

#### `cf-temp-mail`

Retrieves emails from a [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) instance.

**Configuration:**

```typescript
{
  type: 'cf-temp-mail',
  apiUrl: string;  // Base URL of your CF temp email API
  token: string;   // Bearer token for API authentication
}
```

**Deploying the backend:**

1. Fork [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
2. Deploy to Cloudflare Workers (one-click or manual via [docs](https://temp-mail-docs.awsl.uk))
3. Configure Email Routing and catch-all rules in Cloudflare Dashboard
4. Generate an API Token from the admin panel or user settings

## API Documentation

### TempMailClient

Main client class. Accepts an `aliasProvider` and `mailProvider` configuration and exposes a unified interface.

#### Constructor

```typescript
new TempMailClient(config: TempMailConfig)

interface TempMailConfig {
  aliasProvider: AliasProviderConfig;  // Alias provider config (discriminated union)
  mailProvider: MailProviderConfig;    // Mail provider config (discriminated union)
  timeout?: number;                    // Request timeout in ms (default: 30000)
}
```

#### Methods

##### `listAliases()`

Lists all email aliases from the configured alias provider.

```typescript
const aliases = await client.listAliases();
// Returns: RelayAlias[]
```

##### `createAlias()`

Creates a new email alias via the configured alias provider.

```typescript
const alias = await client.createAlias();
// Returns: RelayAlias
console.log(alias.fullAddress); // e.g., "random123@mozmail.com"
```

##### `deleteAlias(id)`

Deletes an alias by its ID.

```typescript
await client.deleteAlias(12345);
```

##### `getEmails(aliasAddress?, options?)`

Retrieves and parses emails from the configured mail provider. If `aliasAddress` is provided, only emails sent to that address are returned.

```typescript
// Get all emails (up to default limit)
const allEmails = await client.getEmails();

// Get emails for a specific alias
const emails = await client.getEmails('alias@mozmail.com', { limit: 10 });

// With pagination
const page2 = await client.getEmails('alias@mozmail.com', { limit: 10, offset: 10 });
```

Options:

- `limit` - Maximum number of emails to return (default: 20)
- `offset` - Offset for pagination, 0-indexed (default: 0)

## Custom Providers

Implement the `AliasProvider` or `MailProvider` interface to add support for new services:

```typescript
import type { AliasProvider, RelayAlias } from '@z_06/relay-temp-mail';

class MyAliasProvider implements AliasProvider {
  async listAliases(): Promise<RelayAlias[]> { /* ... */ }
  async createAlias(): Promise<RelayAlias> { /* ... */ }
  async deleteAlias(id: number): Promise<void> { /* ... */ }
}
```

```typescript
import type { MailProvider, Email } from '@z_06/relay-temp-mail';

class MyMailProvider implements MailProvider {
  async getMails(limit: number, offset: number): Promise<Email[]> { /* ... */ }
}
```

## Error Handling

The package exports several error classes for handling different failure scenarios:

```typescript
import {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  ParseError,
  RateLimitError,
} from '@z_06/relay-temp-mail';

try {
  const alias = await client.createAlias();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network problem:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.response?.retryAfter);
  } else if (error instanceof RelayTempMailError) {
    console.error('Error:', error.code, error.message);
  }
}
```

### Error Classes

| Class | Description | Status Code |
|-------|-------------|-------------|
| `RelayTempMailError` | Base error class for all package errors | - |
| `NetworkError` | Network connectivity issues | - |
| `AuthError` | Authentication or authorization failures | 401/403 |
| `NotFoundError` | Requested resource not found | 404 |
| `ParseError` | Email MIME parsing failures | - |
| `RateLimitError` | API rate limit exceeded | 429 |

All error classes extend `RelayTempMailError` and provide:

- `code` - Machine-readable error code
- `statusCode` - HTTP status code (if applicable)
- `response` - Raw response data from the API (if available)

## TypeScript

All types are fully exported, including the provider interfaces:

```typescript
import type {
  AliasProvider,
  MailProvider,
  TempMailConfig,
  FirefoxRelayConfig,
  DuckDuckGoEmailConfig,
  DuckDuckGoAliasStore,
  CFTempMailConfig,
  RelayAlias,
  Email,
  ParsedEmail,
  GetEmailsOptions,
} from '@z_06/relay-temp-mail';
```

## Migration from v1

<details>
<summary>v1 → v2 Migration Guide</summary>

**`RelayClient` → `TempMailClient`**

```typescript
// v1 (deprecated)
import { RelayClient } from '@z_06/relay-temp-mail';
const client = new RelayClient({
  csrfToken: '...',
  sessionId: '...',
  cfApiUrl: 'https://...',
  cfToken: '...',
});

// v2
import { TempMailClient } from '@z_06/relay-temp-mail';
const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: '...',
    sessionId: '...',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://...',
    token: '...',
  },
});
```

**`RelayAPIClient` → `FirefoxRelayProvider`**, **`CFEmailClient` → `CFTempMailProvider`**

The old names are still exported as deprecated aliases. The method signatures are unchanged.

</details>

## License

MIT
