# 任务：清理杨的阅读器仓库中的普通 Miki 公共池

- 时间：2026-08-03 02:10（Asia/Shanghai）
- 执行者：ChatGPT
- 状态：部分完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：是（用户已明确授权本次创建远程分支、提交与 PR）
- 分支：`chore/remove-miki-public-pool`
- 基线：`main` / `c3a40ffb4833b4696ae0ce689967494a26d64cff`

## 1. 用户原始要求

用户确认覆盖 `AGENTS.md` 当前阶段“不处理仓库清理”的限制，允许本次创建远程分支、提交、PR，并清理普通 Miki 公共池；`public-resources/dyl-exam-public-backup/` 必须等待 CloudBase DYL 真实验收后再删除。

## 2. 任务目标

- 从 `mirrorlious/-` 当前主线中移除已经迁入 `mirrorlious/miki-public-resources`、且“杨的阅读器”不再使用的普通 Miki 公共资源。
- 保留阅读器自身资源、实际运行依赖、构建脚本和测试。
- 保留 `public-resources/dyl-exam-public-backup/`。
- 通过静态审计、自动测试、构建和差异检查后，以 PR 方式合入。

## 3. 本次范围

- 审计 `public-resources/` 的目录归属和源码引用。
- 审计 `scripts/`、`tools/`、`.github/workflows/` 中只服务于 Miki 公共池的文件。
- 删除明确已迁移且阅读器无依赖的普通 Miki 资源及工具。
- 更新本日志并创建 PR。

## 4. 明确不做

- 不删除 `public-resources/dyl-exam-public-backup/`。
- 不删除或迁移 `public-resources/ielts-vocabulary/`。
- 不删除 `public-resources/kaoyan-english-2027-vocabulary/`。
- 不删除 `scripts/build-cloudbase-v2.cjs`、`scripts/generate_kaoyan_english_vocabulary.py` 或 `.github/workflows/generate-kaoyan-english-vocabulary.yml`。
- 不改阅读器 UI、AI/BYOK、OCR、TTS、IndexedDB、Firebase、学习逻辑或部署策略。
- 不改 Miki 仓库、Firebase、CloudBase、COS 或线上数据。
- 不重写 Git 历史，不强推，不删除旧分支。

## 5. 审计结果

已生成：

- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit.json`
- `TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit-summary.md`

真实结果：

- 仓库审计时有 594 个已跟踪文件。
- `public-resources/dyl-exam-public-backup/` 有 430 个文件，属于明确保护范围。
- `public-resources/ielts-vocabulary/` 有 2 个文件；`src/core/vocabulary.js` 直接读取其 JSON，必须保留。
- `public-resources/kaoyan-english-2027-vocabulary/` 当前只有 1 个已跟踪目录项/文件记录；`src/core/vocabulary.js` 直接引用该目录，且 `scripts/build-cloudbase-v2.cjs` 在生产构建中强制检查该目录至少存在 3 个 JSON，必须保留。
- `.github/workflows/generate-kaoyan-english-vocabulary.yml` 与 `scripts/generate_kaoyan_english_vocabulary.py` 仍负责阅读器实际使用的红宝书词库，必须保留。
- 普通 Miki 删除候选共 55 个资源文件：政治 4、药理学 32、JLPT 10、英语一真题 4、英语二真题 4、总 manifest 1。
- 删除候选目录在阅读器运行源码中没有引用；审计发现的候选目录外引用均来自其对应生成脚本或工作流。
- `scripts/build-politics-pack.py` 与 `.github/workflows/build-politics-pack.yml` 只服务政治公共包。
- `tools/build_jlpt_eggrolls_pack.py` 只服务 JLPT 公共包；其中对药理学 ID 的引用仅用于旧总 manifest 的插入顺序。
- `tools/build_pharmacology_pack.py` 只服务药理学公共包，且其媒体地址仍指向旧仓库，应随旧公共包删除。
- `package.json` 的生产构建执行 `vite build && node scripts/build-cloudbase-v2.cjs`；该构建脚本本身属于阅读器并必须保留。

## 6. 涉及文件

### 删除资源

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

### 保留

- `public-resources/dyl-exam-public-backup/`
- `public-resources/ielts-vocabulary/`
- `public-resources/kaoyan-english-2027-vocabulary/`
- `scripts/build-cloudbase-v2.cjs`
- `scripts/generate_kaoyan_english_vocabulary.py`
- `.github/workflows/generate-kaoyan-english-vocabulary.yml`
- 阅读器源码、测试、PWA 与部署配置

### 临时审计文件

以下审计基础设施在任务结束前删除，审计报告与主任务日志保留：

- `.github/scripts/audit_miki_public_pool_cleanup.py`
- `.github/scripts/summarize_miki_public_pool_audit.py`
- `.github/workflows/audit-miki-public-pool-cleanup.yml`
- `.github/workflows/summarize-miki-public-pool-audit.yml`

## 7. 实施计划

1. 通过可重复执行的清理脚本删除上方明确候选，不触碰保护路径。
2. 清理脚本执行前后断言保护目录存在，并断言删除候选全部消失。
3. 运行 `npm ci`、unit、a11y lint、production build、E2E（环境允许时）与 `git diff --check`。
4. 补全日志；删除临时审计/清理基础设施；保留审计报告。
5. 创建 PR，不直接修改 `main`；通过验收后再合并。

## 8. 实际修改

- 删除 6 个普通 Miki 资源路径，共 55 个资源文件：总 manifest、政治、药理学、JLPT、英语一真题、英语二真题。
- 删除 4 个 Miki 专用生成/工作流文件：政治 workflow、政治生成脚本、JLPT 生成工具、药理学生成工具。
- 总计删除 10 个明确路径、59 个已跟踪文件。
- 保留 DYL 备用包、雅思词库、红宝书词库、红宝书生成链路和阅读器构建脚本。
- 删除任务结束后不再需要的临时审计与清理 workflow/script；保留主任务日志、审计摘要和验证结果。

## 9. 数据与配置迁移

无。仅清理 Git 仓库当前分支中的重复公开资源副本；阅读器用户数据、IndexedDB、Firebase 和部署配置不迁移。

## 10. 测试

### 自动测试

- npm ci: `success`。
- unit（Vitest）: `success`。
- a11y lint（ESLint）: `failure`。
- production build: `success`。
- Playwright Edge 安装: `success`。
- E2E（Playwright）: `failure`。
- git diff --check: `success`。

### 手工验收

- 本任务未启动开发服务器、未登录账号，也未访问线上 Firebase/CloudBase。
- 通过构建产物与自动测试验证阅读器代码和受保护词库仍可被打包。
- DYL CloudBase 主链路仍需按既有门禁在真实站点单独验收。

## 11. 风险与已知问题

- `scripts/build-cloudbase-v2.cjs` 会复制整个 `public-resources/`，因此必须确保雅思词库、红宝书词库与 DYL 备用目录保留。
- 老版本 Miki 客户端可能仍请求旧仓库；本轮只清理普通资源，DYL 继续保留。普通资源的新仓库与 Miki 地址兼容层已经合并。
- 删除当前分支文件不等于清除 Git 历史；旧提交仍可访问。
- E2E 可能因浏览器运行环境或外部网络条件失败，必须区分环境失败与代码失败。

## 12. 未完成项

- PR 创建、审阅与合并。
- 部署后阅读器页面的真实浏览器冒烟测试。
- CloudBase DYL 真实验收及 DYL 备用目录的最终删除。

## 13. 回滚方式

关闭或回滚本 PR；删除内容均可从基线提交 `c3a40ffb4833b4696ae0ce689967494a26d64cff` 恢复。不得使用历史重写或强推作为常规回滚。

## 14. 最终结论

当前状态：部分完成。普通 Miki 公共池已从清理分支移除；阅读器实际依赖和 DYL 备用目录均保留。存在未通过验证，PR 不应合并，需先处理验证失败。
