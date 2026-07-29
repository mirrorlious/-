# PWA 移动端 App 化版本

分支：`feat/pwa-mobile-app`

## 目标

让手机浏览器中的阅读器可以安装到主屏幕，并在独立窗口中运行，获得接近原生 App 的启动、全屏、安全区和更新体验。

## 已实现

- Web App Manifest：名称、启动地址、主题色、独立窗口模式及标准/Maskable 图标。
- Service Worker：缓存应用外壳和 Vite 静态资源；不重复缓存大型 `public-resources` 数据包。
- Android 安装提示：浏览器满足安装条件时显示安装入口。
- iOS 引导：提示通过 Safari“共享 → 添加到主屏幕”。
- 新版本提示：Service Worker 下载完成后允许用户立即更新。
- 移动端适配：`viewport-fit=cover`、刘海屏安全区、动态视口高度、触控与输入框防自动缩放。
- 构建时自动生成 180、192、512 和 Maskable PNG 图标，无额外 npm 依赖。

## 构建

```bash
npm ci --include=dev
npm run build
```

`prebuild` 会先执行 `scripts/generate-pwa-icons.mjs`，随后 Vite 会将 `public` 中的 Manifest、Service Worker 和图标复制到 `dist`。

## Cloudflare 预览部署

```bash
npx wrangler@latest versions upload
```

正式部署前，应在 Android Chrome 和 iPhone Safari 上分别验证：

1. 添加到主屏幕；
2. 从桌面图标独立启动；
3. 刘海屏与底部安全区；
4. 页面刷新和 React 路由回退；
5. Firebase 登录、IndexedDB 数据和 PDF/图片资源；
6. 发布第二个版本后是否出现更新提示。

## 边界

- 分支未合并到 `main`。
- Service Worker 只缓存应用外壳，不把大型资料包整体复制到离线缓存。
- iOS 安装动作仍需用户在 Safari 中手动确认，这是系统限制。
