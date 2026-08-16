import {
  CURRENT_GEMINI_TEXT_MODEL,
  CURRENT_GEMINI_TTS_MODEL,
  normalizeApiConfig
} from './api-config.js';

const DEFAULT_API_CONFIG = {
    apiType: 'gemini', key: '', model: CURRENT_GEMINI_TEXT_MODEL,
    baseUrl: 'https://generativelanguage.googleapis.com', apiVersion: 'v1beta',
    rememberKey: false,
    taskRoutes: {
        analysis: { model: CURRENT_GEMINI_TEXT_MODEL },
        ocr: { model: CURRENT_GEMINI_TEXT_MODEL },
        tts: { model: CURRENT_GEMINI_TTS_MODEL }
    }
};

const DEFAULT_TYPOGRAPHY_CONFIG = {
    preset: 'editorial',
    fontFamily: 'Georgia, "Times New Roman", serif',
    readingFontFamily: 'Georgia, "Times New Roman", serif',
    chineseFontFamily: '"Noto Serif SC", STSong, serif',
    fontSize: 20,
    lineHeight: 1.72,
    paragraphSpacing: 1.05,
    measure: 66,
    paddingX: 6,
    theme: 'light',
    typographyMigrationVersion: 1
};

const TYPOGRAPHY_PRESETS = {
    editorial: { readingFontFamily: 'Georgia, "Times New Roman", serif', chineseFontFamily: '"Noto Serif SC", STSong, serif', fontSize: 20, lineHeight: 1.72, paragraphSpacing: 1.05, measure: 66 },
    modern: { readingFontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', chineseFontFamily: 'system-ui, "Microsoft YaHei", sans-serif', fontSize: 18, lineHeight: 1.65, paragraphSpacing: 0.9, measure: 70 },
    classic: { readingFontFamily: '"Times New Roman", Times, serif', chineseFontFamily: 'STSong, SimSun, serif', fontSize: 21, lineHeight: 1.85, paragraphSpacing: 1.2, measure: 62 },
    custom: {}
};

const LOCAL_STORAGE_KEY = 'yang-reader-state-v1';

const API_KEY_SESSION_STORAGE_KEY = 'yang-reader-api-key-v1';

const API_KEY_LOCAL_STORAGE_KEY = 'yang-reader-api-key-v1';

const READER_DB_NAME = 'yang-reader-local-v1';

const READER_DB_VERSION = 3;

const CACHE_PROMPT_VERSION = '2026-07-26-v1';

const openReaderDb = () => new Promise((resolve) => {
    if (!window.indexedDB) { resolve(null); return; }
    const request = window.indexedDB.open(READER_DB_NAME, READER_DB_VERSION);
    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('ai-cache')) db.createObjectStore('ai-cache', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('tts-cache')) db.createObjectStore('tts-cache', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('pdf-tasks')) db.createObjectStore('pdf-tasks', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('book-imports')) db.createObjectStore('book-imports', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('book-articles')) db.createObjectStore('book-articles', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('article-bundles')) db.createObjectStore('article-bundles', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('batch-analysis-jobs')) db.createObjectStore('batch-analysis-jobs', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
});

const readReaderStore = async (storeName, key) => {
    const db = await openReaderDb();
    if (!db) return null;
    return new Promise(resolve => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};

const writeReaderStore = async (storeName, value) => {
    const db = await openReaderDb();
    if (!db) return false;
    return new Promise(resolve => {
        const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
};

const deleteReaderStore = async (storeName, key) => {
    const db = await openReaderDb();
    if (!db) return false;
    return new Promise(resolve => {
        const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
};

const readAllReaderStore = async (storeName) => {
    const db = await openReaderDb();
    if (!db || !db.objectStoreNames.contains(storeName)) return [];
    return new Promise(resolve => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => resolve([]);
    });
};

const hashText = async (value) => {
    const bytes = new TextEncoder().encode(value);
    if (window.crypto?.subtle) {
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(value))).slice(0, 64);
};

const hashBytes = async (bytes) => {
    if (window.crypto?.subtle) {
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return hashText(String(bytes.byteLength));
};

const buildCacheKey = async (kind, input, config = {}, options = {}) => {
    const identity = JSON.stringify({ kind, input, model: config.model || '', apiType: config.apiType || '', baseUrl: config.baseUrl || '', promptVersion: CACHE_PROMPT_VERSION, options });
    return `${kind}:${await hashText(identity)}`;
};

const getStoredApiKey = (legacyKey = '') => {
    try {
        const sessionKey = window.sessionStorage.getItem(API_KEY_SESSION_STORAGE_KEY);
        if (sessionKey) return sessionKey;
        const rememberedKey = window.localStorage.getItem(API_KEY_LOCAL_STORAGE_KEY);
        if (rememberedKey) return rememberedKey;
        if (legacyKey) {
            window.sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, legacyKey);
            try {
                const state = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || '{}') || {};
                if (state.apiConfig?.key) {
                    const { key, ...safeApiConfig } = state.apiConfig;
                    state.apiConfig = safeApiConfig;
                    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
                }
            } catch (error) { console.warn('Legacy API Key cleanup failed'); }
            return legacyKey;
        }
    } catch (error) { console.warn('API Key restore failed'); }
    return '';
};

const sanitizeApiConfig = (config = {}) => {
    const { key, ...safeConfig } = config;
    return { ...safeConfig, key: '' };
};

const persistApiKey = (config = {}) => {
    try {
        const key = String(config.key || '').trim();
        if (key) window.sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, key);
        else window.sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY);
        if (config.rememberKey && key) window.localStorage.setItem(API_KEY_LOCAL_STORAGE_KEY, key);
        else window.localStorage.removeItem(API_KEY_LOCAL_STORAGE_KEY);
    } catch (error) { console.warn('API Key save failed'); }
};

const resolveTaskApiConfig = (config = {}, task = 'analysis') => {
    const route = config.taskRoutes?.[task] || {};
    return normalizeApiConfig({ ...config, ...route, key: getStoredApiKey(config.key) });
};

export {
  DEFAULT_API_CONFIG,
  DEFAULT_TYPOGRAPHY_CONFIG,
  TYPOGRAPHY_PRESETS,
  LOCAL_STORAGE_KEY,
  CACHE_PROMPT_VERSION,
  readReaderStore,
  writeReaderStore,
  deleteReaderStore,
  readAllReaderStore,
  hashText,
  hashBytes,
  buildCacheKey,
  getStoredApiKey,
  sanitizeApiConfig,
  persistApiKey,
  resolveTaskApiConfig
};
