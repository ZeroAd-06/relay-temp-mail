import { describe, it, expect } from 'vitest';
import {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  ParseError,
  RateLimitError,
} from './errors';

describe('RelayTempMailError', () => {
  it('can be instantiated with message, code, statusCode, and response', () => {
    const error = new RelayTempMailError(
      'Something went wrong',
      'CUSTOM_ERROR',
      500,
      { data: 'test' }
    );

    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('CUSTOM_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.response).toEqual({ data: 'test' });
  });

  it('can be instantiated with only message and code', () => {
    const error = new RelayTempMailError('Simple error', 'SIMPLE_ERROR');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('SIMPLE_ERROR');
    expect(error.statusCode).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  it('has name property set to class name', () => {
    const error = new RelayTempMailError('test', 'TEST');
    expect(error.name).toBe('RelayTempMailError');
  });

  it('is an instance of Error', () => {
    const error = new RelayTempMailError('test', 'TEST');
    expect(error instanceof Error).toBe(true);
  });

  it('is an instance of RelayTempMailError', () => {
    const error = new RelayTempMailError('test', 'TEST');
    expect(error instanceof RelayTempMailError).toBe(true);
  });
});

describe('NetworkError', () => {
  it('has correct error code', () => {
    const error = new NetworkError('Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('can be instantiated with message and response', () => {
    const error = new NetworkError('DNS lookup failed', { reason: 'ENOTFOUND' });

    expect(error.message).toBe('DNS lookup failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.response).toEqual({ reason: 'ENOTFOUND' });
  });

  it('is an instance of RelayTempMailError', () => {
    const error = new NetworkError('test');
    expect(error instanceof RelayTempMailError).toBe(true);
  });

  it('is an instance of Error', () => {
    const error = new NetworkError('test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('AuthError', () => {
  it('has correct error code', () => {
    const error = new AuthError('Unauthorized');
    expect(error.code).toBe('AUTH_ERROR');
  });

  it('can be instantiated with message, statusCode, and response', () => {
    const error = new AuthError('Invalid token', 401, { error: 'invalid_token' });

    expect(error.message).toBe('Invalid token');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.response).toEqual({ error: 'invalid_token' });
  });

  it('defaults statusCode to undefined when not provided', () => {
    const error = new AuthError('Auth failed');
    expect(error.statusCode).toBeUndefined();
  });

  it('is an instance of RelayTempMailError', () => {
    const error = new AuthError('test');
    expect(error instanceof RelayTempMailError).toBe(true);
  });

  it('is an instance of Error', () => {
    const error = new AuthError('test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('has correct error code', () => {
    const error = new NotFoundError('Alias not found');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('defaults statusCode to 404', () => {
    const error = new NotFoundError('Resource not found');
    expect(error.statusCode).toBe(404);
  });

  it('can be instantiated with message and response', () => {
    const error = new NotFoundError('Email not found', { id: 123 });

    expect(error.message).toBe('Email not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.response).toEqual({ id: 123 });
  });

  it('is an instance of RelayTempMailError', () => {
    const error = new NotFoundError('test');
    expect(error instanceof RelayTempMailError).toBe(true);
  });

  it('is an instance of Error', () => {
    const error = new NotFoundError('test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('ParseError', () => {
  it('has correct error code', () => {
    const error = new ParseError('MIME parsing failed');
    expect(error.code).toBe('PARSE_ERROR');
  });

  it('can be instantiated with message and response', () => {
    const error = new ParseError('Invalid header format', { raw: 'broken...' });

    expect(error.message).toBe('Invalid header format');
    expect(error.code).toBe('PARSE_ERROR');
    expect(error.response).toEqual({ raw: 'broken...' });
  });

  it('is an instance of RelayTempMailError', () => {
    const error = new ParseError('test');
    expect(error instanceof RelayTempMailError).toBe(true);
  });

  it('is an instance of Error', () => {
    const error = new ParseError('test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('RateLimitError', () => {
  it('has correct error code', () => {
    const error = new RateLimitError('Too many requests');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
  });

  it('defaults statusCode to 429', () => {
    const error = new RateLimitError('Rate limit exceeded');
    expect(error.statusCode).toBe(429);
  });

  it('can be instantiated with message and response', () => {
    const error = new RateLimitError('Slow down', { retryAfter: 60 });

    expect(error.message).toBe('Slow down');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.statusCode).toBe(429);
    expect(error.response).toEqual({ retryAfter: 60 });
  });

  it('is an instance of RelayTempMailError', () => {
    const error = new RateLimitError('test');
    expect(error instanceof RelayTempMailError).toBe(true);
  });

  it('is an instance of Error', () => {
    const error = new RateLimitError('test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('Error class hierarchy', () => {
  it('all error classes are distinct types', () => {
    const errors = [
      new RelayTempMailError('base', 'BASE'),
      new NetworkError('network'),
      new AuthError('auth'),
      new NotFoundError('notfound'),
      new ParseError('parse'),
      new RateLimitError('ratelimit'),
    ];

    errors.forEach((error) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RelayTempMailError);
    });

    // NetworkError is not an instance of other specific errors
    expect(new NetworkError('n') instanceof AuthError).toBe(false);
    expect(new NetworkError('n') instanceof NotFoundError).toBe(false);
    expect(new NetworkError('n') instanceof ParseError).toBe(false);
    expect(new NetworkError('n') instanceof RateLimitError).toBe(false);

    // AuthError is not an instance of other specific errors
    expect(new AuthError('a') instanceof NetworkError).toBe(false);
    expect(new AuthError('a') instanceof NotFoundError).toBe(false);
    expect(new AuthError('a') instanceof ParseError).toBe(false);
    expect(new AuthError('a') instanceof RateLimitError).toBe(false);
  });
});
