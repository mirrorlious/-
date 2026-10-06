import React from 'react';
import { useDialogFocus } from '../accessibility/focus.js';

export const MobileAnnotationDialog = ({ annotation, onClose }) => {
  const dialogRef = useDialogFocus({ open: true, onClose });
  return (
    <>
      <button type="button" className="fixed inset-0 z-[70] bg-black/10 backdrop-blur-[1px]" aria-label="关闭批注气泡" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="本段批注"
        tabIndex={-1}
        data-reader-annotation-bubble="true"
        className="fixed left-3 right-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-[71] max-h-[46vh] overflow-y-auto rounded-2xl border border-amber-200 dark:border-amber-800 bg-white/98 dark:bg-gray-900/98 shadow-2xl p-4 animate-fade-in-down"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-wider text-amber-700 dark:text-amber-400">本段批注</div>
            <div className="mt-1 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300 line-clamp-3">“{annotation.anchor?.exact || '已标注文字'}”</div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300" aria-label="关闭批注">×</button>
        </div>
        <div className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-gray-800 dark:text-gray-200">{annotation.note || '这条批注暂时没有正文。'}</div>
        <div className="mt-3 text-[10px] text-gray-400">{new Date(annotation.updatedAt || annotation.createdAt || Date.now()).toLocaleString('zh-CN')}</div>
      </div>
    </>
  );
};
