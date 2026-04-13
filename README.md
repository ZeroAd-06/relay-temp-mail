# relay-temp-mail

[English](README.md) | [中文](README.zh-CN.md)

A modular TypeScript/JavaScript package for managing email aliases and retrieving temporary emails through pluggable providers.

Built on a provider architecture. Combine any **alias provider** with any **mail provider** to fit your workflow. Currently ships with Firefox Relay, SimpleLogin, DuckDuckGo Email Protection, CloudFlare Temp Mail, and Gmail support.

## Features

- **Provider-based architecture** — mix and match alias + mail providers
- **Firefox Relay** — create, list, and delete email aliases
- **SimpleLogin** — create, list, and delete email aliases
- **DuckDuckGo Email Protection** — create email aliases with local storage
- **CloudFlare Temp Mail** — retrieve and parse emails via API
- **Gmail** — retrieve emails via Gmail API with OAuth2 support
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

| Provider Type | Interface | Available Providers |
|---|---|---|
| **Alias Provider** | `AliasProvider` | `firefox-relay`, `simplelogin`, `duckduckgo-email` |
| **Mail Provider** | `MailProvider` | `cf-temp-mail`, `gmail` |

For detailed configuration parameters and credential acquisition guides, see **[Provider Setup Guide](PROVIDERS.md)**.

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
  SimpleLoginConfig,
  DuckDuckGoConfig,
  DuckDuckGoAliasStore,
  CFTempMailConfig,
  GmailConfig,
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
