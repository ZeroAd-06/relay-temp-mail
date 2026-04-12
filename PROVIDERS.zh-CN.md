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
