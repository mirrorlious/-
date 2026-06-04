# 杨的外刊阅读器

一个面向外刊精读和考研英语阅读训练的单页应用。项目从粘贴源码复刻整理而来，保留原有 React + Tailwind CDN 形态，无需构建即可部署到 GitHub Pages。

## 功能

- 外刊文本粘贴阅读、纯净文本/深度精读切换
- 考研生词、预设词库、自定义词库高亮
- 段落精翻、长难句拆解、阅读理解出题
- 全文逻辑剖析和双语思维导图
- Gemini TTS 外教领读
- 图片/PDF 文本提取
- API 路由设置，支持 Google Gemini 原生协议和 OpenAI 兼容协议
- 本地阅读历史、API 设置、排版设置、自定义词库持久化
- 可选 Firebase 沙盒同步

## 使用

直接打开 `index.html`，或使用任意静态服务器运行：

```bash
python -m http.server 5173
```

然后访问 `http://localhost:5173`。

首次使用 AI 功能前，点击右上角“API 设置”，填入自己的模型服务配置。

## 部署到 GitHub Pages

1. 将本项目推送到 GitHub 仓库。
2. 在仓库 Settings -> Pages 中选择部署分支。
3. 根目录含有 `index.html`，无需额外构建步骤。

## 说明

源码里引用了 React、ReactDOM、Babel、Tailwind、Firebase 和外部词库/真题语料 CDN。普通浏览器环境没有 Firebase 配置时，应用会自动使用 `localStorage` 保存阅读历史和个人设置。