# 任务：直接整合结构树编辑与整本书导入审阅

- 时间：2026-07-27
- 执行者：ChatGPT
- 状态：部分完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：是，用户已明确要求直接在当前功能分支开始实施
- 工作分支：`feat/reader-annotations-v2`

## 1. 用户原始要求

逐一修正当前阅读器问题，并开始第二阶段：全屏结构树允许自定义编辑；整本书/PDF/OCR 导入后自动过滤目录、封面、页码等噪音，识别并切分文章，提供文章数量、预览、勾选、单篇精读和浏览器本地暂存，避免把整本书一次性送入模型和重复消耗 Token。

## 2. 任务目标

不再运行已失败的精确字符串补丁，直接把已审计的完整实现整合到当前批注分支，并保留第一批界面、批注颜色和本地缓存能力。

## 3. 本次范围

- 整合可编辑全文结构树
- 整合 PDF 文本层优先、低文本页 OCR 的逐页处理
- 整合文章切分、噪音过滤、识别结果预览与选择
- 整合 `book-imports` / `book-articles` IndexedDB 本地持久化
- 保留句子批注、批注颜色、Notes 与现有 BYOK 路由
- 删除已确认失效的临时第二阶段工作流

## 4. 明确不做

- 不合并到 `main`
- 不改 Firebase 用户体系
- 不上传用户文档或 API Key
- 不重构无关页面
- 不清理仓库中的其他历史分支和无关文件

## 5. 审计结果

- 真实可维护入口为根目录 `index.html`，单文件 React/Babel 静态应用。
- 当前分支原先已有批注、颜色选择、Notes、分栏和排版功能。
- 先前失败发生在 GitHub Actions 的 `Execute embedded stage-two patch`，原因是补丁依赖旧源码的精确字符串锚点；用户上传、SSH、分支和写权限均正常。
- `feat/reader-polish-book-import` 中已有完整第二阶段实现，`index.html` 同时保留批注功能，且对应 Vercel 预览部署为 Ready。
- 本次没有再次运行脆弱的字符串补丁，而是使用 Git tree/merge commit 将已审计候选 `index.html` 写入当前分支，同时保留当前分支的日志和其他文件。
- 长文档结果写入 IndexedDB，不将整本正文写入 localStorage。

## 6. 涉及文件

- 修改：`index.html`
- 新增并更新：`TASK_LOGS/2026-07-27-0400-reader-stage-two-direct-integration.md`
- 删除：`.github/workflows/apply_reader_stage_two.yml`
- 删除：`.github/workflows/apply_reader_stage_two_bridge.yml`
- 删除：`.github/workflows/integrate_reader_stage_two_direct.yml`

## 7. 实施计划

1. 审计候选实现中的批注、结构树编辑、文章切分和本地保存标记。
2. 以当前分支为第一父提交、候选实现分支为第二父提交创建合并提交，只替换 `index.html`。
3. 检查当前分支中的关键实现和 IndexedDB 存储。
4. 删除失效和一次性工作流。
5. 等待用户本地进行真实文件手工验收。

## 8. 实际修改

- 当前分支已写入完整第二阶段 `index.html`。
- 全屏全文结构树支持编辑中英文标题、添加子节点、删除节点和保存到当前文章。
- 结构树展开/收起控制移动到右侧，并使用上/下箭头。
- PDF 导入采用文本层优先；低文本页面才渲染后调用 OCR。
- PDF 按页提取结果保存到 `pdf-tasks`，支持从已完成页继续处理。
- 导入后过滤疑似目录、封面、页码和低信息页面，并按标题、页边界和篇幅切分文章。
- 显示文章数量、标题、字数、页码范围和正文预览。
- 支持勾选文章、单篇进入精读、批量保存到当前浏览器。
- `book-imports` 保存整次识别会话；`book-articles` 保存用户选中的文章。
- 保留句子批注、自定义批注颜色、Notes、分栏、排版和 BYOK 任务路由。
- 已删除失败的第二阶段补丁工作流和一次性整合工作流。

## 9. 数据与配置迁移

- IndexedDB 版本为 2。
- 新增 `book-imports` 与 `book-articles`。
- 保留既有 `ai-cache`、`tts-cache`、`pdf-tasks` 和本地批注数据，不执行清空或破坏性迁移。
- localStorage 仅保存轻量状态及最近识别会话 key，不保存整本正文。

## 10. 测试

### 自动测试

- 当前分支 `index.html` blob 已核对为审计候选实现。
- 关键代码检查：`segmentBookPages`、`prepareBookImport`、`bookImportSession`、`mapEditDraft`、`isMapEditing`、`book-imports`、`book-articles` 均存在。
- 批注兼容检查：`reader-annotation-mark`、批注颜色状态和 Notes 仍存在。
- 候选实现对应 Vercel 部署状态：Ready。
- GitHub 合并提交以当前分支为第一父提交，没有覆盖当前分支的任务日志和其他文件。

### 手工验收

待用户在本地浏览器完成：

- 全屏结构树编辑、保存、刷新后恢复
- 文本型 PDF 多篇文章切分
- 扫描型 PDF 低文本页 OCR
- 多张图片导入后的文章预览和勾选
- 目录、封面、页码过滤
- 保存到阅读库后刷新与重新打开
- 批注、颜色和长难句高亮兼容

## 11. 风险与已知问题

- 自动文章切分属于启发式判断，复杂杂志版式仍可能需要用户修改标题或取消选择。
- OCR 模型输出质量会影响标题和段落边界；本地切分规则会兜底，但无法保证所有出版物一次正确。
- 浏览器可能按存储策略清理 IndexedDB，用户不应把它当作永久云端备份。
- 本次尚未在用户真实文件与浏览器环境中完成手工验收。

## 12. 未完成项

- 用户本地手工验收。
- 根据真实整本书样本调整噪音过滤和文章边界阈值。
- 验收通过前不合并到 `main`。

## 13. 回滚方式

回退合并提交 `8feb9a5d2a2c7e23b867efc89459772b51149e2c`，即可恢复整合前的 `feat/reader-annotations-v2` 代码；后续三个工作流删除提交可按需单独回退。

## 14. 最终结论

当前状态：部分完成。第二阶段代码已直接写入 `feat/reader-annotations-v2`，未合并 `main`；自动审计通过，等待用户本地真实文件验收。
