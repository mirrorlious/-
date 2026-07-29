# 任务：合并完成阶段 0 行为基线与阶段 1 生产构建迁移

- 时间：2026-07-29 19:49
- 执行者：Codex
- 状态：已完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：否

## 1. 用户原始要求

将前两步合并，由 Codex 完成阶段 0 和阶段 1：先建立当前行为基线，再迁移到本地生产构建、生产 React 和锁定依赖。

## 2. 完成目标

- 为首页、进入精读、布局切换和沉浸模式建立可重复执行的浏览器基线。
- 移除生产页面中的 React development UMD、浏览器端 Babel、Tailwind Play CDN、Firebase CDN 和 PDF.js CDN。
- 使用本地锁定依赖完成 JSX、React、Tailwind、Firebase、PDF.js 和静态资源生产构建。
- 将占位 `npm test` 替换为真实的单元契约、构建和端到端回归流水线。
- 保留既有沉浸模式、数据 schema、缓存键、BYOK 和静态部署边界。

## 3. 实际修改

- 将约 399 KB 的旧 `index.html` 机械迁移为：
  - 最小 Vite HTML 入口；
  - `src/main.jsx` 本地模块入口；
  - `src/App.jsx` 现有业务逻辑；
  - `src/styles/app.css` Tailwind 指令与原应用样式。
- 增加 Vite、React 插件、Tailwind、PostCSS 和 Vitest 配置。
- React、React DOM、Firebase、PDF.js、Vite、Tailwind、Playwright 等依赖均使用精确版本，并生成 `package-lock.json`。
- 生产构建按 React、Firebase、PDF.js 和应用代码分块；PDF worker 作为独立构建资源输出。
- 调整 `scripts/build-cloudbase-v2.cjs`：Vite 构建后再复制 `public-resources/`、可选 `app/` 和根目录图片，不再覆盖 Vite 产物。
- 增加 3 条构建契约测试和 3 条 Edge 端到端行为回归。
- 更新 README 的开发、测试、技术形态和部署说明。
- 忽略 Playwright、覆盖率等生成目录。

## 4. 阶段 0 基线

迁移前使用静态服务对旧版执行以下 Edge 回归，3 条均通过：

1. 首页加载示例并进入精读。
2. 沉浸模式工具栏只保留一个眼睛按钮，侧栏和段落菜单隐藏，Escape 恢复普通工具栏。
3. 标准、分栏、专注三种布局按既有规则切换。

Codex 应用内浏览器因本地 URL 导航策略未能建立连接，已改用项目内 Playwright + 系统 Edge 完成同等本地验证，并保留自动化用例。

## 5. 依赖与安全处理

- 最终关键开发依赖：Vite `7.3.6`、`@vitejs/plugin-react` `5.2.0`、Tailwind `3.4.17`、PostCSS `8.5.24`、Vitest `3.2.6`、Playwright `1.62.0`。
- 最终运行依赖：React/React DOM `18.3.1`、Firebase `11.6.1`、PDF.js `5.7.284`。
- Playwright 从 `1.49.1` 升级到 `1.62.0`，解决其在本机 Node `24.14.0` 下加载测试配置前卡住的问题。
- 根据 `npm audit` 升级 Vite、PostCSS、Vitest；最终审计为 0 项漏洞。
- 扫描源码入口与 `dist/`，未发现原框架 CDN、浏览器端 Babel、开发版 React 或常见硬编码 API Key 模式。
- 没有执行 `npm audit fix --force`，避免未经验证的破坏性升级。

## 6. 测试结果

最终 `npm test` 完整通过：

- Vitest：1 个文件、3 条测试通过。
- Vite 生产构建：成功，静态词库 JSON 校验为 3 份。
- Playwright + Microsoft Edge：3 条端到端测试通过。
- `npm audit --audit-level=low`：0 项漏洞。
- `git diff --check`：通过；仅提示 Windows 后续可能转换 LF/CRLF，无空白错误。
- 生产产物扫描：未发现运行时 Babel、开发版 React、Tailwind/Firebase/PDF.js CDN 或常见 API Key 字面量。

## 7. 数据与配置迁移

无用户数据迁移。未修改 IndexedDB 版本、object store、localStorage/sessionStorage key、Markdown 数据块 schema、模型路由或 API Key 存储规则。

## 8. 已知边界与后续风险

- 原 399 KB 单文件风险已从 HTML 中移除，但约 383 KB 的业务逻辑仍集中于 `src/App.jsx`；后续应按存储、导入导出、阅读器、弹层和 AI 服务渐进拆分。
- 本阶段只为关键阅读流程建立 3 条浏览器基线，尚未覆盖所有弹层、导入导出、PDF/OCR、Firebase 和失败路径。
- 多个弹层、菜单和点击卡片的焦点陷阱、焦点返回、方向键、Enter/Space 语义仍属于后续无障碍治理范围。
- PDF worker 未压缩体积约 1.23 MB，属于第三方运行资源；已独立输出并可长期缓存。
- 生产构建依然可能访问产品本身配置的语料、模型和可选 Firebase 服务；本次“移除 CDN”仅指框架和运行依赖本地化。

## 9. 回滚方式

恢复迁移前的 `index.html`、`package.json` 与 `scripts/build-cloudbase-v2.cjs`，移除本任务新增的 `src/`、Vite/Tailwind/PostCSS/Vitest/Playwright 配置和测试文件，再恢复原静态复制构建。用户数据格式未变化，无需数据回滚。

## 10. 最终结论

阶段 0 与阶段 1 已完成：迁移前行为已冻结为自动化基线，生产页面不再依赖开发版 React、浏览器端 Babel 或未锁定 CDN；构建、测试、依赖审计和静态资源校验均已通过。未提交、未推送、未部署。
