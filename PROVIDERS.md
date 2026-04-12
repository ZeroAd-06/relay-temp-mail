# Provider Setup Guide

[English](PROVIDERS.md) | [中文](PROVIDERS.zh-CN.md)

Detailed configuration and credential acquisition guide for all built-in providers.

---

## Alias Providers

### `firefox-relay`

Manages email aliases through [Firefox Relay](https://relay.firefox.com).

#### Configuration

```typescript
{
  type: 'firefox-relay',
  csrfToken: string;   // CSRF token from relay.firefox.com cookies
  sessionId: string;   // Session ID from relay.firefox.com cookies
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | `'firefox-relay'` | Yes | Provider discriminator |
| `csrfToken` | `string` | Yes | CSRF token from relay.firefox.com cookies |
| `sessionId` | `string` | Yes | Session ID from relay.firefox.com cookies |

#### Getting Your Tokens

1. Login to [relay.firefox.com](https://relay.firefox.com)
2. Open your browser's developer tools (F12)
3. Go to the **Application** (Chrome) / **Storage** (Firefox) tab
4. Expand **Cookies** and select `relay.firefox.com`
5. Copy the values for:
   - `csrftoken` → use as `csrfToken`
   - `sessionid` → use as `sessionId`

#### Usage Example

```typescript
import { TempMailClient } from '@z_06/relay-temp-mail';

const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: 'your-csrf-token',
    sessionId: 'your-session-id',
  },
  mailProvider: { /* ... */ },
});
```

---

### `duckduckgo-email`

Manages email aliases through [DuckDuckGo Email Protection](https://duckduckgo.com/email/).

Since the DuckDuckGo API does not provide endpoints for listing or deleting aliases, this provider uses a local store. A default in-memory store is included; implement `DuckDuckGoAliasStore` for custom persistence (e.g., file-based, database).

#### Configuration

```typescript
{
  type: 'duckduckgo-email',
  jwtToken: string;             // JWT token from DuckDuckGo Email Protection
  store?: DuckDuckGoAliasStore; // Optional custom store (default: in-memory)
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | `'duckduckgo-email'` | Yes | Provider discriminator |
| `jwtToken` | `string` | Yes | JWT token for DuckDuckGo Email Protection API |
| `store` | `DuckDuckGoAliasStore` | No | Custom alias store (default: in-memory) |

#### Getting Your JWT Token

1. Visit [duckduckgo.com/email](https://duckduckgo.com/email/) and register an account
2. Open your browser's developer tools (F12)
3. Click **"Generate New Address"** in the DuckDuckGo Email UI
4. In the **Network** tab, find the request to `quack.duckduckgo.com`
5. Copy the Bearer token from the `Authorization` header → use as `jwtToken`

#### Custom Persistence

By default, aliases are stored in memory and lost when the process exits. Implement `DuckDuckGoAliasStore` for custom persistence:

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

#### Duplicate Detection

The DuckDuckGo API may occasionally return a previously-generated address with a 201 response. The provider detects this and throws a `RelayTempMailError` with code `DUPLICATE_ALIAS`.

---

## Mail Providers

### `cf-temp-mail`

Retrieves emails from a [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) instance.

#### Configuration

```typescript
{
  type: 'cf-temp-mail',
  apiUrl: string;  // Base URL of your CF temp email API
  token: string;   // Bearer token for API authentication
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | `'cf-temp-mail'` | Yes | Provider discriminator |
| `apiUrl` | `string` | Yes | Base URL of your CloudFlare temp email API |
| `token` | `string` | Yes | Bearer token for API authentication |

#### Deploying the Backend

1. Fork [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
2. Deploy to Cloudflare Workers (one-click or manual via [docs](https://temp-mail-docs.awsl.uk))
3. Configure Email Routing and catch-all rules in Cloudflare Dashboard
4. Generate an API Token from the admin panel or user settings → use as `token`

Your deployed URL becomes the `apiUrl` (e.g., `https://mail.example.com`).

#### Usage Example

```typescript
import { TempMailClient } from '@z_06/relay-temp-mail';

const client = new TempMailClient({
  aliasProvider: { /* ... */ },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://your-cf-api.com',
    token: 'your-cf-token',
  },
});
```
