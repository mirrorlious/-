# 任务：BYOK 多模型路由与本地 AI 成果库

- 时间：2026-07-26
- 执行者：Codex
- 状态：部分完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：否

## 1. 用户原始要求

将当前单一 API 配置升级为：

- 使用者自行填写自己的 API Key
- 内容解析、OCR、语音分别使用独立模型路由
- 同一服务商 API Key只填写一次并供多个模型复用
- OCR、AI解读和云端语音结果优先保存到本地
- 再次打开或再次调用时复用本地结果
- 避免重复发送超长请求与重复计费
- 本地修改和验收无误后，再由用户决定是否上传 GitHub

## 2. 任务目标

1. 审计真实运行入口和可编辑源码。
2. 建立服务商账户与任务路由两层配置。
3. 实现用户自带 API Key。
4. 实现本地 AI 成果库。
5. 实现 OCR 按页持久化和断点续传。
6. 实现长文档分块、本地检索和结果复用。
7. 保持项目现有静态部署能力。
8. 不修改无关文件。
9. 不上传 GitHub。

## 3. 本次范围

- API 配置中心
- Gemini 原生协议
- OpenAI 兼容协议
- 阿里云百炼预设
- analysis / ocr / tts 路由
- 浏览器本地朗读
- PDF.js 文本层提取
- 图片及扫描 PDF OCR
- IndexedDB
- 缓存键
- 长文档分块
- 本地检索
- 任务进度恢复
- 旧配置迁移
- 安全提示
- 相关测试与文档

## 4. 明确不做

- 仓库清理
- 无关项目迁移
- GitHub 上传
- GitHub Pages 发布
- Firebase 全面重构
- 无关 UI 改版
- 云端阅读库
- 站长公共模型额度
- 未经要求的依赖全面升级

## 5. 审计结果

审计时间：2026-07-26（本地）。

- 项目入口：根目录 `index.html`；README 建议直接打开，或运行 `python -m http.server 5173` 后访问 localhost。
- 可编辑源码：`index.html` 是单文件 React + Babel CDN 源码，没有发现 `src/`、`package.json`、构建配置或生成脚本。
- 生成物：未发现 gzip/Base64 分块生成物或对应生成脚本；`index.html` 为当前唯一应用源码，不能把其中的 Base64 音频转换逻辑误判为生成产物。
- API 配置：`DEFAULT_API_CONFIG` 和 `apiConfig` 位于 `index.html`；当前只有一份配置，支持 Gemini 原生与 OpenAI 兼容协议，API Key 直接随配置保存。
- AI 请求：统一入口 `callLLM`；翻译、长难句、全文分析、测验、思维导图和词义消歧均复用该入口。
- OCR/媒体：`extractTextFromMedia` 将图片转 Base64 后调用配置的视觉模型；没有扫描 PDF 的逐页 OCR 流程、任务持久化或失败页重试。
- TTS：`callGeminiTTS` 调用 Gemini 音频接口，将 PCM 转为临时 WAV Object URL；没有 IndexedDB 音频缓存，也没有浏览器本地朗读选项。
- PDF.js：通过 jsDelivr ESM CDN 加载；`extractPdfTextLocally` 在浏览器逐页提取文本并重建段落，失败时提示使用原样阅读；结果只写入当前输入框。
- 本地存储：`localStorage` 的 `yang-reader-state-v1` 保存 API 配置、历史、词典和排版设置；未使用 `sessionStorage`、IndexedDB 或内容哈希缓存。
- Firebase：存在可选同步链路，且当前会把 `apiConfig`（包括 Key）写入 Firebase；这违反本任务的 API Key 安全边界，必须改为只同步非敏感配置或禁用该配置同步。
- 长文档：`getModelSafeText` 按字符数截断请求并提示用户，没有分块、本地检索、分层汇总或中间结果持久化。
- 测试：没有自动化测试、依赖清单或构建命令；可执行的本地验证为静态语法/关键路径检查和通过本地 HTTP 服务加载页面。

结论：真实功能集中在一个可维护源码文件中，本次应以小步、可回滚方式扩展 `index.html`，不改动无关目录，不上传 GitHub。

必须确认：

- 项目入口
- 真实可编辑源码
- 压缩或 Base64 生成产物
- 生成脚本
- API 配置位置
- AI 请求入口
- OCR 入口
- TTS 入口
- PDF.js 处理流程
- localStorage
- IndexedDB
- Firebase
- 本地启动方式
- 测试方式

## 6. 涉及文件

- `index.html`：唯一应用源码，包含 UI、API、PDF、媒体处理、本地状态与 Firebase 链路。
- `TASK_LOGS/2026-07-26-byok-multi-model-local-cache.md`：本次审计、计划、实施和验证记录。
- 不修改 README、规则文件或其他无关文件。

## 7. 实施计划

1. 将 API 配置拆为服务商账户与 `analysis` / `ocr` / `tts` 任务路由，保留旧单配置迁移。
2. 默认把 Key 放入 `sessionStorage`；仅用户勾选“记住此设备”时写入 `localStorage`，Firebase 只同步无 Key 配置。
3. 增加 IndexedDB 本地成果库与基于内容/模型/Prompt 版本的缓存键，先覆盖 AI 结果和 TTS 音频。
4. 增加浏览器 `speechSynthesis` 本地朗读选项；保持 Gemini TTS 作为云端选项。
5. 将长文档请求改为可复用的分块基础能力，避免整篇重复发送；保留现有功能的最小改动。
6. 为 PDF/OCR 增加可持久化的任务状态基础结构和逐页结果保存，失败时可从未完成页继续。
7. 每一步运行静态检查和本地 HTTP 加载验证，最后补齐本日志。

原则：

- 小步修改
- 本地优先
- 可回滚
- 不改无关文件
- 每阶段完成后验证
- 最后才更新生成产物

## 8. 实际修改

已完成本地最小实现，实际修改仅涉及 `index.html`：

- 增加 `analysis`、`ocr`、`tts` 任务模型路由；保留旧单配置作为默认账户并兼容旧配置。
- API Key 默认保存到 `sessionStorage`；新增“在此设备记住 Key”选项，勾选后才写入独立的 `localStorage` 项。
- 启动时迁移旧 `localStorage` 配置中的 Key 到 sessionStorage，并从旧配置对象移除；Firebase API 配置同步使用去 Key 的安全配置。
- 增加 IndexedDB `ai-cache`、`tts-cache`、`pdf-tasks` 存储；缓存键包含内容哈希、模型、协议、基础地址、任务和 Prompt 版本。
- LLM 结果、图片 OCR 结果和 Gemini TTS WAV 音频接入本地缓存。
- PDF 文本提取按文件指纹保存逐页进度和段落，可从已完成页继续。
- 全文翻译增加按段落边界分块请求；浏览器端增加 `speechSynthesis` 本地朗读入口。

## 9. 数据与配置迁移

旧 `apiConfig.key` 会在首次加载时迁移到当前会话；默认不会继续写入项目状态的 `localStorage` 或 Firebase。已有非敏感配置（协议、Base URL、模型、任务路由）保持兼容。

## 10. 测试

### 自动测试

无 package.json 或自动化测试框架；已通过本地 HTTP 服务加载页面，并使用新标签页确认 Babel 编译无错误。

### 手工验收

已验证：页面标题和主界面正常渲染；主菜单可打开；模型配置弹窗显示 Key 记住选项和 analysis/OCR/TTS 三个模型字段；文章输入框可用；新页面控制台无 error。

## 11. 风险与已知问题

当前已知风险：

1. 项目可能将真实应用压缩为 gzip + Base64 分块。
2. 必须先找到或恢复可维护源码，不能长期手工编辑生成产物。
3. 静态 GitHub Pages 环境下，部分第三方 API 可能存在 CORS 限制。
4. IndexedDB 存储配额因浏览器和设备而异。
5. PDF OCR必须控制并发和内存。
6. 旧 API 配置迁移必须避免丢失用户 Key。

## 12. 未完成项

- 尚未实现扫描 PDF 的自动逐页 OCR；当前 PDF 断点续传覆盖的是文本层提取任务，扫描版仍需用户选择图片/OCR流程。
- 尚未建立独立的本地全文检索 UI 和分层汇总 UI；全文翻译已具备分块基础能力。
- 任务路由目前共享同一个服务商账户和 Key，可分别指定任务模型；尚未提供多个账户列表管理。
- 未进行真实 API 请求测试，避免在本地验证中使用或暴露用户 Key。

## 13. 回滚方式

开始开发前：

- 记录当前 Git 状态
- 建立本地开发分支
- 不推送远程
- 每个阶段保持可回滚提交

## 14. 最终结论

本次本地实现已完成主要安全存储、任务路由、缓存、PDF 进度和本地朗读基础能力；待用户进行真实模型配置和功能验收。

测试结果：本地 HTTP 页面加载通过，新标签页无 JavaScript 编译错误；未执行真实外部 API 请求。

回滚方式：仅需恢复 `index.html` 的本地改动；`AGENTS.md`、`CODEX_TASK.md` 和 `TASK_LOGS/` 为规则/日志文件，不参与运行时回滚。

GitHub：未上传，等待用户本地验收。
