import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getModelSafeText } from '../core/pdf-text.js';
import { callGeminiTranslation } from '../services/ai.js';
import { Paragraph as BaseParagraph } from './Paragraph.jsx';
import './bilingual-reading.css';

const MODE_STORAGE_KEY = 'yang-reader-bilingual-mode-v1';
const modeListeners = new Set();
const paragraphRegistry = new Map();
const registryListeners = new Set();
let registryVersion = 0;
let bilingualModeEnabled = false;

try {
  bilingualModeEnabled = window.localStorage.getItem(MODE_STORAGE_KEY) === 'true';
} catch { /* Reading remains available when preferences cannot be restored. */ }

export const setBilingualModeEnabled = (nextValue) => {
  const next = Boolean(nextValue);
  if (next === bilingualModeEnabled) return;
  bilingualModeEnabled = next;
  try { window.localStorage.setItem(MODE_STORAGE_KEY, String(next)); }
  catch { /* This preference is optional; translation results are stored separately. */ }
  modeListeners.forEach(listener => listener());
};

const subscribeMode = listener => {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
};
const subscribeRegistry = listener => {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
};
const emitRegistryChange = () => {
  registryVersion += 1;
  registryListeners.forEach(listener => listener());
};
const registerParagraph = (key, controller) => {
  paragraphRegistry.set(key, controller);
  emitRegistryChange();
  return () => {
    if (paragraphRegistry.get(key) !== controller) return;
    paragraphRegistry.delete(key);
    emitRegistryChange();
  };
};

export const useBilingualMode = () => useSyncExternalStore(subscribeMode, () => bilingualModeEnabled, () => false);

export const ReadingModeControls = ({ readingMode, onModeChange, iconClass }) => {
  const enabled = useBilingualMode();
  const selectMode = mode => {
    setBilingualModeEnabled(false);
    onModeChange(mode);
  };
  const toggleSideTranslation = () => {
    setBilingualModeEnabled(!enabled);
    requestAnimationFrame(() => document.querySelector('#reader-article-content')?.focus());
  };
  return (
    <div className="flex items-center gap-1 rounded-sm border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70 p-1" role="group" aria-label="阅读模式">
      <button type="button" onClick={() => selectMode('pure')} className={iconClass(!enabled && readingMode === 'pure')} aria-pressed={!enabled && readingMode === 'pure'} aria-label="纯净阅读" title="纯净阅读">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 5.5A2.5 2.5 0 016.5 3H11v16H6.5A2.5 2.5 0 004 21.5v-16zm16 0A2.5 2.5 0 0017.5 3H13v16h4.5a2.5 2.5 0 012.5 2.5v-16z" /></svg>
      </button>
      <button type="button" onClick={() => selectMode('intensive')} className={iconClass(!enabled && readingMode === 'intensive')} aria-pressed={!enabled && readingMode === 'intensive'} aria-label="深度精读" title="深度精读">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 11l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14zM6 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" /></svg>
      </button>
      <button type="button" onClick={toggleSideTranslation} className="yang-side-translation-toggle" aria-pressed={enabled} aria-label="侧面翻译（中英对照阅读）" title="左侧原文，右侧逐段译文">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" strokeWidth="1.8" /><path d="M12 4.5v15M6.5 9h3M6.5 12h3M14.5 9h3M14.5 12h3" strokeLinecap="round" strokeWidth="1.5" /></svg>
        <span>侧面翻译</span>
      </button>
    </div>
  );
};

const idleBulkState = { running: false, current: 0, total: 0, failures: 0 };
export const BilingualReadingHeader = ({ articleId, title }) => {
  const enabled = useBilingualMode();
  const snapshot = useSyncExternalStore(subscribeRegistry, () => registryVersion, () => 0);
  const [bulkState, setBulkState] = useState(idleBulkState);
  const runRef = useRef(null);
  const controllers = useMemo(() => Array.from(paragraphRegistry.values())
    .filter(controller => controller.articleId === articleId)
    .sort((a, b) => a.paragraphIndex - b.paragraphIndex), [articleId, snapshot]);
  const readyCount = controllers.filter(controller => controller.hasTranslation).length;

  useEffect(() => {
    setBulkState(idleBulkState);
    runRef.current = null;
    return () => { if (runRef.current) runRef.current.cancelled = true; };
  }, [articleId, enabled]);

  const translateAllParagraphs = async () => {
    if (runRef.current && !runRef.current.finished) return;
    const targets = controllers.filter(controller => !controller.hasTranslation);
    if (!targets.length) return;
    const run = { cancelled: false, finished: false };
    runRef.current = run;
    let failures = 0;
    let completed = 0;
    setBulkState({ running: true, current: 0, total: targets.length, failures: 0 });
    for (const controller of targets) {
      if (run.cancelled) break;
      setBulkState({ running: true, current: completed + 1, total: targets.length, failures });
      try { await controller.translate({ silent: true }); }
      catch { failures += 1; }
      completed += 1;
    }
    run.finished = true;
    if (run.cancelled) return;
    setBulkState({ running: false, current: completed, total: targets.length, failures });
    window.showToast?.(failures
      ? `对照翻译完成，${completed - failures} 段成功，${failures} 段失败；可在失败段落重试`
      : `已生成 ${completed} 段侧面译文`, failures ? 'warning' : 'success');
  };

  if (!enabled) return null;
  return (
    <section id="yang-bilingual-header-host" className="yang-bilingual-header" aria-label="中英对照阅读说明" aria-busy={bulkState.running}>
      <div className="yang-bilingual-heading-copy">
        <div className="yang-bilingual-kicker">PARALLEL READING · 侧面翻译</div>
        <h2>{title || '当前文章'}</h2>
        <p>左侧读原文，右侧看译文，逐段对齐、一起滚动。点击“翻译本段”按需生成，已有译文直接沿用。</p>
      </div>
      <div className="yang-bilingual-header-actions">
        <div className="yang-bilingual-legend" role="status">
          <span>{readyCount}/{controllers.length} 段已有译文</span>
        </div>
        <button type="button" onClick={translateAllParagraphs}
          disabled={bulkState.running || controllers.length === 0 || readyCount === controllers.length}
          className="yang-bilingual-bulk-button">
          {bulkState.running ? `逐段翻译 ${bulkState.current}/${bulkState.total}`
            : readyCount === controllers.length && controllers.length > 0 ? '译文已齐全' : '生成全文对照译文'}
        </button>
      </div>
    </section>
  );
};

export const BilingualParagraph = (props) => {
  const enabled = useBilingualMode();
  const { articleId, text, paragraphIndex, translationText, savedResults, apiConfig, typographyConfig, onPersistParagraphResult } = props;
  const sourceIdentity = `${articleId}:${paragraphIndex}:${text}`;
  const currentSourceRef = useRef(sourceIdentity);
  currentSourceRef.current = sourceIdentity;
  const mountedRef = useRef(false);
  const pendingRef = useRef(null);
  const [state, setState] = useState({ identity: sourceIdentity, translation: '', loading: false, error: '' });
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const currentState = state.identity === sourceIdentity ? state : {};
  const savedTranslation = !savedResults?.sourceText || savedResults.sourceText === text ? savedResults?.translation || '' : '';
  const visibleTranslation = currentState.translation || savedTranslation || translationText || '';
  const isTranslating = Boolean(currentState.loading);

  const translate = useCallback(({ silent = false, force = false } = {}) => {
    if (pendingRef.current?.identity === sourceIdentity) return pendingRef.current.promise;
    if (!force && visibleTranslation) return Promise.resolve(visibleTranslation);
    const stillCurrent = () => mountedRef.current && currentSourceRef.current === sourceIdentity;
    setState({ identity: sourceIdentity, translation: visibleTranslation, loading: true, error: '' });
    const pending = { identity: sourceIdentity, promise: null };
    pendingRef.current = pending;
    const promise = (async () => {
      try {
        const translated = String(await callGeminiTranslation(
          getModelSafeText(text, 12000, '侧面段落翻译'), apiConfig, { bypassCache: force }
        ) || '').trim();
        if (!translated) throw new Error('模型未返回译文');
        if (!stillCurrent()) return '';
        setState({ identity: sourceIdentity, translation: translated, loading: false, error: '' });
        onPersistParagraphResult?.({
          kind: 'paragraph-translation', title: `第 ${paragraphIndex + 1} 段 · 侧面翻译`,
          paragraphIndex, sourceText: text,
          data: { translation: translated, alignment: 'paragraph-locked' }, createdAt: Date.now()
        });
        return translated;
      } catch (error) {
        if (stillCurrent()) {
          setState({ identity: sourceIdentity, translation: visibleTranslation, loading: false, error: error.message });
          if (!silent) window.showToast?.(`第 ${paragraphIndex + 1} 段翻译失败：${error.message}`, 'error');
        }
        throw error;
      } finally {
        if (pendingRef.current === pending) pendingRef.current = null;
      }
    })();
    pending.promise = promise;
    return promise;
  }, [apiConfig, onPersistParagraphResult, paragraphIndex, sourceIdentity, text, visibleTranslation]);

  const controller = useMemo(() => ({ articleId, paragraphIndex, translate, hasTranslation: Boolean(visibleTranslation) }),
    [articleId, paragraphIndex, translate, visibleTranslation]);
  useEffect(() => registerParagraph(sourceIdentity, controller), [controller, sourceIdentity]);

  if (!enabled) return <BaseParagraph key={sourceIdentity} {...props} />;
  const requestTranslation = force => {
    // Errors are shown in the paragraph and notification before this rejection is handled.
    translate({ force }).catch(() => undefined);
  };

  return (
    <div className="yang-bilingual-row" data-reader-bilingual-row="true" data-paragraph-index={paragraphIndex}>
      <section className="yang-bilingual-source" aria-label={`第 ${paragraphIndex + 1} 段英文原文`}>
        <span className="yang-bilingual-paragraph-label" aria-hidden="true">P{paragraphIndex + 1}</span>
        <BaseParagraph key={sourceIdentity} {...props} readingMode="intensive" translationText={undefined} />
      </section>
      <section className="yang-bilingual-translation" aria-label={`第 ${paragraphIndex + 1} 段中文翻译`}
        aria-busy={isTranslating} style={{
          fontFamily: typographyConfig?.chineseFontFamily || '"Noto Serif SC", STSong, serif',
          fontSize: `${Math.max(14, (typographyConfig?.fontSize || 16) - 2)}px`,
          lineHeight: typographyConfig?.lineHeight || 1.8
        }}>
        <div className="yang-bilingual-translation-meta">
          <span>译文 · 第 {paragraphIndex + 1} 段</span>
          {visibleTranslation && (
            <button type="button" disabled={isTranslating} onClick={() => requestTranslation(true)}
              aria-label={`重新翻译第 ${paragraphIndex + 1} 段`} title="使用当前模型重新生成，将消耗模型额度">重新翻译</button>
          )}
        </div>
        {visibleTranslation && <div className="yang-bilingual-translation-text">{visibleTranslation}</div>}
        {isTranslating && <div className="yang-bilingual-translation-loading" role="status">正在生成译文…</div>}
        {currentState.error && <div className="yang-bilingual-error" role="alert">{currentState.error}</div>}
        {!visibleTranslation && !isTranslating && (
          <div className="yang-bilingual-empty">
            <span>{currentState.error ? '这一段翻译失败，可重新尝试。' : '这一段还没有中文译文。'}</span>
            <button type="button" onClick={() => requestTranslation(false)}>{currentState.error ? '重新尝试' : '翻译本段'}</button>
          </div>
        )}
      </section>
    </div>
  );
};
