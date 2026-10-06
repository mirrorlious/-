import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('yang-reader-api-key-v1', 'side-translation-test-key');
    if (!localStorage.getItem('yang-reader-state-v1')) {
      localStorage.setItem('yang-reader-state-v1', JSON.stringify({ history: [{
        id: 'other-article', title: '另一篇文章', createdAt: 1,
        text: 'A different article discusses the importance of careful reading and reliable local storage. Its translation must remain separate from every other document.'
      }, {
        id: 'alignment-article', title: '逐段对齐示例', createdAt: 2,
        text: 'Technology changes how we read. A useful reader should keep the original article easy to follow while offering help only when the reader needs it.\n\nKeeping translations beside the original helps readers compare meaning without losing their place. Each translation should stay next to the paragraph it belongs to, even when the two languages take up different amounts of space.\n\nLocal storage allows readers to keep their learning progress on this device. Saved translations can be restored after refreshing the page without sending the same request again.'
      }] }));
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
});

const rows = page => page.locator('[data-reader-bilingual-row="true"]');
const toggleSideTranslation = page => page.getByRole('button', { name: '侧面翻译（中英对照阅读）', exact: true }).click();
const readSavedParagraphs = page => page.evaluate(async () => {
  const record = JSON.parse(localStorage.getItem('yang-reader-state-v1')).history[0];
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('yang-reader-local-v1', 3);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise(resolve => {
      const request = db.transaction('article-bundles').objectStore('article-bundles').get(record.bundleKey || `article:${record.id}`);
      request.onsuccess = () => resolve(request.result?.results?.paragraphResults || {});
    });
  } finally { db.close(); }
});

test('桌面侧面译文与原文左右并排，页面滚动后仍逐段对齐', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '主菜单' }).click();
  await page.getByRole('menuitem', { name: '阅读库', exact: true }).click();
  await page.getByRole('button', { name: '打开文章：逐段对齐示例', exact: true }).click();
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    const prompt = route.request().postDataJSON().contents[0].parts[0].text;
    const translation = prompt.includes('Technology changes')
      ? '技术正在改变我们的阅读方式。好的阅读器应让原文清晰易读，并在读者需要时提供帮助。'
      : prompt.includes('Keeping translations')
        ? '把译文放在原文旁边，读者就能对照理解，而不会丢失阅读位置。每段译文都应紧邻对应原文；即使两种语言的篇幅不同，下一段的起点也保持一致。'
        : '本地存储让读者在当前设备保留学习进度。页面刷新后，已保存的译文可以直接恢复，无需再次发送相同请求。';
    return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: translation }] } }] } });
  });
  await toggleSideTranslation(page);
  await expect(page.getByRole('button', { name: '纯净阅读', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '生成全文对照译文' }).click();
  await expect(page.getByRole('button', { name: '译文已齐全', exact: true })).toBeDisabled();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).first().locator('.yang-bilingual-translation-text')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 250));
  for (const row of await rows(page).all()) {
    const source = await row.locator('.yang-bilingual-source').boundingBox();
    const translation = await row.locator('.yang-bilingual-translation').boundingBox();
    expect(translation.x).toBeGreaterThanOrEqual(source.x + source.width - 1);
    expect(Math.abs(source.y - translation.y)).toBeLessThan(1);
    expect(Math.abs(source.height - translation.height)).toBeLessThan(1);
  }
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
  await page.screenshot({ path: 'test-results/side-translation-desktop.png', fullPage: true });
});

test('段落译文刷新后恢复，明确重新翻译才再次请求模型', async ({ page }) => {
  let requests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    requests += 1;
    return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: `测试译文 ${requests}` }] } }] } });
  });
  await toggleSideTranslation(page);
  await rows(page).first().getByRole('button', { name: '翻译本段', exact: true }).click();
  await expect(rows(page).first().locator('.yang-bilingual-translation-text')).toHaveText('测试译文 1');
  await expect.poll(async () => (await readSavedParagraphs(page))['0']?.translation).toBe('测试译文 1');
  await page.reload();
  await page.getByRole('button', { name: '主菜单' }).click();
  await page.getByRole('menuitem', { name: '阅读库', exact: true }).click();
  await page.getByRole('button', { name: /^打开文章：/ }).first().click();
  await expect(rows(page).first().locator('.yang-bilingual-translation-text')).toHaveText('测试译文 1');
  expect(requests).toBe(1);
  await page.getByRole('button', { name: '重新翻译第 1 段', exact: true }).click();
  await expect(rows(page).first().locator('.yang-bilingual-translation-text')).toHaveText('测试译文 2');
  expect(requests).toBe(2);
});

test('翻译错误显示在对应段落并支持重试，不产生未处理异常', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let requests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    requests += 1;
    return requests === 1
      ? route.fulfill({ status: 400, json: { error: { message: 'private provider details' } } })
      : route.fulfill({ json: { candidates: [{ content: { parts: [{ text: '重试成功的译文' }] } }] } });
  });
  await toggleSideTranslation(page);
  await rows(page).first().getByRole('button', { name: '翻译本段', exact: true }).click();
  await expect(rows(page).first().getByRole('alert')).toContainText('HTTP 400');
  await expect(rows(page).first()).not.toContainText('private provider details');
  await rows(page).first().getByRole('button', { name: '重新尝试' }).click();
  await expect(rows(page).first().locator('.yang-bilingual-translation-text')).toHaveText('重试成功的译文');
  await expect(rows(page).first().getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('切换文章终止旧文章后续批量请求，迟到译文不会写入新文章', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    requests += 1;
    await gate;
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: '上一篇文章的迟到译文' }] } }] } });
  });
  await toggleSideTranslation(page);
  await page.getByRole('button', { name: '生成全文对照译文' }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole('button', { name: '主菜单' }).click();
  await page.getByRole('menuitem', { name: '阅读库', exact: true }).click();
  await page.getByRole('button', { name: '打开文章：另一篇文章', exact: true }).click();
  release();
  await expect(page.locator('#yang-bilingual-header-host h2')).toHaveText('另一篇文章');
  await expect(rows(page).first().getByRole('button', { name: '翻译本段', exact: true })).toBeVisible();
  await expect.poll(async () => Boolean((await readSavedParagraphs(page))['0']?.translation)).toBe(false);
  await expect(rows(page)).not.toContainText('上一篇文章的迟到译文');
  expect(requests).toBe(1);
});

test('手机侧面翻译自动改为每段原文后跟译文，不出现横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await toggleSideTranslation(page);
  const source = await rows(page).first().locator('.yang-bilingual-source').boundingBox();
  const translation = await rows(page).first().locator('.yang-bilingual-translation').boundingBox();
  expect(translation.y).toBeGreaterThanOrEqual(source.y + source.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('侧面翻译界面通过 WCAG 严重与致命问题扫描', async ({ page }) => {
  await toggleSideTranslation(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([]);
});

test('中英对照阅读按段落建立左右锁定布局', async ({ page }) => {
  const toggle = page.getByRole('button', { name: '中英对照阅读' });
  await expect(toggle).toBeVisible();
  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#reader-article-content')).toHaveClass(/yang-bilingual-active/);

  const paragraphs = page.locator('[data-reader-bilingual-row="true"]');
  await expect(paragraphs).not.toHaveCount(0);
  await expect(paragraphs.first().getByRole('region', { name: '第 1 段中文翻译' })).toBeVisible();
  await expect(paragraphs.first().getByRole('button', { name: '翻译本段' })).toBeVisible();
  await expect(page.getByRole('button', { name: '生成全文对照译文' })).toBeVisible();
});

test('切回既有阅读模式后恢复原段落结构', async ({ page }) => {
  await page.getByRole('button', { name: '中英对照阅读' }).click();
  await expect(page.locator('[data-reader-bilingual-row="true"]')).not.toHaveCount(0);

  await page.getByRole('button', { name: '纯净阅读' }).click();
  await expect(page.getByRole('button', { name: '中英对照阅读' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-reader-bilingual-row="true"]')).toHaveCount(0);
});
