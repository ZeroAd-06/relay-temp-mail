/**
 * MIME email parser for extracting Firefox Relay alias information.
 */
import type { ParsedEmail } from './types.js';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MOZMAIL_SUFFIX_PATTERN = /@mozmail\.com$/i;
const ENCODED_WORD_PATTERN = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

/**
 * EmailParser class for parsing MIME email content.
 */
export class EmailParser {
  parseEmail(raw: string): ParsedEmail {
    const headers = this.parseHeaders(raw);
    const toHeader = headers.get('to') || '';
    const fromHeader = headers.get('from') || '';
    const messageIdHeader = headers.get('message-id') || '';
    const relayAlias = this.extractRelayAlias(raw);
    
    return {
      id: 0,
      messageId: this.extractMessageId(messageIdHeader),
      source: this.extractEmailAddress(fromHeader),
      address: this.extractEmailAddress(toHeader),
      raw,
      metadata: null,
      createdAt: new Date().toISOString(),
      relayAlias: relayAlias || undefined,
    };
  }

  extractRelayAlias(raw: string): string | null {
    try {
      const headers = this.parseHeaders(raw);
      const toHeader = headers.get('to');
      if (!toHeader) return null;
      
      const decodedTo = this.decodeHeader(toHeader);
      const matches = decodedTo.match(EMAIL_PATTERN);
      if (!matches || matches.length === 0) return null;

      const normalizedAddresses = matches.map((match) => match.toLowerCase());
      return (
        normalizedAddresses.find((address) => MOZMAIL_SUFFIX_PATTERN.test(address)) ??
        normalizedAddresses[0]
      );
    } catch {
      return null;
    }
  }

  private parseHeaders(raw: string): Map<string, string> {
    const headers = new Map<string, string>();
    const headerEnd = raw.indexOf('\r\n\r\n');
    const headerSection = headerEnd === -1 ? raw : raw.substring(0, headerEnd);
    const lines = headerSection.split(/\r?\n/);
    let currentHeader: string | null = null;
    let currentValue = '';
    
    for (const line of lines) {
      if (/^\s/.test(line)) {
        if (currentHeader) currentValue += ' ' + line.trim();
      } else {
        if (currentHeader) headers.set(currentHeader, currentValue);
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          currentHeader = line.substring(0, colonIndex).toLowerCase().trim();
          currentValue = line.substring(colonIndex + 1).trim();
        } else {
          currentHeader = null;
          currentValue = '';
        }
      }
    }
    if (currentHeader) headers.set(currentHeader, currentValue);
    return headers;
  }

  private decodeHeader(value: string): string {
    return value.replace(ENCODED_WORD_PATTERN, (_, charset, encoding, encoded) => {
      try {
        if (encoding.toUpperCase() === 'Q') {
          return this.decodeQuotedPrintable(encoded);
        } else if (encoding.toUpperCase() === 'B') {
          return this.decodeBase64(encoded);
        }
        return encoded;
      } catch {
        return encoded;
      }
    });
  }

  private decodeQuotedPrintable(encoded: string): string {
    // RFC 2047: underscores represent spaces in encoded-word
    let decoded = encoded.replace(/_/g, ' ');
    decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
    return decoded;
  }

  private decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }

  private extractEmailAddress(headerValue: string): string {
    if (!headerValue) return '';
    const decoded = this.decodeHeader(headerValue);
    const bracketMatch = decoded.match(/<([^>]+)>/);
    if (bracketMatch) return bracketMatch[1].trim().toLowerCase();
    const emailMatch = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return emailMatch ? emailMatch[0].toLowerCase() : decoded.trim().toLowerCase();
  }

  private extractMessageId(headerValue: string): string {
    if (!headerValue) return `<generated-${Date.now()}@relay-temp-mail>`;
    const cleaned = headerValue.replace(/[<>]/g, '').trim();
    return `<${cleaned}>`;
  }
}
