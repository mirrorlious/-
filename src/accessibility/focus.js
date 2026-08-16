import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',');

let lastMenuTrigger = null;

const isVisible = (element) => Boolean(
  element
  && !element.hidden
  && element.getAttribute('aria-hidden') !== 'true'
  && (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
);

const getFocusableElements = (container) => Array.from(
  container?.querySelectorAll(FOCUSABLE_SELECTOR) || []
).filter(isVisible);

const focusFirstElement = (container) => {
  const preferred = container?.querySelector('[data-autofocus="true"]');
  const target = isVisible(preferred) ? preferred : getFocusableElements(container)[0];
  (target || container)?.focus?.();
};

const useDialogFocus = ({ open, onClose, closeOnEscape = true, fallbackFocusSelector = '' }) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const containingMenu = previousFocus?.closest?.('[role="menu"][id]');
    const controllingTrigger = containingMenu?.id
      ? document.querySelector(`[aria-controls="${CSS.escape(containingMenu.id)}"]`)
      : null;
    const fallbackMenuTrigger = lastMenuTrigger?.isConnected ? lastMenuTrigger : null;
    const frame = requestAnimationFrame(() => focusFirstElement(dialogRef.current));

    const handleKeyDown = (event) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        const escapeFallback = fallbackFocusSelector
          ? document.querySelector(fallbackFocusSelector)
          : (controllingTrigger || fallbackMenuTrigger || previousFocus);
        if (escapeFallback?.isConnected) escapeFallback.focus();
        closeRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown, true);
      requestAnimationFrame(() => {
        const selectorFallback = fallbackFocusSelector
          ? document.querySelector(fallbackFocusSelector)
          : null;
        const target = previousFocus?.isConnected && previousFocus !== document.body
          ? previousFocus
          : (controllingTrigger || selectorFallback || fallbackMenuTrigger);
        if (target?.isConnected) target.focus();
      });
    };
  }, [open, closeOnEscape, fallbackFocusSelector]);

  return dialogRef;
};

const useMenuNavigation = ({ open, onClose }) => {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const previousFocusRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    if (triggerRef.current?.isConnected) lastMenuTrigger = triggerRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => {
      const items = getFocusableElements(menuRef.current);
      items[0]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const onMenuKeyDown = (event) => {
    const items = getFocusableElements(menuRef.current);
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      closeRef.current?.();
      requestAnimationFrame(() => {
        const target = triggerRef.current || previousFocusRef.current;
        if (target?.isConnected) target.focus();
      });
      return;
    }
    if (event.key === 'Tab') {
      closeRef.current?.();
      return;
    }

    let nextIndex;
    if (event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    items[nextIndex].focus();
  };

  return { triggerRef, menuRef, onMenuKeyDown };
};

const handleKeyboardActivation = (event, activate) => {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  activate();
};

const handleArticleVocabularyNavigation = (event) => {
  if (event.defaultPrevented) return false;
  const article = event.currentTarget?.closest?.('[data-reader-vocabulary-region="true"]')
    || event.currentTarget;
  if (!article) return false;
  const eventTarget = event.target || document.activeElement;
  if (eventTarget !== article && !eventTarget?.matches?.('[data-reader-vocabulary="true"]')) return false;
  const items = Array.from(article.querySelectorAll('[data-reader-vocabulary="true"]'))
    .filter(isVisible);
  if (items.length === 0) return false;

  const currentIndex = items.indexOf(document.activeElement);
  let nextIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = currentIndex < 0 ? 0 : Math.min(items.length - 1, currentIndex + 1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = currentIndex < 0 ? items.length - 1 : Math.max(0, currentIndex - 1);
  }
  if (event.key === 'Home' && (currentIndex >= 0 || event.currentTarget === article)) nextIndex = 0;
  if (event.key === 'End' && (currentIndex >= 0 || event.currentTarget === article)) nextIndex = items.length - 1;
  if (nextIndex === undefined) return false;

  event.preventDefault();
  items[nextIndex].focus();
  return true;
};

const handleTabListNavigation = (event) => {
  const tabList = event.currentTarget;
  const tabs = Array.from(tabList?.querySelectorAll?.('[role="tab"]') || [])
    .filter(element => !element.disabled && element.getAttribute('aria-disabled') !== 'true');
  if (tabs.length === 0) return false;
  const currentIndex = tabs.indexOf(document.activeElement);
  let nextIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = currentIndex < 0 ? tabs.length - 1 : (currentIndex - 1 + tabs.length) % tabs.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = tabs.length - 1;
  if (nextIndex === undefined) return false;
  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
  return true;
};

export {
  FOCUSABLE_SELECTOR,
  focusFirstElement,
  getFocusableElements,
  handleArticleVocabularyNavigation,
  handleKeyboardActivation,
  handleTabListNavigation,
  useDialogFocus,
  useMenuNavigation
};
