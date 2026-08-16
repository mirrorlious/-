import React, { useEffect, useRef, useState } from 'react';

const FEEDBACK_EVENT = 'yang-reader-feedback';
let feedbackSequence = 0;

const normalizeMessage = (message) => String(message ?? '').replace(/\s+/g, ' ').trim();

const notify = (message, type = 'success', options = {}) => {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage || typeof window === 'undefined') return null;
  const detail = {
    id: ++feedbackSequence,
    message: normalizedMessage,
    type: ['success', 'warning', 'error', 'info'].includes(type) ? type : 'info',
    duration: Number.isFinite(options.duration) ? Math.max(0, options.duration) : 6500
  };
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail }));
  return detail.id;
};

const announce = (message, priority = 'polite') => notify(
  message,
  priority === 'assertive' ? 'error' : 'info',
  { duration: 0 }
);

const toastTone = {
  success: 'reader-toast-success',
  warning: 'reader-toast-warning',
  error: 'reader-toast-error',
  info: 'reader-toast-info'
};

const AccessibilityFeedback = () => {
  const [toasts, setToasts] = useState([]);
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const timersRef = useRef(new Map());

  const removeToast = (id) => {
    const state = timersRef.current.get(id);
    if (state?.timer) window.clearTimeout(state.timer);
    timersRef.current.delete(id);
    setToasts(current => current.filter(item => item.id !== id));
  };

  const scheduleRemoval = (item, remaining = item.duration) => {
    if (!remaining) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => removeToast(item.id), remaining);
    timersRef.current.set(item.id, { timer, startedAt, remaining });
  };

  const pauseRemoval = (id) => {
    const state = timersRef.current.get(id);
    if (!state) return;
    window.clearTimeout(state.timer);
    timersRef.current.set(id, {
      ...state,
      timer: null,
      remaining: Math.max(500, state.remaining - (Date.now() - state.startedAt))
    });
  };

  const resumeRemoval = (item) => {
    const state = timersRef.current.get(item.id);
    if (!state || state.timer) return;
    scheduleRemoval(item, state.remaining);
  };

  useEffect(() => {
    const handleFeedback = (event) => {
      const item = event.detail;
      if (!item?.message) return;
      if (item.type === 'error') setAssertiveMessage(`${item.message}\u00a0`);
      else setPoliteMessage(`${item.message}\u00a0`);
      if (item.duration === 0) return;
      setToasts(current => [...current.slice(-2), item]);
      scheduleRemoval(item);
    };
    window.addEventListener(FEEDBACK_EVENT, handleFeedback);
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, handleFeedback);
      timersRef.current.forEach(state => state?.timer && window.clearTimeout(state.timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <>
      <div className="reader-sr-only" aria-live="polite" aria-atomic="true" data-reader-live="polite">{politeMessage}</div>
      <div className="reader-sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-reader-live="assertive">{assertiveMessage}</div>
      <div className="reader-toast-stack" role="region" aria-label="系统通知" aria-live="off">
        {toasts.map(item => (
          <div
            key={item.id}
            className={`reader-toast ${toastTone[item.type]}`}
            data-toast-type={item.type}
            onMouseEnter={() => pauseRemoval(item.id)}
            onMouseLeave={() => resumeRemoval(item)}
            onFocusCapture={() => pauseRemoval(item.id)}
            onBlurCapture={() => resumeRemoval(item)}
          >
            <span>{item.message}</span>
            <button type="button" onClick={() => removeToast(item.id)} aria-label={`关闭通知：${item.message}`}>×</button>
          </div>
        ))}
      </div>
    </>
  );
};

const SkipLinks = ({ showLearningPanel = false }) => (
  <nav className="reader-skip-links" aria-label="快捷跳转">
    <a href="#reader-main-content">跳到主要内容</a>
    <a href="#reader-article-content">跳到文章正文</a>
    {showLearningPanel && <a href="#reader-learning-panel">跳到学习结果</a>}
  </nav>
);

export { AccessibilityFeedback, SkipLinks, announce, notify };
