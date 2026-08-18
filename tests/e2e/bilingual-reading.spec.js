import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
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
