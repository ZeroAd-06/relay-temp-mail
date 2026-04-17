import { TempMailClient } from './src/index.ts';

const ddgToken = 'nfsr8ebqkrp9otiokcyxrcyfnitlmcuusxqktbk5orpstvfjydl0uns6qep0mu';
const cfApiUrl = 'https://temp-email-api.wwwwwwwwwwwwedlihgt.dpdns.org/';
const cfToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoidG1wZHVja2R1Y2sxQHd3d3d3d3d3d3d3d2VkbGloZ3QuZHBkbnMub3JnIiwiYWRkcmVzc19pZCI6MjA4fQ.Boh3DImmDwuTUFm2KEcBjbzVktASHQ7S_9Hy-gVUv2I';

async function testDuckDuckGo() {
  console.log('=== 测试 DuckDuckGo 别名提供者 ===\n');

  const client = new TempMailClient({
    aliasProvider: {
      type: 'duckduckgo',
      jwtToken: ddgToken,
    },
    mailProvider: {
      type: 'cf-temp-mail',
      apiUrl: cfApiUrl,
      token: cfToken,
    },
  });

  try {
    console.log('1. 创建 DuckDuckGo 别名...');
    const alias = await client.createAlias();
    console.log('   别名地址:', alias.fullAddress);
    console.log('   别名 ID:', alias.id);

    console.log('\n2. 列出所有别名...');
    const aliases = await client.listAliases();
    console.log('   别名数量:', aliases.length);
    for (const a of aliases) {
      console.log(`   - ${a.fullAddress}`);
    }

    console.log('\n3. 获取邮件...');
    const emails = await client.getEmails(alias.fullAddress, { limit: 5 });
    console.log('   邮件数量:', emails.length);

    if (emails.length > 0) {
      console.log('   最新邮件:');
      emails.slice(0, 3).forEach((e, i) => {
        console.log(`   [${i + 1}] 发件人: ${e.source}`);
        console.log(`       时间: ${e.createdAt}`);
      });
    } else {
      console.log('   暂无邮件');
    }

    console.log('\n✅ DuckDuckGo 测试成功!');
    return alias.fullAddress;
  } catch (error) {
    console.error('❌ DuckDuckGo 测试失败:', error);
    throw error;
  }
}

async function testCFTempMail() {
  console.log('\n\n=== 测试 CloudFlare Temp Mail ===\n');

  const client = new TempMailClient({
    aliasProvider: {
      type: 'firefox-relay',
      csrfToken: 'test',
      sessionId: 'test',
    },
    mailProvider: {
      type: 'cf-temp-mail',
      apiUrl: cfApiUrl,
      token: cfToken,
    },
  });

  try {
    console.log('1. 获取邮件...');
    const emails = await client.getEmails();
    console.log('   邮件数量:', emails.length);

    if (emails.length > 0) {
      console.log('   邮件列表:');
      emails.slice(0, 10).forEach((e, i) => {
        console.log(`   [${i + 1}] 地址: ${e.address}`);
        console.log(`       发件人: ${e.source}`);
        console.log(`       时间: ${e.createdAt}`);
        console.log('');
      });
    } else {
      console.log('   暂无邮件');
    }

    console.log('✅ CloudFlare Temp Mail 测试成功!');
  } catch (error) {
    console.error('❌ CloudFlare Temp Mail 测试失败:', error);
  }
}

async function sendTestEmail(aliasAddress: string) {
  console.log('\n\n=== 发送测试邮件到:', aliasAddress, '===\n');

  try {
    const response = await fetch('https://www.codeflicker.ai/api/auth/email/send-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: aliasAddress }),
    });

    const data = await response.text();
    console.log('响应状态:', response.status);
    console.log('响应内容:', data);
    console.log('✅ 邮件发送请求完成');
  } catch (error) {
    console.error('❌ 发送邮件失败:', error);
  }
}

async function main() {
  console.log('🚀 RelayTempMail 集成测试\n');
  console.log('='.repeat(50));

  const alias = await testDuckDuckGo();

  console.log('\n等待 3 秒后获取邮件...');
  await new Promise(r => setTimeout(r, 3000));

  await testCFTempMail();

  console.log('\n' + '='.repeat(50));
  console.log('🏁 测试完成!');
}

main().catch(console.error);
