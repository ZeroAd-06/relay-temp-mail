import { describe, it, expect } from 'vitest';
import { EmailParser } from './parser';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, '..', 'tests', 'fixtures');

describe('EmailParser', () => {
  const parser = new EmailParser();

  describe('extractRelayAlias', () => {
    it('finds mozmail.com address in To header', () => {
      const raw = `From: sender@example.com
To: t1ou9gl4l@mozmail.com
Subject: Test Email
Message-Id: <abc123@example.com>
Date: Fri, 03 Apr 2026 17:12:55 +0000

Test email body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('t1ou9gl4l@mozmail.com');
    });

    it('handles multiple recipients with mozmail.com', () => {
      const raw = `From: sender@example.com
To: other@example.com, abc123xyz@mozmail.com
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('abc123xyz@mozmail.com');
    });

    it('returns null for emails without mozmail.com', () => {
      const raw = `From: sender@example.com
To: recipient@other.com
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('recipient@other.com');
    });

    it('handles quoted-printable encoding in To header', () => {
      const raw = `From: sender@example.com
To: =?UTF-8?Q?t1ou9gl4l@mozmail=2Ecom?=
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('t1ou9gl4l@mozmail.com');
    });

    it('handles base64 encoding in To header', () => {
      // base64 of "test@mozmail.com"
      const raw = `From: sender@example.com
To: =?UTF-8?B?dGVzdEBtb3ptYWlsLmNvbQ==?=
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('test@mozmail.com');
    });

    it('does not throw on malformed content', () => {
      const malformedInputs = [
        '',
        'Not a valid email',
        'To: malformed',
        'To: <unclosed bracket',
        '\x00\x01\x02 binary data',
      ];

      malformedInputs.forEach(raw => {
        expect(() => parser.extractRelayAlias(raw)).not.toThrow();
      });
    });

    it('returns null when To header is missing', () => {
      const raw = `From: sender@example.com
Subject: No To Header

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBeNull();
    });

    it('extracts custom-domain aliases from To header', () => {
      const raw = `From: sender@example.com
To: tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org');
    });

    it('prefers mozmail alias from Relay From header over custom-domain To header', () => {
      const raw = `From: "otp@tm1.openai.com [via Relay]" <ptnzsk1t7@mozmail.com>
To: tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('ptnzsk1t7@mozmail.com');
    });

    it('extracts @duck.com alias from To header', () => {
      const raw = `From: sender@example.com
To: abc-def-ghi@duck.com
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('abc-def-ghi@duck.com');
    });

    it('prefers Duck-Original-To header over To header', () => {
      const raw = `From: sender@example.com
To: real-inbox@gmail.com
Duck-Original-To: xyz-abc-123@duck.com
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('xyz-abc-123@duck.com');
    });

    it('prefers duck.com over mozmail when both present', () => {
      const raw = `From: sender@example.com
To: abc@duck.com, xyz@mozmail.com
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('abc@duck.com');
    });

    it('extracts duck.com alias from Duck-Original-To with display name', () => {
      const raw = `From: sender@example.com
To: Real Name <real-inbox@gmail.com>
Duck-Original-To: <test-alias@duck.com>
Subject: Test

Body`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('test-alias@duck.com');
    });

    it('finds @duck.com address by scanning full raw content when headers are stripped', () => {
      const raw = `From: sender@example.com
To: real-inbox@gmail.com
Subject: Your code

This email was sent to crumb-very-growing@duck.com. Your verification code is 123456.`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('crumb-very-growing@duck.com');
    });

    it('prefers header match over body match for duck.com', () => {
      const raw = `From: sender@example.com
To: header-alias@duck.com
Subject: Test

Mention of body-alias@duck.com in the body.`;

      const alias = parser.extractRelayAlias(raw);
      expect(alias).toBe('header-alias@duck.com');
    });
  });

  describe('parseEmail', () => {
    it('extracts all fields correctly from sample email', () => {
      const samplePath = join(fixturesDir, 'sample-email.txt');
      const raw = readFileSync(samplePath, 'utf-8');

      const parsed = parser.parseEmail(raw);

      expect(parsed.id).toBe(0);
      expect(parsed.messageId).toBe('<abc123@example.com>');
      expect(parsed.source).toBe('sender@example.com');
      expect(parsed.address).toBe('t1ou9gl4l@mozmail.com');
      expect(parsed.relayAlias).toBe('t1ou9gl4l@mozmail.com');
      expect(parsed.raw).toBe(raw);
      expect(parsed.metadata).toBeNull();
      expect(parsed.createdAt).toBeDefined();
    });

    it('generates message ID when missing', () => {
      const raw = `From: sender@example.com
To: t1ou9gl4l@mozmail.com
Subject: Test

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.messageId).toMatch(/<generated-\d+@relay-temp-mail>/);
    });

    it('handles From header with display name', () => {
      const raw = `From: Display Name <sender@example.com>
To: t1ou9gl4l@mozmail.com
Subject: Test

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.source).toBe('sender@example.com');
    });

    it('handles To header with display name', () => {
      const raw = `From: sender@example.com
To: Some Name <t1ou9gl4l@mozmail.com>
Subject: Test

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.address).toBe('t1ou9gl4l@mozmail.com');
    });

    it('handles header folding', () => {
      const raw = `From: sender@example.com
To: t1ou9gl4l@mozmail.com,
 other@example.com
Subject: Test

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.address).toBe('t1ou9gl4l@mozmail.com');
    });

    it('parses email without relay alias', () => {
      const raw = `From: sender@example.com
To: normal@example.com
Subject: Test
Message-Id: <msg123@example.com>

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.relayAlias).toBe('normal@example.com');
    });

    it('parses relay-forwarded email with mozmail alias in From header', () => {
      const raw = `From: "otp@tm1.openai.com [via Relay]" <ptnzsk1t7@mozmail.com>
To: tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org
Subject: Test
Message-Id: <relay@example.com>

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.address).toBe('tmpnie91@wwwwwwwwwwwwedlihgt.dpdns.org');
      expect(parsed.relayAlias).toBe('ptnzsk1t7@mozmail.com');
    });
  });

  describe('encoding handling', () => {
    it('handles quoted-printable UTF-8 subject', () => {
      const raw = `From: =?UTF-8?Q?=E6=B5=8B=E8=AF=95=E5=8F=91=E4=BB=B6=E4=BA=BA?= <sender@example.com>
To: t1ou9gl4l@mozmail.com
Subject: =?UTF-8?Q?=E6=B5=8B=E8=AF=95=E9=82=AE=E4=BB=B6?=

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.source).toBe('sender@example.com');
    });

    it('handles base64 encoded header', () => {
      // Base64 of "测试" in UTF-8
      const raw = `From: =?UTF-8?B?5rWL6K+V?= <sender@example.com>
To: t1ou9gl4l@mozmail.com
Subject: Test

Body`;

      const parsed = parser.parseEmail(raw);
      expect(parsed.source).toBe('sender@example.com');
    });
  });
});
