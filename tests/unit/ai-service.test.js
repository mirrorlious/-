import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/core/persistence.js', async importOriginal => ({
  ...await importOriginal(),
  readReaderStore: vi.fn(),
  writeReaderStore: vi.fn()
}));

import { callLLM, callGeminiTranslation, callGeminiTTS, extractTextFromMedia } from '../../src/services/ai.js';
import { readReaderStore, writeReaderStore, resolveTaskApiConfig } from '../../src/core/persistence.js';
import { getEndpoint } from '../../src/core/api-config.js';

const config = { apiType: 'gemini', model: 'test-model', key: 'test-key' };
const response = (value = 'OK') => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: value }] } }] })
});

beforeEach(() => {
  vi.stubGlobal('window', {
    crypto: { subtle: { digest: async (_, bytes) => Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer } },
    sessionStorage: { getItem: () => 'stored-old-key' },
    localStorage: { getItem: () => null }
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  readReaderStore.mockReset().mockResolvedValue(null);
  writeReaderStore.mockReset().mockResolvedValue(true);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('AI request orchestration', () => {
  it('regenerates a paragraph only when the caller explicitly bypasses its cache', async () => {
    readReaderStore.mockResolvedValue({ value: 'saved translation' });
    expect(await callGeminiTranslation('paragraph', config)).toBe('saved translation');
    expect(fetch).not.toHaveBeenCalled();
    expect(await callGeminiTranslation('paragraph', config, { bypassCache: true })).toBe('OK');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('shares concurrent calls and writes one cache entry', async () => {
    expect(await Promise.all([callLLM('same', config), callLLM('same', config)])).toEqual(['OK', 'OK']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(writeReaderStore).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).not.toContain('test-key');
    expect(options.headers['x-goog-api-key']).toBe('test-key');
    expect(JSON.stringify(writeReaderStore.mock.calls)).not.toContain('test-key');
  });

  it('uses persisted results while connection tests force a live request', async () => {
    readReaderStore.mockResolvedValue({ value: 'cached' });
    expect(await callLLM('same', config)).toBe('cached');
    expect(fetch).not.toHaveBeenCalled();
    expect(await callLLM('same', config, false, 'analysis', { bypassCache: true })).toBe('OK');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses the explicitly entered key instead of a previous session key', () => {
    expect(resolveTaskApiConfig(config).key).toBe('test-key');
    expect(resolveTaskApiConfig({ ...config, key: '' }).key).toBe('stored-old-key');
  });

  it('releases a failed shared request and never repeats an ambiguous network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('test-key echoed by network'));
    await expect(callLLM('retry', config)).rejects.toThrow('网络请求失败');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await callLLM('retry', config)).toBe('OK');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not echo provider errors or retry unauthorized requests', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'test-key private content' });
    await expect(callLLM('failure', config)).rejects.toThrow('HTTP 401');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(writeReaderStore).not.toHaveBeenCalled();
  });

  it('retries explicit transient statuses', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(callback => { queueMicrotask(callback); return 0; });
    fetch.mockResolvedValueOnce({ ok: false, status: 429 });
    expect(await callLLM('rate-limit', config)).toBe('OK');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('joins text parts and ignores thought parts', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [
      { text: 'internal', thought: true }, { text: 'Hello ' }, { text: 'world' }
    ] } }] }) });
    expect(await callLLM('parts', config)).toBe('Hello world');
  });

  it('parses fenced JSON independently from App globals', async () => {
    fetch.mockResolvedValue(response('```json\n{"valid":true}\n```'));
    expect(await callLLM('json', config, true)).toEqual({ valid: true });
  });

  it('rejects empty responses without caching them', async () => {
    fetch.mockResolvedValue(response(''));
    await expect(callLLM('empty', config)).rejects.toThrow('有效文本');
    expect(writeReaderStore).not.toHaveBeenCalled();
  });

  it('keeps credentials out of all Gemini URLs and respects a configured TTS model', () => {
    const url = getEndpoint({ ...config, baseUrl: 'https://example.com/v1beta/models/old:generateContent?KEY=legacy-secret&alt=json' });
    expect(url).not.toContain('legacy-secret');
    expect(url).toContain('alt=json');
    expect(getEndpoint({ ...config, model: 'custom-tts' }, true)).toContain('/custom-tts:');
  });

  it('sends OCR credentials through the same header boundary', async () => {
    expect(await extractTextFromMedia('sample', 'image/png', config)).toBe('OK');
    const [url, options] = fetch.mock.calls[0];
    expect(url).not.toContain('test-key');
    expect(options.headers['x-goog-api-key']).toBe('test-key');
  });

  it('sends TTS credentials through the same header boundary', async () => {
    await expect(callGeminiTTS('sample', config)).rejects.toThrow('音频');
    expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-key');
  });
});
