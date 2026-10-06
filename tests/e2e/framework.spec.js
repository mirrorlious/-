import { expect, test } from '@playwright/test';

const readBundleMetadata = (page) => page.evaluate(async () => {
  const history = JSON.parse(localStorage.getItem('yang-reader-state-v1') || '{}').history || [];
  if (!history[0]) return null;
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('yang-reader-local-v1', 3);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('article-bundles').objectStore('article-bundles').get(history[0].bundleKey || `article:${history[0].id}`);
      request.onsuccess = () => resolve(request.result?.metadata || null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
});

test('首次 PWA 安装保留正在输入的阅读内容', async ({ page }) => {
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
  await page.goto('/');
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await expect(page.getByText('63 词', { exact: true })).toBeVisible();
  expect(navigations).toBe(1);
});

test('阅读完成和取消完成写入本地备份，刷新后仍正确', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
  const toolbar = page.getByRole('toolbar', { name: '阅读工具栏' });
  await toolbar.getByRole('button', { name: '完成阅读', exact: true }).click();
  await expect(toolbar.getByRole('button', { name: '已完成', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readBundleMetadata(page))?.completedAt).toBeGreaterThan(0);
  await toolbar.getByRole('button', { name: '已完成', exact: true }).click();
  await expect(toolbar.getByRole('button', { name: '完成阅读', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await readBundleMetadata(page))?.completedAt).toBeNull();
  await page.reload();
  await page.getByRole('button', { name: '主菜单' }).click();
  await page.getByRole('menuitem', { name: '阅读库', exact: true }).click();
  await page.getByRole('button', { name: /^打开文章：/ }).first().click();
  await expect(page.getByRole('toolbar', { name: '阅读工具栏' }).getByRole('button', { name: '完成阅读', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('模型连接测试每次请求新填入的密钥，不读取历史成功缓存', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('yang-reader-api-key-v1', 'previous-test-key'));
  const requests = [];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    requests.push({ url: route.request().url(), headers: route.request().headers() });
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'OK' }] } }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '主菜单' }).click();
  await page.getByRole('menuitem', { name: '模型配置' }).click();
  await page.getByLabel('大模型 API Key', { exact: true }).fill('new-test-key');
  const testButton = page.getByRole('button', { name: '测试连接', exact: true });
  await testButton.click();
  await expect(testButton).toBeEnabled();
  await expect.poll(() => requests.length).toBe(1);
  await testButton.click();
  await expect.poll(() => requests.length).toBe(2);
  for (const request of requests) {
    expect(request.url).not.toContain('test-key');
    expect(request.headers['x-goog-api-key']).toBe('new-test-key');
  }
});

test('手机批注弹层圈定焦点并支持 Escape 返回原入口', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('yang-reader-state-v1'));
    const record = state.history[0];
    const text = document.querySelector('[data-reader-text="true"]').textContent;
    const exact = text.slice(0, 10);
    state.readingNotes = { version: 1, articles: { [record.id]: {
      documentNote: '',
      annotations: [{ id: 'test-note', note: '测试批注', color: 'gold', anchor: {
        paragraphIndex: 0, startOffset: 0, endOffset: exact.length, exact
      } }]
    } } };
    localStorage.setItem('yang-reader-state-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole('button', { name: '主菜单' }).click();
  await page.getByRole('menuitem', { name: '阅读库', exact: true }).click();
  await page.getByRole('button', { name: /^打开文章：/ }).first().click();
  const trigger = page.getByRole('button', { name: '打开第 1 段的 1 条选区笔记' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '本段批注' });
  const close = dialog.getByRole('button', { name: '关闭批注', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
