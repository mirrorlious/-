# 任务：清理杨的阅读器仓库中的普通 Miki 公共池

- 时间：2026-08-03 02:10（Asia/Shanghai）
- 执行者：ChatGPT
- 状态：审计中
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
- 不在未确认依赖前删除 `public-resources/kaoyan-english-2027-vocabulary/`。
- 不改阅读器 UI、AI/BYOK、OCR、TTS、IndexedDB、Firebase、学习逻辑或部署策略。
- 不改 Miki 仓库、Firebase、CloudBase、COS 或线上数据。
- 不重写 Git 历史，不强推，不删除旧分支。

## 5. 审计结果

审计进行中。已确认：

- `package.json` 的生产构建执行 `vite build && node scripts/build-cloudbase-v2.cjs`。
- `scripts/build-cloudbase-v2.cjs` 会复制整个 `public-resources/` 到构建输出，并明确检查 `kaoyan-english-2027-vocabulary/` 至少存在 3 个 JSON 文件，因此该目录目前属于阅读器构建依赖，不能删除。
- Miki 普通资源的新仓库已正式保留 8 个公共池条目；DYL 不在新公开仓库。

## 6. 涉及文件

初步候选，必须经引用审计后确认：

- `public-resources/manifest.json`
- `public-resources/politics-2027/`
- `public-resources/pharmacology/`
- `public-resources/jlpt-eggrolls/`
- `public-resources/kaoyan-english-one-papers/`
- `public-resources/kaoyan-english-two-papers/`
- 仅服务上述资料包的生成脚本、工具与工作流
- 本任务日志

明确保留：

- `public-resources/dyl-exam-public-backup/`
- `public-resources/ielts-vocabulary/`
- `public-resources/kaoyan-english-2027-vocabulary/`
- `scripts/build-cloudbase-v2.cjs`

## 7. 实施计划

1. 生成完整仓库文件和引用审计，形成“删除／保留／待确认”清单。
2. 仅删除“明确属于 Miki 且阅读器无引用”的文件。
3. 运行 unit、a11y lint、production build、E2E（环境允许时）和 `git diff --check`。
4. 补全日志，创建 PR；不直接修改 `main`。

## 8. 实际修改

尚未开始删除。

## 9. 数据与配置迁移

无。仅清理 Git 仓库当前分支中的重复公开资源副本。

## 10. 测试

### 自动测试

待执行。

### 手工验收

待执行。

## 11. 风险与已知问题

- `scripts/build-cloudbase-v2.cjs` 复制整个 `public-resources/`，删除错误目录可能导致阅读器部署缺少词库。
- 老版本 Miki 客户端仍可能请求旧仓库，因此本轮只在 Miki 新链路已合并的前提下清理普通资源；DYL 继续保留。
- Git 当前分支删除不等于历史彻底删除，旧提交仍可访问。

## 12. 未完成项

- 完整引用审计。
- 删除实施。
- 自动测试与构建。
- PR 创建与合并。
- CloudBase DYL 真实验收及 DYL 备用目录的最终删除。

## 13. 回滚方式

关闭或回滚本 PR；删除内容均可从基线提交 `c3a40ffb4833b4696ae0ce689967494a26d64cff` 恢复。不得使用历史重写或强推作为常规回滚。

## 14. 最终结论

当前状态：审计中。
