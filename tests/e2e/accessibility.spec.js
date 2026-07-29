import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const expectNoSeriousViolations = async (page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('首页和精读页没有严重或致命 WCAG 自动扫描问题', async ({ page }) => {
  await expectNoSeriousViolations(page);
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
  await expectNoSeriousViolations(page);
});

test('跳转入口、正文漫游焦点和标签页方向键可用', async ({ page }) => {
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();

  const article = page.getByRole('region', { name: '文章正文与词汇标注' });
  await expect(article).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-reader-vocabulary="true"]').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-reader-vocabulary="true"]').nth(1)).not.toBeFocused();

  const firstTab = page.getByRole('tab', { name: '全文结构' });
  await firstTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '模拟习题' })).toBeFocused();
  await expect(page.getByRole('tab', { name: '模拟习题' })).toHaveAttribute('aria-selected', 'true');
});

test('320 CSS 像素宽度下主要页面不产生横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '沉浸模式' })).toBeVisible();
});

test('系统通知把外部消息作为纯文本处理并通过 live region 播报', async ({ page }) => {
  await page.evaluate(() => window.showToast('<img src=x onerror="window.__toastInjected=true"> 请求失败', 'error'));
  await expect(page.locator('[data-toast-type="error"]')).toContainText('<img src=x');
  await expect(page.locator('.reader-toast-stack img')).toHaveCount(0);
  await expect(page.locator('[data-reader-live="assertive"]')).toContainText('请求失败');
  await expect.poll(() => page.evaluate(() => window.__toastInjected)).not.toBe(true);
});
