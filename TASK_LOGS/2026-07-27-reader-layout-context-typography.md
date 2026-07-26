# 任务：阅读页布局、上下文操作与编辑级排版

- 时间：2026-07-27
- 执行者：Codex
- 状态：阶段0审计完成，准备阶段1
- 本地路径：`D:\01_project\杨的阅读器`
- 当前分支：`feat/reader-layout-context-typography`
- GitHub：未上传，等待用户本地验收

## 1. 用户原始要求

按指定阶段改造阅读页布局、上下文操作和字体排版；仅修改本地文件，禁止 push、PR 和 GitHub 上传，不提交或分发字体文件。

## 2. 阶段0审计结果

- 真实可维护源码：根目录单文件 `index.html`，React + Babel CDN；未发现 `src/`、`package.json`、构建配置或生成脚本。
- 生成产物：当前本地工作区未发现 gzip/Base64 应用产物；本次不修改或生成字体、压缩包和字体二进制。
- 阅读页入口：`App` 中 `isReadingMode` 分支，主容器为 `main`，阅读内容由 `paragraphs.map(...)` 渲染 `Paragraph`。
- 顶部工具栏：sticky header；现有入口为纯净阅读/深度精读、词汇高亮、全文逻辑、排版、夜间模式和退出。
- 正文段落：`Paragraph` 组件；正文使用 `font-serif` 和 `text-justify`，段落按钮在 hover 时显示多个较大的下方按钮。
- 当前四类段落操作：翻译、长难句解构、外教领读、出题测试；另有本地朗读按钮，但同样位于段落操作区。
- 选区事件：当前仅在段落点击时检查 `window.getSelection()` 是否为空，没有正文选区工具条、selectionchange 监听或选区级操作。
- 全文结构树：`fullMapData` 和 `LogicTreeNode` 位于正文下方；没有右侧学习面板或标签状态。
- 全屏与布局状态：未发现 `requestFullscreen`、`fullscreenchange`、`layoutMode`、`rightPanelTab`、`splitRatio` 或 `isImmersive`。
- 当前字体：body/UI 使用 Tailwind `font-sans`；正文与部分结果使用 `font-serif`；排版设置只有 `fontFamily`、`fontSize`、`lineHeight`、`paddingX`、`theme`。
- 当前默认排版：`fontFamily: "Noto Serif SC", STSong, "Times New Roman", serif`，字号 17px，行高 1.9，左右内边距 6%。没有英文/中文字体职责分离，也没有 `ch` 行宽。
- 正文宽度：通过 `article` 的 `paddingLeft/paddingRight` 百分比间接控制；外层 `main` 为 `max-w-3xl`，分栏下没有受控正文 measure。
- 设置存储：`LOCAL_STORAGE_KEY = yang-reader-state-v1`；`typographyConfig` 与历史、词典等一起存入 `localStorage`。没有布局设置键，也没有一次性迁移标记。
- 夜间模式：通过 `typographyConfig.theme` 给局部根节点添加 `dark` 类，现有颜色使用 Tailwind dark 类。
- 启动与测试：README 建议 `python -m http.server 5173`；无自动化测试或构建脚本；上一阶段已验证本地 HTTP 200、浏览器 Babel 编译无错误、`git diff --check` 通过。

## 3. 本次拟修改文件

- `index.html`：布局状态、阅读容器、段落入口、选区工具条、排版设置、样式和迁移。
- `TASK_LOGS/2026-07-27-reader-layout-context-typography.md`：阶段记录和验证结果。

明确不修改：字体文件、字体二进制、API/OCR/PDF/Firebase/词库/阅读历史业务、无关目录、远程分支。

## 4. 阶段计划

按任务规范依次执行：阶段1布局状态模型；阶段2桌面左右分栏；阶段3标准/分栏/专注；阶段4全屏与沉浸；阶段5段落轻量入口；阶段6正文选区工具条；阶段7右侧学习面板；阶段8可选拖动分隔线；阶段9编辑级排版；阶段10视觉/可访问性/性能；阶段11回归与验收。

每阶段完成后只做本地验证并更新本日志；不合并 `main`、不 push、不创建 PR。

## 5. 阶段0检查点

- 完成：按要求阅读项目规则、日志规范、任务日志及 v3 bundle 中的对应任务、设计规范和验收清单。
- 完成：审计真实源码、阅读入口、正文节点、段落操作、字体、宽度、排版设置和存储。
- 测试：`git status`、`git branch --show-current`、源码检索审计；工作区在审计前干净。
- 下一步：实现阶段1布局状态模型，并先验证状态持久化和旧排版设置迁移。

## 6. 阶段1：布局状态模型

- 状态：已完成
- 完成：增加 `layoutMode`、`rightPanelTab`、`rightPanelOpen`、`splitRatio`、`isImmersive` 和 `isBrowserFullscreen` 状态。
- 完成：布局偏好统一保存到 `localStorage` 的 `layoutState`，浏览器全屏临时状态不持久化。
- 完成：桌面宽度达到 1200px 时默认分栏，小于 1200px 默认标准布局；用户已有偏好优先。
- 完成：监听 `fullscreenchange`，并为不支持或调用失败的环境提供沉浸模式降级。
- 测试：待阶段提交后运行本地页面加载和 Babel 编译检查。
- 下一步：阶段2接入桌面左右分栏容器和右侧面板。

## 6. 风险与已知问题

- 单文件 React 修改范围大，必须按阶段小步提交。
- 外部字体不可作为唯一依赖；本次不提交字体文件。
- 现有文字和 UI 文案存在历史编码显示问题，本次不扩大到无关文案清理。
- 选区浮层、sticky 工具栏、全屏和响应式布局需要浏览器手工验收。

## 7. 回滚方式

按阶段使用本地提交回滚；不执行远程操作，不改写远程历史。

GitHub：未上传，等待用户本地验收。
