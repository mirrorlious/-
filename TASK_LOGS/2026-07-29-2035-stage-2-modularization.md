# 任务：阶段 2 渐进式模块拆分

- 时间：2026-07-29 20:35
- 执行者：Codex
- 状态：已完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：否

## 1. 用户原始要求

完成阶段 2。

## 2. 任务目标

- 按前序优化路线完成阶段 2：降低约 383 KB `src/App.jsx` 的单模块维护和并发修改风险。
- 以领域边界渐进拆分，不进行功能重写，不改变用户数据与外部行为。
- 为拆出的纯逻辑和模块边界增加自动测试。

## 3. 本次范围

- 词汇匹配与语料工具。
- API 配置与 AI 服务调用。
- 本地持久化、PDF 文本处理、Markdown 数据包工具。
- 思维导图、正文高亮、段落和 PDF 阅读视图。
- `src/App.jsx` 重新组合上述模块。
- 与拆分直接相关的单元、构建与浏览器回归。

## 4. 明确不做

- 不重写现有业务流程或视觉系统。
- 不修改 IndexedDB schema、localStorage/sessionStorage key、Markdown schema 或 API 路由。
- 不处理全站弹层和菜单的无障碍治理；该项保留给下一阶段。
- 不实现另一窗口已建立日志的“已掌握词”功能。
- 不提交、不推送、不部署。

## 5. 审计结果

- 当前生产入口为 Vite：`index.html` → `src/main.jsx` → `src/App.jsx`。
- `src/App.jsx` 约 383 KB、5137 行；前约 2500 行由可独立抽取的顶层常量、纯函数、服务和视图组件组成，后约 2600 行为应用状态与页面编排。
- Babel AST 依赖盘点确认可按词汇、API 配置、AI 服务、持久化、PDF 文本、Markdown 数据包、思维导图和阅读内容视图拆分。
- AI 服务与持久化之间原有交叉依赖可通过独立 API 配置模块消除，避免形成模块循环。
- 当前工作区包含阶段 0+1 的未提交迁移。拆分开始前检测到另一窗口已开始写入“已掌握词”，本任务暂停源码修改并通过 Codex 任务协调等待其完成；该功能最终以 4 条单测、4 条浏览器回归和生产构建通过的状态交接。
- 基线测试为 3 条 Vitest 构建契约和 3 条 Playwright + Edge 阅读流程回归。

## 6. 涉及文件

- `src/App.jsx`
- `src/core/api-config.js`
- `src/core/article-bundle.js`
- `src/core/pdf-text.js`
- `src/core/persistence.js`
- `src/core/vocabulary.js`
- `src/services/ai.js`
- `src/components/MindMap.jsx`
- `src/components/Paragraph.jsx`
- `src/components/PdfReader.jsx`
- `src/components/PracticePanels.jsx`
- `src/components/ReaderContent.jsx`
- `tests/unit/module-boundaries.test.js`
- `tests/unit/vocabulary.test.js`
- `tests/unit/production-entry.test.js`
- `README.md`
- 本任务日志

## 7. 实施计划

1. 使用 AST 锚定顶层声明，机械抽取领域模块，避免手工复制长代码。
2. 显式声明模块导入导出，消除 AI 配置与持久化的循环依赖。
3. 保持 App 状态编排、DOM 标记、存储键和用户可见文案不变。
4. 增加模块边界、纯函数和无循环依赖契约测试。
5. 运行完整 `npm test`、依赖审计、敏感信息和差异检查。

## 8. 实际修改

- 将 `src/App.jsx` 从约 383 KB、5275 行降至约 212 KB、2860 行，保留应用级状态与页面编排。
- 抽离 `core` 领域：
  - `vocabulary.js`：词库加载、lemma 匹配、语料检索和已掌握词规范化/便携快照。
  - `api-config.js`：模型常量、服务商配置规范化与 Endpoint 生成。
  - `persistence.js`：默认配置、IndexedDB、内容哈希、缓存键和 API Key 本地安全存取。
  - `pdf-text.js`：PDF 行/段落整理、长文切块和书籍页面分段。
  - `article-bundle.js`：Markdown 数据包序列化、解析和下载。
- 抽离 `services/ai.js`：LLM、全文/段落分析、练习、TTS 和媒体文本提取调用。
- 抽离视图组件：
  - 思维导图；
  - 段落、高亮、词卡与批注；
  - 单题/整套练习和句法展示；
  - PDF 阅读器。
- 使用独立 API 配置模块消除 AI 服务与持久化之间潜在的循环依赖。
- 保留 `ReaderContent.jsx` 为兼容性导出入口，便于后续调用方平滑迁移。
- 将另一窗口刚完成的已掌握词 lemma 逻辑迁入词汇模块，并更新契约测试跨模块读取，功能未丢失。
- README 更新为 core / services / components 分层结构。
- 增加模块体积上限、禁止回流到 App、相对导入无环、lemma 变形和偏好快照测试。

## 9. 数据与配置迁移

无。未修改 IndexedDB version/object store、localStorage/sessionStorage key、Markdown schema、API 路由或用户内容。

## 10. 测试

### 自动测试

- `npm run test:unit`：3 个测试文件、13 条测试全部通过。
- `npm run build`：通过；Vite 转换 56 个模块，静态资源脚本确认 3 份词库 JSON。
- `npm run test:e2e`：4 条 Microsoft Edge 回归全部通过，包括沉浸模式、布局切换和已掌握词撤销。
- `npm test`：完整流水线通过。
- `npm audit --audit-level=low`：0 项漏洞。
- `npm ls --depth=0`：依赖树有效。
- Babel parser：13 个 `src` JavaScript/JSX 模块全部可解析。
- `git diff --check`：通过；仅有 Windows LF/CRLF 提示，无空白错误。
- 构建产物与源码扫描：未发现框架 CDN、浏览器端 Babel、开发版 React或常见 API Key 字面量。

### 手工/浏览器验收

- Playwright 实际在系统 Edge 中完成示例文章加载、进入精读、三种布局、沉浸眼睛/Escape 和已掌握词取消划线/撤销。
- 页面 DOM 标记与用户可见行为由迁移前基线持续验证。

## 11. 风险与已知问题

- `App.jsx` 仍约 212 KB，主要原因是大量应用级状态、弹窗和页面 JSX；继续拆分应优先从设置弹窗和导入导出编排入手，避免为了体积而跨层传递大量状态。
- `Paragraph.jsx` 约 50 KB，是当前最大的独立视图模块，但已低于本阶段 60 KB 组件边界，可单独继续演进。
- 模块仍保留少量 `window` 兼容接口，阶段 2 未改变其行为；后续可在具备更完整服务测试后逐步移除。
- 本阶段没有处理弹层焦点陷阱、菜单方向键和点击卡片键盘语义。

## 12. 未完成项

- 全站弹层、菜单、表单标签和点击卡片的无障碍治理。
- 将 App 内设置/导入导出弹层进一步组件化。
- PDF/OCR、Firebase 和 Markdown 文件选择器的更深端到端失败路径。

## 13. 回滚方式

从临时备份恢复阶段 2 前的 `src/App.jsx`，删除本任务新增的 `src/core/`、`src/services/` 和拆分组件及模块测试，并恢复 README 技术结构说明；阶段 0+1 构建迁移和已掌握词功能不应回滚。

## 14. 最终结论

阶段 2 已完成。核心算法、服务、数据访问和大型阅读视图已从 App 编排层分离，App 体积降低约 45%，模块边界具备自动化体积与无环约束；完整构建和浏览器行为保持通过。

GitHub：未上传，等待用户本地验收。
