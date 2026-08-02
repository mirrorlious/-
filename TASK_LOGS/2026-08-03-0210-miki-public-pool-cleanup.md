# 任务：清理杨的阅读器仓库中的普通 Miki 公共池

- 时间：2026-08-03 02:10（Asia/Shanghai）
- 执行者：ChatGPT
- 状态：已完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：是（用户已明确授权本次创建远程分支、提交与 PR）
- 分支：`chore/remove-miki-public-pool`
- 基线：`main` / `c3a40ffb4833b4696ae0ce689967494a26d64cff`

## 1. 用户原始要求

用户确认覆盖 `AGENTS.md` 当前阶段“不处理仓库清理”的限制，允许本次创建远程分支、提交、PR，并清理普通 Miki 公共池；`public-resources/dyl-exam-public-backup/` 必须等待 CloudBase DYL 真实验收后再删除。

## 2. 任务目标

- 从 `mirrorlious/-` 移除已迁入 `mirrorlious/miki-public-resources`、且“杨的阅读器”不再使用的普通 Miki 公共资源。
- 保留阅读器自身资源、真实运行依赖、构建脚本和测试。
- 保留 `public-resources/dyl-exam-public-backup/`。
- 通过仓库级静态审计、保护断言、自动测试、生产构建和主线基线对照后，以 PR 方式合入。

## 3. 本次范围

- 审计 `public-resources/` 的目录归属和源码引用。
- 审计 `scripts/`、`tools/`、`.github/workflows/` 中只服务于 Miki 公共池的文件。
- 删除明确已迁移且阅读器无依赖的普通 Miki 资源及工具。
- 保存审计摘要、验证结果和基线对照结果。

## 4. 明确不做

- 不删除 `public-resources/dyl-exam-public-backup/`。
- 不删除或迁移 `public-resources/ielts-vocabulary/`。
- 不删除 `public-resources/kaoyan-english-2027-vocabulary/`。
- 不删除 `scripts/build-cloudbase-v2.cjs`、`scripts/generate_kaoyan_english_vocabulary.py` 或 `.github/workflows/generate-kaoyan-english-vocabulary.yml`。
- 不改阅读器 UI、AI/BYOK、OCR、TTS、IndexedDB、Firebase、学习逻辑或部署策略。
- 不改 Miki 运行代码、Firebase、CloudBase、COS 或线上数据。
- 不重写 Git 历史，不强推，不删除旧分支。

## 5. 审计结果

保留的审计证据：

- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit-summary.md`
- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-baseline-comparison.md`
- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-verification.json`

真实结果：

- 仓库审计时有 594 个已跟踪文件。
- `public-resources/dyl-exam-public-backup/` 有 430 个文件，属于明确保护范围。
- `public-resources/ielts-vocabulary/` 由 `src/core/vocabulary.js` 直接读取，必须保留。
- `public-resources/kaoyan-english-2027-vocabulary/` 由 `src/core/vocabulary.js` 直接读取；生产构建还会验证其中至少存在 3 个 JSON，必须保留。
- 红宝书生成脚本与工作流仍服务阅读器词汇功能，必须保留。
- 普通 Miki 删除候选共 55 个资源文件：政治 4、药理学 32、JLPT 10、英语一真题 4、英语二真题 4、总 manifest 1。
- 删除候选在阅读器运行源码中没有引用；候选目录外引用只来自其对应 Miki 生成脚本或工作流。
- 政治、JLPT、药理学生成工具只服务已迁移公共包，可以一并删除。
- `package.json` 的生产构建执行 `vite build && node scripts/build-cloudbase-v2.cjs`；该构建链保持不变。

## 6. 实际修改文件

### 删除普通 Miki 资源

- `public-resources/manifest.json`
- `public-resources/politics-2027/`（4 个文件）
- `public-resources/pharmacology/`（32 个文件）
- `public-resources/jlpt-eggrolls/`（10 个文件）
- `public-resources/kaoyan-english-one-papers/`（4 个文件）
- `public-resources/kaoyan-english-two-papers/`（4 个文件）

### 删除 Miki 专用工具

- `.github/workflows/build-politics-pack.yml`
- `scripts/build-politics-pack.py`
- `tools/build_jlpt_eggrolls_pack.py`
- `tools/build_pharmacology_pack.py`

### 新增任务记录

- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup.md`
- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit-summary.md`
- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-baseline-comparison.md`
- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-verification.json`

### 明确保留

- `public-resources/dyl-exam-public-backup/`
- `public-resources/ielts-vocabulary/`
- `public-resources/kaoyan-english-2027-vocabulary/`
- `scripts/build-cloudbase-v2.cjs`
- `scripts/generate_kaoyan_english_vocabulary.py`
- `.github/workflows/generate-kaoyan-english-vocabulary.yml`
- 阅读器源码、测试、PWA 与部署配置

总计删除 10 个明确路径、59 个已跟踪文件。临时审计、比较和清理 workflow/script 已全部从最终差异中移除。

## 7. 数据与配置迁移

无。

- 未迁移或修改阅读器用户数据、IndexedDB、Firebase 或部署配置。
- 未修改 Miki、CloudBase、COS 或 DYL/ ZH2000 私有资料。
- 当前分支删除不等于 Git 历史清除；旧提交仍然可以访问。

## 8. 测试

### 清理分支验证

- `npm ci --include=dev`：success。
- `npm run test:unit`：success。
- `npm run build`：success。
- 构建脚本确认红宝书 JSON：3 个。
- Playwright Edge 安装：success。
- `git diff --check`：success。
- 保护断言：success；DYL、雅思词库、红宝书词库、红宝书生成链和阅读器构建脚本均存在。
- 删除断言：success；10 个目标路径全部消失，删除文件数严格为 59。

### 主线基线对照

在同一 GitHub runner、同一 Node 和依赖环境中，分别检出 `main` 与清理分支执行相同检查：

| 检查 | main | 清理分支 | 结论 |
|---|---:|---:|---|
| a11y lint | exit 1 | exit 1 | 相同基线失败 |
| production build | exit 0 | exit 0 | 两边均通过 |
| Playwright E2E | exit 1，10/12 | exit 1，10/12 | 相同基线失败 |

相同 lint 失败：

- `src/components/Paragraph.jsx:800`
- `jsx-a11y/click-events-have-key-events`

相同 E2E 失败：

- `accessibility.spec.js:17`：Axe 扫描时页面导航导致 execution context destroyed。
- `accessibility.spec.js:50`：toast 测试时页面导航导致 execution context destroyed。

以上错误在未清理的 `main` 上以相同测试名、相同错误类型和相同通过数量出现，因此不是本次资源删除引入的回归。

### 手工验收

- 本任务未启动开发服务器、未登录账号，也未访问线上 Firebase/CloudBase。
- 通过生产构建确认阅读器受保护词库仍可进入 `dist/public-resources/`。
- DYL CloudBase 主链路仍按既有门禁等待真实站点验收。

## 9. 风险与已知问题

- 主线现有 a11y lint 错误尚未修复，与本次仓库清理无关。
- 主线现有两项 E2E 导航竞态尚未修复，与本次仓库清理无关。
- 老版本 Miki 客户端可能仍请求旧仓库；本轮保留 DYL。普通资源的新仓库与 Miki 旧 URL 兼容层已经合并。
- Git 当前分支删除不等于清除 Git 历史。

## 10. 未完成项

- 创建、审阅并合并本 PR。
- 合并后等待阅读器自动部署，并进行正式页面冒烟测试。
- 真实验证 CloudBase DYL 登录、chunk 和媒体后，另开任务删除 `dyl-exam-public-backup/`。
- 主线 a11y lint 与 E2E 导航竞态应作为独立任务处理，不混入本次清理。

## 11. 回滚方式

- 合并前：关闭本 PR。
- 合并后：revert 本 PR 的合并提交。
- 所有删除内容均可从基线 `c3a40ffb4833b4696ae0ce689967494a26d64cff` 恢复。
- 不使用历史重写或强推作为常规回滚。

## 12. 最终结论

当前状态：已完成。

普通 Miki 公共池已经从清理分支移除；阅读器实际依赖、DYL 备用目录、用户数据和部署链均未修改。生产构建、单元测试和差异检查通过；lint/E2E 的失败已通过同 runner 主线对照确认属于既有基线问题，不是本次清理回归。分支已具备创建和合并 PR 的条件。
