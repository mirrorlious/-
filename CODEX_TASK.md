# Codex 本地执行指令

请在本机目录中执行：

`D:\01_project\杨的阅读器`

## 开始前

1. 读取根目录 `AGENTS.md`。
2. 读取 `TASK_LOGS/README.md`。
3. 打开并继续填写：
   `TASK_LOGS/2026-07-26-byok-multi-model-local-cache.md`
4. 检查 `git status`。
5. 不得执行 `git push`。
6. 不得上传 GitHub。
7. 不得修改与“杨的阅读器”无关的文件。

## 第一阶段：只做审计

先确认：

- 当前项目实际入口
- 实际可编辑源码
- 是否存在 gzip / Base64 分块
- 生成产物和生成脚本
- API 配置组件
- Gemini 请求实现
- OpenAI 兼容请求实现
- OCR 实现
- Gemini TTS 实现
- PDF.js 实现
- localStorage 使用位置
- IndexedDB 是否存在
- Firebase 同步边界
- 本地运行方式
- 测试方式

把审计结果和拟修改文件写入任务日志。

## 第二阶段：实施目标

在保持静态应用可运行的前提下，实现：

### A. 用户自带 API Key

普通用户必须使用自己的 Key。

站点不得提供公共模型额度，也不得设置公共 Key回退。

### B. 服务商账户

至少支持：

- Google Gemini
- 阿里云百炼
- 自定义 OpenAI 兼容服务

同一服务商只填写一次 Key。

### C. 任务路由

至少建立：

- analysis
- ocr
- tts

预留 asr。

### D. 本地存储

小型配置：

- localStorage / sessionStorage

大型结果：

- IndexedDB

至少保存：

- 文档元数据
- PDF页面文本
- OCR结果
- 文本分块
- AI解读结果
- 云端TTS音频
- 处理任务进度

### E. 缓存

相同内容、模型、Prompt版本和选项时直接读取本地缓存。

只有用户点击“重新生成”才发起新请求。

### F. PDF与OCR

- PDF文本层优先
- 无有效文本层才OCR
- 按页处理
- 每页完成立即保存
- 支持暂停、继续、取消和失败页重试
- 刷新后恢复任务
- 默认并发1到2页
- 释放临时Canvas和Object URL

### G. 长文档

- 分块
- 本地检索
- 只发送相关片段
- 整本总结采用分层汇总
- 中间结果本地保存

### H. TTS

- 保留 Gemini TTS
- 增加浏览器本地朗读选项
- 云端音频写入 IndexedDB
- 相同文本和声音直接播放缓存

## 安全规则

不得将 API Key写入：

- Git
- Firebase
- IndexedDB成果库
- URL
- console
- 错误信息
- 构建产物默认值

默认只保存到 sessionStorage。

用户主动选择“在此设备记住”后，才保存到 localStorage，并显示公共电脑风险提示。

## 每个阶段

每完成一个阶段：

1. 更新任务日志。
2. 运行相关测试。
3. 记录实际结果。
4. 确认没有改动无关文件。
5. 保持本地，不上传 GitHub。

## 完成后

输出：

1. 修改摘要
2. 新增文件
3. 修改文件
4. 配置迁移
5. 本地数据库结构
6. 缓存逻辑
7. OCR断点续传
8. 长文档请求缩短
9. API Key安全边界
10. 测试结果
11. 手工验收步骤
12. 已知问题
13. 回滚方式
14. GitHub状态

最后必须明确写：

`GitHub：未上传，等待用户本地验收。`
