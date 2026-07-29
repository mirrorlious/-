# 任务：阶段 4 系统治理与无障碍交互

- 时间：2026-07-29 21:35
- 执行者：Codex
- 状态：已完成，等待合并验收
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：否

## 1. 用户要求

一次性完成报告 4“系统治理与无障碍交互”完整范围；完成后整合近期有价值改动和 README 到 `main`，包含 `feat/reader-annotations-v2`。

## 2. 完成范围

- 统一 React 通知中心和 polite/assertive 读屏播报。
- 移除旧 Toast 的 `innerHTML` 拼接，外部错误消息只按纯文本渲染。
- 增加跳到主要内容、文章正文和学习结果的快捷入口。
- 为主要异步流程增加 `aria-busy`、status、alert 和 progressbar 语义。
- 高密度词汇区域改为单一 Tab 入口和方向键漫游。
- 词卡支持 Escape 关闭和焦点返回。
- 学习结果改为标准 tablist/tab/tabpanel，并支持方向键切换。
- PDF 加载、渲染和错误状态补充读屏语义。
- 增加 320 CSS 像素回流、强制颜色、减弱动效和统一焦点样式。
- 已掌握词撤销提示在悬停或获得焦点时暂停消失。
- 加入 ESLint JSX 无障碍规则、axe Playwright 扫描和对应回归测试。

## 3. 主要文件

- `src/accessibility/feedback.jsx`
- `src/accessibility/focus.js`
- `src/App.jsx`
- `src/components/Paragraph.jsx`
- `src/components/PdfReader.jsx`
- `src/styles/app.css`
- `tests/unit/accessibility-feedback.test.js`
- `tests/unit/accessibility-focus.test.js`
- `tests/e2e/accessibility.spec.js`
- `tests/e2e/reader-baseline.spec.js`
- `eslint.config.js`
- `package.json`
- `package-lock.json`
- `README.md`

## 4. 工程治理

- 锁定 `@axe-core/playwright`、ESLint 9 和 `eslint-plugin-jsx-a11y`。
- 使用固定 overrides 消除 `minimatch` / `brace-expansion` 已知漏洞，同时避免强制使用插件尚未兼容的 ESLint 10。
- `npm test` 现在按单元测试、无障碍 lint、生产构建、Edge E2E 顺序执行。
- axe 自动检查首页和精读页的 WCAG A/AA 严重及致命问题。

## 5. 数据与兼容

未修改 localStorage、IndexedDB、Markdown schema、词库 JSON、API 路由或用户内容。阶段 0–3、阅读批注和已掌握词功能均保留。

## 6. 验收结论

- 自动验证覆盖统一播报事件、纯文本通知、正文漫游焦点、标签页方向键、窄屏回流、弹层和菜单焦点、沉浸模式及已掌握词撤销。
- axe 扫描中发现并修复 tablist 非法子元素和空状态文字对比度问题。
- 完整命令结果见本任务最终交付说明。

## 7. 人工读屏边界

自动化已验证浏览器无障碍树、可访问名称、状态播报节点和键盘行为。NVDA/Narrator 的实际语音、停顿与用户主观理解仍建议在目标设备执行一次人工会话验收；这不影响本阶段代码和自动治理完成状态。

## 8. 回滚

回退本日志所列阶段 4 文件增量；不要回退此前 Vite 迁移、模块拆分、阶段 3 焦点治理、阅读批注或已掌握词实现。
