// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { notify } from '../../src/accessibility/feedback.jsx';

describe('accessibility feedback events', () => {
  it('normalizes untrusted text and emits an assertive error notification', () => {
    const listener = vi.fn();
    window.addEventListener('yang-reader-feedback', listener, { once: true });

    notify('  请求失败\n<script>alert(1)</script>  ', 'error');

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      message: '请求失败 <script>alert(1)</script>',
      type: 'error',
      duration: 6500
    });
  });
});
