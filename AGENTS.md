# AGENTS.md

## 项目身份

本仓库是 **杨的外刊 / 考研英语阅读器**。

当前目标：维护一个本地优先、BYOK、面向考研英语精读的 React + Vite 阅读器。仓库只保留当前运行、测试、构建、部署和必要学习资源所需内容。

## 工作原则

1. 先读取 `README.md`、`package.json` 和与任务直接相关的源码。
2. 修改范围必须与当前任务直接相关，不顺手扩张。
3. 优先修改可维护源码，不手改生成产物。
4. 不把 API Key、Token、账号凭据、用户正文或受版权保护的完整资料写入 Git。
5. 不恢复已经明确删除的旧公共池、DYL 备份、临时工作流、任务日志或迁移产物。
6. 当前运行时已使用的资源不得仅因历史来源不同而误删；删除前先确认引用关系。

## 当前主要结构

- `src/`：React 阅读器源码
- `public/`：PWA 图标、manifest、service worker
- `public-resources/kaoyan-english-2027-vocabulary/`：考研英语词汇运行时 JSON
- `public-resources/ielts-vocabulary/`：当前阅读器仍在使用的 IELTS 词汇扩展
- `scripts/`：生产构建和 PWA 必要脚本
- `tests/`：单元测试和 E2E
- `.github/workflows/pwa-branch-check.yml`：PWA / 构建相关 PR 检查

## 明确不应重新引入

- Miki / DYL 公共资源备份
- 与阅读器无关的公共卡包和媒体
- `TASK_LOGS/` 历史任务流水
- `CODEX_TASK.md` 一次性任务指令
- `app/*.b64*` 临时传输 / 迁移产物
- 已完成使命的一次性 patch / trigger workflow
- 与运行时 JSON 重复的生成型词库 `.tsx` 副本

## Git 规则

- 普通功能与修复使用独立分支和 PR。
- 合并到 `main` 时优先 squash，保持“一项功能 / 修复 = 一条主线提交”。
- 不用临时 `trigger`、`retrigger`、`prepare runner` 等提交污染 `main`。
- 不直接 force-push `main`，除非用户明确要求历史清理；历史清理属于专项操作。
- 删除远程历史、分支或资源前确认目标 ref / SHA。

## 验证

按修改范围执行最小充分验证：

- `npm run test:unit`
- `npm run lint:a11y`
- `npm run build`
- 必要时 `npm run test:e2e`

已知失败不得伪装成通过；若为主线既有问题，需要明确区分。

## 数据与隐私

- API Key 默认仅按应用既有安全策略存储，不进入 Git。
- 大型正文和 AI 学习结果以浏览器本地存储 / 用户导出文件为主。
- 公开仓库只保留明确允许公开且运行所需的资源。
