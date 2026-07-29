import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('首页可加载示例并进入精读', async ({ page }) => {
  await expect(page).toHaveTitle(/杨的外刊阅读器/);
  await expect(page.getByRole('heading', { name: '开始一篇阅读' })).toBeVisible();

  await page.getByRole('button', { name: '加载示例' }).click();
  await expect(page.getByText('63 词', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '进入精读' }).click();

  await expect(page.getByRole('toolbar', { name: '阅读工具栏' })).toBeVisible();
  await expect(page.getByRole('button', { name: '沉浸模式' })).toBeVisible();
  await expect(page.locator('[data-reader-paragraph="true"]')).not.toHaveCount(0);
});

test('沉浸模式只保留眼睛并支持 Escape 退出', async ({ page }) => {
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();
  await page.getByRole('button', { name: '沉浸模式' }).click();

  const immersiveToolbar = page.getByRole('toolbar', { name: '沉浸模式' });
  await expect(immersiveToolbar).toBeVisible();
  await expect(immersiveToolbar.getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '退出沉浸模式' })).toBeVisible();
  await expect(page.locator('.reader-side-panel')).toBeHidden();
  await expect(page.locator('[data-reader-paragraph-trigger="true"]')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('toolbar', { name: '阅读工具栏' })).toBeVisible();
  await expect(page.getByRole('button', { name: '沉浸模式' })).toBeVisible();
});

test('布局切换保持标准、分栏与专注的既有行为', async ({ page }) => {
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();

  await page.getByRole('button', { name: '正文与侧栏分栏' }).click();
  await expect(page.locator('.reader-side-panel')).toBeVisible();

  await page.getByRole('button', { name: '专注布局' }).click();
  await expect(page.locator('.reader-side-panel')).toHaveCount(0);
  await expect(page.locator('.reader-workspace-focus')).toBeVisible();

  await page.getByRole('button', { name: '标准布局' }).click();
  await expect(page.locator('.reader-workspace-focus')).toHaveCount(0);
});

test('已掌握词立即取消划线并可撤销', async ({ page }) => {
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();

  const highlightedWord = page.locator('.reader-article-body span.underline', { hasText: /^absolute$/ });
  await expect(highlightedWord).toHaveCount(1);
  await highlightedWord.click();
  await page.getByRole('button', { name: '这个词太简单，不再划线' }).click();

  await expect(page.getByRole('status')).toContainText('已不再标记 absolute');
  await expect(page.locator('.reader-article-body span.underline', { hasText: /^absolute$/ })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('yang-reader-state-v1') || '{}').vocabularyPreferences?.ignoredLemmas || [])).toContain('absolute');

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.locator('.reader-article-body span.underline', { hasText: /^absolute$/ })).toHaveCount(1);
});

test('主菜单支持方向键、Escape 和焦点返回', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '主菜单' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const menu = page.getByRole('menu', { name: '主菜单' });
  const libraryItem = menu.getByRole('menuitem', { name: '阅读库' });
  await expect(libraryItem).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: '导入 Markdown 备份' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: '模型配置' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('弹层圈定焦点并在 Escape 后返回打开入口', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '主菜单' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: '阅读排版' }).press('Enter');

  const dialog = page.getByRole('dialog', { name: '阅读排版设置' });
  const firstControl = dialog.getByLabel('阅读预设');
  const lastControl = dialog.getByRole('button', { name: '保存并应用排版' });
  await expect(firstControl).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(lastControl).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstControl).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('全文工具和段落菜单支持方向键导航', async ({ page }) => {
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();

  const fullTextTrigger = page.getByRole('button', { name: '全文工具' });
  await fullTextTrigger.focus();
  await page.keyboard.press('Enter');
  const fullTextMenu = page.getByRole('menu', { name: '全文工具' });
  await expect(fullTextMenu.getByRole('menuitem', { name: /全文翻译/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(fullTextMenu.getByRole('menuitem', { name: /全文逻辑/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(fullTextTrigger).toBeFocused();

  const paragraphTrigger = page.locator('[data-reader-paragraph-trigger="true"]').first();
  await paragraphTrigger.focus();
  await page.keyboard.press('Enter');
  const paragraphMenu = page.locator('[data-reader-paragraph-menu="true"]').first();
  const enabledParagraphItems = paragraphMenu.locator('[role="menuitem"]:not([disabled])');
  await expect(enabledParagraphItems.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(enabledParagraphItems.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(paragraphTrigger).toBeFocused();
});

test('划线词可用键盘打开释义卡', async ({ page }) => {
  await page.getByRole('button', { name: '加载示例' }).click();
  await page.getByRole('button', { name: '进入精读' }).click();

  const word = page.getByRole('button', { name: '查看单词 absolute 的释义' });
  await word.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '关闭词汇释义' })).toBeVisible();
});
