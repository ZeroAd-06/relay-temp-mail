# 提供商配置指南

[English](PROVIDERS.md) | [中文](PROVIDERS.zh-CN.md)

所有内置提供商的详细配置与凭证获取指南。

---

## 别名提供商

### `firefox-relay`

通过 [Firefox Relay](https://relay.firefox.com) 管理邮箱别名。

#### 配置

```typescript
{
  type: 'firefox-relay',
  csrfToken: string;   // relay.firefox.com 的 CSRF token
  sessionId: string;   // relay.firefox.com 的 Session ID
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `'firefox-relay'` | 是 | 提供商标识符 |
| `csrfToken` | `string` | 是 | relay.firefox.com Cookies 中的 CSRF token |
| `sessionId` | `string` | 是 | relay.firefox.com Cookies 中的 Session ID |

#### 获取 Token

1. 登录 [relay.firefox.com](https://relay.firefox.com)
2. 打开浏览器开发者工具（F12）
3. 切换到 **Application**（Chrome）/ **Storage**（Firefox）标签页
4. 展开 **Cookies**，选择 `relay.firefox.com`
5. 复制以下值：
   - `csrftoken` → 用作 `csrfToken`
   - `sessionid` → 用作 `sessionId`

#### 使用示例

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

通过 [DuckDuckGo 邮件保护](https://duckduckgo.com/email/) 管理邮箱别名。

由于 DuckDuckGo API 不提供列出或删除别名的接口，该提供商使用本地存储。内置内存存储；可通过实现 `DuckDuckGoAliasStore` 接口自定义持久化（如文件、数据库）。

#### 配置

```typescript
{
  type: 'duckduckgo-email',
  jwtToken: string;             // DuckDuckGo 邮件保护的 JWT token
  store?: DuckDuckGoAliasStore; // 可选自定义存储（默认: 内存存储）
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `'duckduckgo-email'` | 是 | 提供商标识符 |
| `jwtToken` | `string` | 是 | DuckDuckGo 邮件保护 API 的 JWT token |
| `store` | `DuckDuckGoAliasStore` | 否 | 自定义别名存储（默认: 内存存储） |

#### 获取 JWT Token

1. 访问 [duckduckgo.com/email](https://duckduckgo.com/email/) 并注册账户
2. 打开浏览器开发者工具（F12）
3. 在 DuckDuckGo 邮件界面点击 **"生成新地址"**
4. 在 **网络** 请求栏中找到发往 `quack.duckduckgo.com` 的请求
5. 从 `Authorization` 请求头中复制 Bearer token → 用作 `jwtToken`

#### 自定义持久化

默认情况下，别名存储在内存中，进程退出后丢失。实现 `DuckDuckGoAliasStore` 接口以自定义持久化：

```typescript
import type { DuckDuckGoAliasStore, RelayAlias } from '@z_06/relay-temp-mail';

class MyFileStore implements DuckDuckGoAliasStore {
  getAll(): RelayAlias[] { /* 从文件读取 */ }
  add(alias: RelayAlias): void { /* 追加到文件 */ }
  remove(id: number): void { /* 从文件中删除 */ }
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

#### 重复检测

DuckDuckGo API 偶尔会返回之前已生成过的地址（仍返回 201）。该提供商会检测这种情况并抛出 `RelayTempMailError`，错误代码为 `DUPLICATE_ALIAS`。

---

## 邮件提供商

### `cf-temp-mail`

从 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) 实例获取邮件。

#### 配置

```typescript
{
  type: 'cf-temp-mail',
  apiUrl: string;  // CF 临时邮箱 API 的基础 URL
  token: string;   // API Bearer Token
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `'cf-temp-mail'` | 是 | 提供商标识符 |
| `apiUrl` | `string` | 是 | CloudFlare 临时邮箱 API 的基础 URL |
| `token` | `string` | 是 | API 认证用的 Bearer Token |

#### 部署后端

1. Fork [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
2. 部署到 Cloudflare Workers（一键部署或参考[部署文档](https://temp-mail-docs.awsl.uk)手动部署）
3. 在 Cloudflare Dashboard 中配置域名和 Email Routing 的 catch-all 规则
4. 从管理后台或用户设置中生成 API Token → 用作 `token`

部署后的 URL 即为 `apiUrl`（例如 `https://mail.example.com`）。

#### 使用示例

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

---

### `gmail`

通过 [Gmail API](https://developers.google.com/gmail/api) 从 Gmail 账户获取邮件。

支持两种认证模式：

1. **Access Token** — 直接提供 `accessToken`，适用于自行管理 OAuth2 token 刷新的场景。
2. **OAuth2 Refresh Token** — 提供 `clientId`、`clientSecret` 和 `refreshToken`，提供商将自动刷新过期的 access token。

#### 配置

```typescript
{
  type: 'gmail',
  userId?: string;         // Gmail 地址（默认: 'me'）
  accessToken?: string;    // 方式 A: 直接提供 access token
  clientId?: string;       // 方式 B: 提供 OAuth2 凭证
  clientSecret?: string;
  refreshToken?: string;
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `'gmail'` | 是 | 提供商标识符 |
| `userId` | `string` | 否 | API 调用中使用的 Gmail 地址（默认: `'me'`） |
| `accessToken` | `string` | 条件必填 | OAuth2 access token。不使用 refresh token 认证时必填 |
| `clientId` | `string` | 条件必填 | Google OAuth2 客户端 ID。使用 refresh token 认证时必填 |
| `clientSecret` | `string` | 条件必填 | Google OAuth2 客户端密钥。使用 refresh token 认证时必填 |
| `refreshToken` | `string` | 条件必填 | Google OAuth2 刷新令牌。不提供 `accessToken` 时必填 |

#### 获取 OAuth2 凭证

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目（或选择已有项目）
3. 在 API 库中启用 **Gmail API**
4. 进入 **凭据** → **创建凭据** → **OAuth 客户端 ID**
5. 应用类型选择 **桌面应用** 或 **网页应用**
6. 复制 `client_id` 和 `client_secret`
7. 使用 OAuth2 Playground 或自行实现流程获取 `refresh_token`，所需权限范围为 `https://www.googleapis.com/auth/gmail.readonly`

#### 使用示例

```typescript
import { TempMailClient } from '@z_06/relay-temp-mail';

// 方式 A: 使用 access token（自行管理刷新）
const client = new TempMailClient({
  aliasProvider: { /* ... */ },
  mailProvider: {
    type: 'gmail',
    accessToken: 'ya29.a0AfH6...',
  },
});

// 方式 B: 使用 OAuth2 refresh token（提供商自动刷新）
const client = new TempMailClient({
  aliasProvider: { /* ... */ },
  mailProvider: {
    type: 'gmail',
    clientId: 'your-client-id.apps.googleusercontent.com',
    clientSecret: 'your-client-secret',
    refreshToken: '1//0g...',
  },
});
```
