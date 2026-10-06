import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let storage;
let transactions;
let db;
let indexedDB;

beforeEach(async () => {
  vi.resetModules();
  transactions = [];
  db = {
    objectStoreNames: { contains: name => name === 'ai-cache' },
    close: vi.fn(),
    transaction: vi.fn(() => {
      const request = {};
      const transaction = { request, objectStore: () => ({ put: () => request, get: () => request, delete: () => request, getAll: () => request }) };
      transaction.abort = () => transaction.onabort?.();
      transactions.push(transaction);
      return transaction;
    })
  };
  indexedDB = { open: vi.fn(() => {
    const request = { result: db };
    queueMicrotask(() => request.onsuccess());
    return request;
  }) };
  vi.stubGlobal('window', { indexedDB, crypto: webcrypto });
  storage = await import('../../src/core/persistence.js');
});

afterEach(() => vi.unstubAllGlobals());

describe('local data reliability', () => {
  it('waits for transaction commit and reuses the database connection', async () => {
    let settled = false;
    const saving = storage.writeReaderStore('ai-cache', { key: 'k', value: 'v' }).then(value => { settled = true; return value; });
    await vi.waitFor(() => expect(transactions).toHaveLength(1));
    transactions[0].request.onsuccess();
    await Promise.resolve();
    expect(settled).toBe(false);
    transactions[0].oncomplete();
    expect(await saving).toBe(true);
    const reading = storage.readReaderStore('ai-cache', 'k');
    await vi.waitFor(() => expect(transactions).toHaveLength(2));
    transactions[1].request.result = { key: 'k', value: 'v' };
    transactions[1].request.onsuccess();
    transactions[1].oncomplete();
    expect(await reading).toEqual({ key: 'k', value: 'v' });
    expect(indexedDB.open).toHaveBeenCalledTimes(1);
  });

  it('reports failure when a successful request is followed by transaction abort', async () => {
    const saving = storage.writeReaderStore('ai-cache', { key: 'k' });
    await vi.waitFor(() => expect(transactions).toHaveLength(1));
    transactions[0].request.onsuccess();
    transactions[0].abort();
    expect(await saving).toBe(false);
  });

  it('closes a connection for a version upgrade and reopens on the next operation', async () => {
    expect(await storage.readReaderStore('missing', 'k')).toBeNull();
    db.onversionchange();
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(await storage.readAllReaderStore('missing')).toEqual([]);
    expect(indexedDB.open).toHaveBeenCalledTimes(2);
  });

  it('fails gracefully when browser storage is unavailable', async () => {
    window.indexedDB = { open: () => { throw new Error('blocked'); } };
    expect(await storage.writeReaderStore('ai-cache', { key: 'k' })).toBe(false);
    expect(await storage.readReaderStore('ai-cache', 'k')).toBeNull();
  });

  it('hashes full content and distinguishes equally sized files', async () => {
    expect(await storage.hashText('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await storage.hashBytes(new Uint8Array([1, 2]))).not.toBe(await storage.hashBytes(new Uint8Array([2, 1])));
    expect(await storage.hashText('same-prefix'.repeat(20) + 'A')).not.toBe(await storage.hashText('same-prefix'.repeat(20) + 'B'));
  });

  it('rejects insecure hashing instead of silently reusing unrelated content', async () => {
    window.crypto = {};
    await expect(storage.hashText('abc')).rejects.toThrow('HTTPS');
  });

  it('separates protocol versions while keeping secrets outside cache identities', async () => {
    const a = await storage.buildCacheKey('llm', 'input', { model: 'm', key: 'first' });
    expect(a).toBe(await storage.buildCacheKey('llm', 'input', { model: 'm', key: 'second' }));
    expect(a).not.toBe(await storage.buildCacheKey('llm', 'input', { model: 'm', apiVersion: 'v1' }));
  });
});
