# 普通 Miki 公共池清理：主线基线对照

同一 GitHub runner、同一 Node/依赖安装环境下，分别检出 `main` 与 `chore/remove-miki-public-pool` 并执行相同命令。

| 检查 | main | 清理分支 | 退出码一致 |
|---|---:|---:|---|
| a11y lint | 1 | 1 | True |
| production build | 0 | 0 | True |
| Playwright E2E | 1 | 1 | True |

## a11y lint

### main 输出尾部

```text

> yang-reader@1.0.0 lint:a11y
> eslint src


/home/runner/work/-/-/baseline/src/components/Paragraph.jsx
  800:21  error  Visible, non-interactive elements with click handlers must have at least one keyboard listener  jsx-a11y/click-events-have-key-events

✖ 1 problem (1 error, 0 warnings)

```

### 清理分支输出尾部

```text

> yang-reader@1.0.0 lint:a11y
> eslint src


/home/runner/work/-/-/cleanup/src/components/Paragraph.jsx
  800:21  error  Visible, non-interactive elements with click handlers must have at least one keyboard listener  jsx-a11y/click-events-have-key-events

✖ 1 problem (1 error, 0 warnings)

```

## production build

### main 输出尾部

```text

> yang-reader@1.0.0 prebuild
> node scripts/generate-pwa-icons.mjs

Generated PWA icon: apple-touch-icon.png
Generated PWA icon: icon-192.png
Generated PWA icon: icon-512.png
Generated PWA icon: icon-maskable-512.png

> yang-reader@1.0.0 build
> vite build && node scripts/build-cloudbase-v2.cjs

[36mvite v7.3.6 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 60 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                          [39m[1m[2m    1.51 kB[22m[1m[22m[2m │ gzip:   0.68 kB[22m
[2mdist/[22m[2massets/[22m[32mpdf.worker.min-iDqQPrd3.mjs  [39m[1m[2m1,232.30 kB[22m[1m[22m
[2mdist/[22m[2massets/[22m[35mindex-DcQZyFlH.css           [39m[1m[2m   77.20 kB[22m[1m[22m[2m │ gzip:  13.80 kB[22m
[2mdist/[22m[2massets/[22m[36mreact-CRH2syub.js            [39m[1m[2m  141.84 kB[22m[1m[22m[2m │ gzip:  45.59 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-CqD9Tw16.js            [39m[1m[2m  235.16 kB[22m[1m[22m[2m │ gzip:  66.32 kB[22m
[2mdist/[22m[2massets/[22m[36mfirebase-BO15h7gj.js         [39m[1m[2m  325.31 kB[22m[1m[22m[2m │ gzip: 100.76 kB[22m
[2mdist/[22m[2massets/[22m[36mpdfjs-Dg1bvM2A.js            [39m[1m[2m  415.91 kB[22m[1m[22m[2m │ gzip: 123.34 kB[22m
[32m✓ built in 2.93s[39m
Build script: /home/runner/work/-/-/baseline/scripts/build-cloudbase-v2.cjs
Project root: /home/runner/work/-/-/baseline
Copying public-resources
Copying app
Vocabulary JSON files: 3
Static resources added to the Vite production build.
```

### 清理分支输出尾部

```text

> yang-reader@1.0.0 prebuild
> node scripts/generate-pwa-icons.mjs

Generated PWA icon: apple-touch-icon.png
Generated PWA icon: icon-192.png
Generated PWA icon: icon-512.png
Generated PWA icon: icon-maskable-512.png

> yang-reader@1.0.0 build
> vite build && node scripts/build-cloudbase-v2.cjs

[36mvite v7.3.6 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 60 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                          [39m[1m[2m    1.51 kB[22m[1m[22m[2m │ gzip:   0.68 kB[22m
[2mdist/[22m[2massets/[22m[32mpdf.worker.min-iDqQPrd3.mjs  [39m[1m[2m1,232.30 kB[22m[1m[22m
[2mdist/[22m[2massets/[22m[35mindex-DcQZyFlH.css           [39m[1m[2m   77.20 kB[22m[1m[22m[2m │ gzip:  13.80 kB[22m
[2mdist/[22m[2massets/[22m[36mreact-CRH2syub.js            [39m[1m[2m  141.84 kB[22m[1m[22m[2m │ gzip:  45.59 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-CqD9Tw16.js            [39m[1m[2m  235.16 kB[22m[1m[22m[2m │ gzip:  66.32 kB[22m
[2mdist/[22m[2massets/[22m[36mfirebase-BO15h7gj.js         [39m[1m[2m  325.31 kB[22m[1m[22m[2m │ gzip: 100.76 kB[22m
[2mdist/[22m[2massets/[22m[36mpdfjs-Dg1bvM2A.js            [39m[1m[2m  415.91 kB[22m[1m[22m[2m │ gzip: 123.34 kB[22m
[32m✓ built in 3.23s[39m
Build script: /home/runner/work/-/-/cleanup/scripts/build-cloudbase-v2.cjs
Project root: /home/runner/work/-/-/cleanup
Copying public-resources
Copying app
Vocabulary JSON files: 3
Static resources added to the Vite production build.
```

## Playwright E2E

### main 输出尾部

```text

> yang-reader@1.0.0 test:e2e
> playwright test


Running 12 tests using 1 worker

  ✘   1 tests/e2e/accessibility.spec.js:17:1 › 首页和精读页没有严重或致命 WCAG 自动扫描问题 (623ms)
  ✓   2 tests/e2e/accessibility.spec.js:24:1 › 跳转入口、正文漫游焦点和标签页方向键可用 (818ms)
  ✓   3 tests/e2e/accessibility.spec.js:42:1 › 320 CSS 像素宽度下主要页面不产生横向溢出 (643ms)
  ✘   4 tests/e2e/accessibility.spec.js:50:1 › 系统通知把外部消息作为纯文本处理并通过 live region 播报 (426ms)
  ✓   5 tests/e2e/reader-baseline.spec.js:7:1 › 首页可加载示例并进入精读 (794ms)
  ✓   6 tests/e2e/reader-baseline.spec.js:20:1 › 沉浸模式只保留眼睛并支持 Escape 退出 (753ms)
  ✓   7 tests/e2e/reader-baseline.spec.js:37:1 › 布局切换保持标准、分栏与专注的既有行为 (799ms)
  ✓   8 tests/e2e/reader-baseline.spec.js:52:1 › 已掌握词立即取消划线并可撤销 (1.8s)
  ✓   9 tests/e2e/reader-baseline.spec.js:69:1 › 主菜单支持方向键、Escape 和焦点返回 (759ms)
  ✓  10 tests/e2e/reader-baseline.spec.js:88:1 › 弹层圈定焦点并在 Escape 后返回打开入口 (791ms)
  ✓  11 tests/e2e/reader-baseline.spec.js:109:1 › 全文工具和段落菜单支持方向键导航 (922ms)
  ✓  12 tests/e2e/reader-baseline.spec.js:135:1 › 划线词可用键盘打开释义卡 (824ms)


  1) tests/e2e/accessibility.spec.js:17:1 › 首页和精读页没有严重或致命 WCAG 自动扫描问题 ──────────────────────────────

    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation

       5 |   const results = await new AxeBuilder({ page })
       6 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    >  7 |     .analyze();
         |      ^
       8 |   const blocking = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
       9 |   expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      10 | };
        at AxeBuilder.analyze (/home/runner/work/-/-/baseline/node_modules/@axe-core/playwright/dist/index.mjs:201:16)
        at expectNoSeriousViolations (/home/runner/work/-/-/baseline/tests/e2e/accessibility.spec.js:7:6)
        at /home/runner/work/-/-/baseline/tests/e2e/accessibility.spec.js:18:9

    Error Context: test-results/accessibility-首页和精读页没有严重或致命-WCAG-自动扫描问题/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/accessibility-首页和精读页没有严重或致命-WCAG-自动扫描问题/trace.zip
    Usage:

        npx playwright show-trace test-results/accessibility-首页和精读页没有严重或致命-WCAG-自动扫描问题/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2) tests/e2e/accessibility.spec.js:50:1 › 系统通知把外部消息作为纯文本处理并通过 live region 播报 ─────────────────────

    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation

      49 |
      50 | test('系统通知把外部消息作为纯文本处理并通过 live region 播报', async ({ page }) => {
    > 51 |   await page.evaluate(() => window.showToast('<img src=x onerror="window.__toastInjected=true"> 请求失败', 'error'));
         |              ^
      52 |   await expect(page.locator('[data-toast-type="error"]')).toContainText('<img src=x');
      53 |   await expect(page.locator('.reader-toast-stack img')).toHaveCount(0);
      54 |   await expect(page.locator('[data-reader-live="assertive"]')).toContainText('请求失败');
        at /home/runner/work/-/-/baseline/tests/e2e/accessibility.spec.js:51:14

    Error Context: test-results/accessibility-系统通知把外部消息作为纯文本处理并通过-live-region-播报/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/accessibility-系统通知把外部消息作为纯文本处理并通过-live-region-播报/trace.zip
    Usage:

        npx playwright show-trace test-results/accessibility-系统通知把外部消息作为纯文本处理并通过-live-region-播报/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2 failed
    tests/e2e/accessibility.spec.js:17:1 › 首页和精读页没有严重或致命 WCAG 自动扫描问题 ───────────────────────────────
    tests/e2e/accessibility.spec.js:50:1 › 系统通知把外部消息作为纯文本处理并通过 live region 播报 ──────────────────────
  10 passed (12.7s)
```

### 清理分支输出尾部

```text

> yang-reader@1.0.0 test:e2e
> playwright test


Running 12 tests using 1 worker

  ✘   1 tests/e2e/accessibility.spec.js:17:1 › 首页和精读页没有严重或致命 WCAG 自动扫描问题 (631ms)
  ✓   2 tests/e2e/accessibility.spec.js:24:1 › 跳转入口、正文漫游焦点和标签页方向键可用 (802ms)
  ✓   3 tests/e2e/accessibility.spec.js:42:1 › 320 CSS 像素宽度下主要页面不产生横向溢出 (659ms)
  ✘   4 tests/e2e/accessibility.spec.js:50:1 › 系统通知把外部消息作为纯文本处理并通过 live region 播报 (490ms)
  ✓   5 tests/e2e/reader-baseline.spec.js:7:1 › 首页可加载示例并进入精读 (810ms)
  ✓   6 tests/e2e/reader-baseline.spec.js:20:1 › 沉浸模式只保留眼睛并支持 Escape 退出 (727ms)
  ✓   7 tests/e2e/reader-baseline.spec.js:37:1 › 布局切换保持标准、分栏与专注的既有行为 (777ms)
  ✓   8 tests/e2e/reader-baseline.spec.js:52:1 › 已掌握词立即取消划线并可撤销 (1.7s)
  ✓   9 tests/e2e/reader-baseline.spec.js:69:1 › 主菜单支持方向键、Escape 和焦点返回 (583ms)
  ✓  10 tests/e2e/reader-baseline.spec.js:88:1 › 弹层圈定焦点并在 Escape 后返回打开入口 (626ms)
  ✓  11 tests/e2e/reader-baseline.spec.js:109:1 › 全文工具和段落菜单支持方向键导航 (780ms)
  ✓  12 tests/e2e/reader-baseline.spec.js:135:1 › 划线词可用键盘打开释义卡 (682ms)


  1) tests/e2e/accessibility.spec.js:17:1 › 首页和精读页没有严重或致命 WCAG 自动扫描问题 ──────────────────────────────

    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation

       5 |   const results = await new AxeBuilder({ page })
       6 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    >  7 |     .analyze();
         |      ^
       8 |   const blocking = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
       9 |   expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      10 | };
        at AxeBuilder.analyze (/home/runner/work/-/-/cleanup/node_modules/@axe-core/playwright/dist/index.mjs:201:16)
        at expectNoSeriousViolations (/home/runner/work/-/-/cleanup/tests/e2e/accessibility.spec.js:7:6)
        at /home/runner/work/-/-/cleanup/tests/e2e/accessibility.spec.js:18:9

    Error Context: test-results/accessibility-首页和精读页没有严重或致命-WCAG-自动扫描问题/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/accessibility-首页和精读页没有严重或致命-WCAG-自动扫描问题/trace.zip
    Usage:

        npx playwright show-trace test-results/accessibility-首页和精读页没有严重或致命-WCAG-自动扫描问题/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2) tests/e2e/accessibility.spec.js:50:1 › 系统通知把外部消息作为纯文本处理并通过 live region 播报 ─────────────────────

    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation

      49 |
      50 | test('系统通知把外部消息作为纯文本处理并通过 live region 播报', async ({ page }) => {
    > 51 |   await page.evaluate(() => window.showToast('<img src=x onerror="window.__toastInjected=true"> 请求失败', 'error'));
         |              ^
      52 |   await expect(page.locator('[data-toast-type="error"]')).toContainText('<img src=x');
      53 |   await expect(page.locator('.reader-toast-stack img')).toHaveCount(0);
      54 |   await expect(page.locator('[data-reader-live="assertive"]')).toContainText('请求失败');
        at /home/runner/work/-/-/cleanup/tests/e2e/accessibility.spec.js:51:14

    Error Context: test-results/accessibility-系统通知把外部消息作为纯文本处理并通过-live-region-播报/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/accessibility-系统通知把外部消息作为纯文本处理并通过-live-region-播报/trace.zip
    Usage:

        npx playwright show-trace test-results/accessibility-系统通知把外部消息作为纯文本处理并通过-live-region-播报/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2 failed
    tests/e2e/accessibility.spec.js:17:1 › 首页和精读页没有严重或致命 WCAG 自动扫描问题 ───────────────────────────────
    tests/e2e/accessibility.spec.js:50:1 › 系统通知把外部消息作为纯文本处理并通过 live region 播报 ──────────────────────
  10 passed (11.9s)
```
