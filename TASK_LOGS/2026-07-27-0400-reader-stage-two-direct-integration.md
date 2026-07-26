# 任务：直接整合结构树编辑与整本书导入审阅

- 时间：2026-07-27
- 执行者：ChatGPT
- 状态：开发中
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
- 删除本次已确认失效的临时第二阶段工作流

## 4. 明确不做

- 不合并到 `main`
- 不改 Firebase 用户体系
- 不上传用户文档或 API Key
- 不重构无关页面
- 不清理仓库中的其他历史分支和无关文件

## 5. 审计结果

- 真实可维护入口为根目录 `index.html`，单文件 React/Babel 静态应用。
- 当前分支 `feat/reader-annotations-v2` 已有批注、颜色选择、Notes、分栏和排版功能。
- 先前失败发生在 GitHub Actions 的 `Execute embedded stage-two patch`，原因是补丁依赖旧源码的精确字符串锚点；用户上传、SSH、分支和写权限均正常。
- 分支 `feat/reader-polish-book-import` 中已有完整、可审阅的第二阶段实现，且 `index.html` 同时保留批注功能；本次采用整文件候选验证后整合，而非再次执行脆弱锚点替换。
- 长文档结果应存 IndexedDB，不写入 localStorage；现有候选实现使用 `book-imports`、`book-articles` 和 `pdf-tasks`。
- 一次性整合工作流已登记；本提交用于在工作流存在后触发执行。

## 6. 涉及文件

- `index.html`
- `TASK_LOGS/2026-07-27-0400-reader-stage-two-direct-integration.md`
- 临时工作流（成功后删除）
- 删除已失效的 `.github/workflows/apply_reader_stage_two.yml`
- 删除已失效的 `.github/workflows/apply_reader_stage_two_bridge.yml`

## 7. 实施计划

1. 从已审计候选分支读取完整 `index.html`，先验证批注和第二阶段关键标记。
2. 复制候选到当前功能分支，并将 OCR 提示词调整为保留标题、段落边界和过滤前置噪音。
3. 执行脚本标签、关键标记、敏感信息与 `git diff --check` 验证。
4. 提交到 `feat/reader-annotations-v2`，不合并 `main`。
5. 更新本日志，记录自动验证、手工验收项、风险和回滚方式。

## 8. 实际修改

开发中。

## 9. 数据与配置迁移

预计 IndexedDB 版本升级并新增 `book-imports`、`book-articles`；不得删除既有缓存和批注。

## 10. 测试

### 自动测试

待执行。

### 手工验收

待用户在浏览器验收。

## 11. 风险与已知问题

- 自动文章切分属于启发式判断，复杂杂志版式仍可能需要用户修改标题或取消选择。
- 浏览器可能按存储策略清理 IndexedDB，界面需明确“保存在当前浏览器”。

## 12. 未完成项

开发中。

## 13. 回滚方式

回退本次整合提交即可恢复当前 `feat/reader-annotations-v2` 的原始 `index.html`。

## 14. 最终结论

当前状态：开发中。
