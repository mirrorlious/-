import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
} catch (error) {
  bilingualModeEnabled = false;
}

const emitModeChange = () => modeListeners.forEach(listener => listener());
const emitRegistryChange = () => {
  registryVersion += 1;
  registryListeners.forEach(listener => listener());
};

const setBilingualModeEnabled = (nextValue) => {
  const next = Boolean(nextValue);
  if (next === bilingualModeEnabled) return;
  bilingualModeEnabled = next;
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, String(next));
  } catch (error) {}
  emitModeChange();
};

const subscribeMode = (listener) => {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
};

const subscribeRegistry = (listener) => {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
};

const registerParagraph = (paragraphIndex, controller) => {
  paragraphRegistry.set(paragraphIndex, controller);
  emitRegistryChange();
  return () => {
    if (paragraphRegistry.get(paragraphIndex) === controller) {
      paragraphRegistry.delete(paragraphIndex);
      emitRegistryChange();
    }
  };
};

const useBilingualMode = () => useSyncExternalStore(
  subscribeMode,
  () => bilingualModeEnabled,
  () => false
);

const getArticleTitle = () => {
  const raw = document.title || '';
  return raw.replace(/\s*·\s*杨的外刊阅读器\s*$/, '').trim() || '当前文章';
};

const findModeHost = () => document.querySelector(
  '[role="toolbar"][aria-label="阅读工具栏"] [role="group"][aria-label="阅读模式"]'
);

const ensureHeaderHost = () => {
  const content = document.querySelector('#reader-article-content');
  if (!content?.parentElement) return null;
  let host = document.querySelector('#yang-bilingual-header-host');
  if (!host || host.parentElement !== content.parentElement) {
    host?.remove();
    host = document.createElement('div');
    host.id = 'yang-bilingual-header-host';
    content.parentElement.insertBefore(host, content);
  }
  return host;
};

export const BilingualModeController = () => {
  const enabled = useBilingualMode();
  const registrySnapshot = useSyncExternalStore(subscribeRegistry, () => registryVersion, () => 0);
  const [modeHost, setModeHost] = useState(null);
  const [headerHost, setHeaderHost] = useState(null);
  const [bulkState, setBulkState] = useState({ running: false, current: 0, total: 0, failures: 0 });

  useEffect(() => {
    const syncHosts = () => {
      setModeHost(findModeHost());
      setHeaderHost(ensureHeaderHost());
    };
    syncHosts();
    const observer = new MutationObserver(syncHosts);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleReaderModeClick = (event) => {
      const button = event.target?.closest?.('button');
      const label = button?.getAttribute?.('aria-label');
      if (label === '纯净阅读' || label === '深度精读') setBilingualModeEnabled(false);
    };
    document.addEventListener('click', handleReaderModeClick, true);
    return () => document.removeEventListener('click', handleReaderModeClick, true);
  }, []);

  useEffect(() => {
    const content = document.querySelector('#reader-article-content');
    const pageShell = document.querySelector('.reader-page-shell');
    content?.classList.toggle('yang-bilingual-active', enabled);
    pageShell?.classList.toggle('yang-bilingual-page', enabled);
    return () => {
      content?.classList.remove('yang-bilingual-active');
      pageShell?.classList.remove('yang-bilingual-page');
    };
  }, [enabled, modeHost, headerHost]);

  const controllers = useMemo(
    () => Array.from(paragraphRegistry.entries()).sort(([a], [b]) => a - b).map(([, controller]) => controller),
    [registrySnapshot]
  );
  const lockedCount = controllers.filter(controller => controller.hasLockedTranslation()).length;

  const enableBilingualMode = () => {
    const standardLayoutButton = document.querySelector('button[aria-label="标准布局"]');
    if (standardLayoutButton?.getAttribute('aria-pressed') !== 'true') standardLayoutButton?.click();
    const singleColumnButton = document.querySelector('button[aria-label="切换为文章单栏"]');
    singleColumnButton?.click();
    setBilingualModeEnabled(true);
    window.requestAnimationFrame(() => document.querySelector('#reader-article-content')?.focus());
  };

  const toggleBilingualMode = () => {
    if (enabled) setBilingualModeEnabled(false);
    else enableBilingualMode();
  };

  const translateAllParagraphs = async () => {
    if (bulkState.running) return;
    const targets = Array.from(paragraphRegistry.entries())
      .sort(([a], [b]) => a - b)
      .map(([, controller]) => controller)
      .filter(controller => !controller.hasLockedTranslation());

    if (!targets.length) {
      window.showToast?.('所有段落都已有段落锁定译文', 'success');
      return;
    }

    setBulkState({ running: true, current: 0, total: targets.length, failures: 0 });
    let failures = 0;
    for (let index = 0; index < targets.length; index += 1) {
      setBulkState({ running: true, current: index + 1, total: targets.length, failures });
      try {
        await targets[index].translate({ silent: true });
      } catch (error) {
        failures += 1;
      }
    }
    setBulkState({ running: false, current: targets.length, total: targets.length, failures });
    if (failures) window.showToast?.(`对照翻译完成，${targets.length - failures} 段成功，${failures} 段失败`, 'warning');
    else window.showToast?.(`已生成 ${targets.length} 段逐段锁定译文`, 'success');
  };

  const modeButton = modeHost ? createPortal(
    <button
      type="button"
      onClick={toggleBilingualMode}
      className={`w-9 h-9 shrink-0 grid place-items-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 ${enabled ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-700 dark:hover:text-emerald-300'}`}
      aria-pressed={enabled}
      aria-label="中英对照阅读"
      title="中英对照阅读"
      data-reader-bilingual-toggle="true"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" strokeWidth="1.8"></rect>
        <path d="M12 4.5v15" strokeWidth="1.8"></path>
        <path d="M6.5 9h3M6.5 12h3M14.5 9h3M14.5 12h3M14.5 15h2" strokeLinecap="round" strokeWidth="1.5"></path>
      </svg>
    </button>,
    modeHost
  ) : null;

  const header = enabled && headerHost ? createPortal(
    <section className="yang-bilingual-header" aria-label="中英对照阅读说明">
      <div className="yang-bilingual-heading-copy">
        <div className="yang-bilingual-kicker">PARALLEL READING · 中英对照</div>
        <h2>{getArticleTitle()}</h2>
        <p>英文原文与中文译文按段落锁定对齐；已有全文译文可直接沿用，逐段生成后会保存为当前文章的段落结果。</p>
      </div>
      <div className="yang-bilingual-header-actions">
        <div className="yang-bilingual-legend" aria-hidden="true">
          <span><i className="yang-bilingual-swatch"></i>考研词汇</span>
          <span>{lockedCount}/{controllers.length} 段已锁定</span>
        </div>
        <button
          type="button"
          onClick={translateAllParagraphs}
          disabled={bulkState.running || controllers.length === 0 || lockedCount === controllers.length}
          className="yang-bilingual-bulk-button"
        >
          {bulkState.running
            ? `逐段翻译 ${bulkState.current}/${bulkState.total}`
            : lockedCount === controllers.length && controllers.length > 0
              ? '段落译文已锁定'
              : '生成全文对照译文'}
        </button>
      </div>
    </section>,
    headerHost
  ) : null;

  return <>{modeButton}{header}</>;
};

export const BilingualParagraph = (props) => {
  const enabled = useBilingualMode();
  const {
    text,
    paragraphIndex,
    translationText,
    savedResults,
    apiConfig,
    typographyConfig,
    onPersistParagraphResult
  } = props;
  const [lockedTranslation, setLockedTranslation] = useState(savedResults?.translation || '');
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (savedResults?.translation) setLockedTranslation(savedResults.translation);
  }, [paragraphIndex, savedResults?.translation, savedResults?.updatedAt]);

  const translate = useCallback(async ({ silent = false } = {}) => {
    if (lockedTranslation) return lockedTranslation;
    if (isTranslating) return '';
    setIsTranslating(true);
    try {
      const translated = String(await callGeminiTranslation(
        getModelSafeText(text, 12000, '中英对照段落翻译'),
        apiConfig
      ) || '').trim();
      if (!translated) throw new Error('模型未返回译文');
      setLockedTranslation(translated);
      onPersistParagraphResult?.({
        kind: 'paragraph-translation',
        title: `第 ${paragraphIndex + 1} 段 · 对照翻译`,
        paragraphIndex,
        sourceText: text,
        data: { translation: translated, alignment: 'paragraph-locked' },
        createdAt: Date.now()
      });
      return translated;
    } catch (error) {
      if (!silent) window.showToast?.(`第 ${paragraphIndex + 1} 段翻译失败：${error.message}`, 'error');
      throw error;
    } finally {
      setIsTranslating(false);
    }
  }, [apiConfig, isTranslating, lockedTranslation, onPersistParagraphResult, paragraphIndex, text]);

  const controller = useMemo(() => ({
    translate,
    hasLockedTranslation: () => Boolean(lockedTranslation)
  }), [lockedTranslation, translate]);

  useEffect(() => registerParagraph(paragraphIndex, controller), [controller, paragraphIndex]);

  if (!enabled) return <BaseParagraph {...props} />;

  const visibleTranslation = lockedTranslation || translationText || '';
  const isLegacyTranslation = !lockedTranslation && Boolean(translationText);

  return (
    <div className="yang-bilingual-row" data-reader-bilingual-row="true" data-paragraph-index={paragraphIndex}>
      <section className="yang-bilingual-source" aria-label={`第 ${paragraphIndex + 1} 段英文原文`}>
        <span className="yang-bilingual-paragraph-label" aria-hidden="true">P{paragraphIndex + 1}</span>
        <BaseParagraph
          {...props}
          readingMode="intensive"
          translationText={undefined}
          inlineResultsEnabled={props.inlineResultsEnabled}
        />
      </section>
      <section
        className="yang-bilingual-translation"
        role="region"
        aria-label={`第 ${paragraphIndex + 1} 段中文翻译`}
        aria-busy={isTranslating || (!visibleTranslation && props.isTransLoading)}
        style={{
          fontFamily: typographyConfig?.chineseFontFamily || '"Noto Serif SC", STSong, serif',
          fontSize: `${Math.max(14, (typographyConfig?.fontSize || 16) - 2)}px`,
          lineHeight: typographyConfig?.lineHeight || 1.8
        }}
      >
        <div className="yang-bilingual-translation-meta">
          <span>译文</span>
          {lockedTranslation ? <span className="yang-bilingual-status">段落锁定</span> : isLegacyTranslation ? <span className="yang-bilingual-status yang-bilingual-status-muted">全文译文</span> : null}
        </div>
        {visibleTranslation ? (
          <div className="yang-bilingual-translation-text">{visibleTranslation}</div>
        ) : isTranslating || props.isTransLoading ? (
          <div className="yang-bilingual-translation-loading" role="status">正在生成译文…</div>
        ) : (
          <div className="yang-bilingual-empty">
            <span>这一段还没有中文译文。</span>
            <button type="button" onClick={() => translate()} disabled={isTranslating}>翻译本段</button>
          </div>
        )}
      </section>
    </div>
  );
};
