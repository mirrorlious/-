# 任务：修复学习侧栏未随页面保持可见

- 时间：2026-07-27
- 执行者：ChatGPT
- 状态：部分完成
- 项目：杨的阅读器
- 仓库：`mirrorlious/-`
- 工作分支：`feat/reader-annotations-v2`

## 1. 用户反馈

全宽与三栏布局已生效，但向下滚动正文后，右侧“全文结构 / 精读结果 / 学习笔记”整体仍随文档向上离开视口，顶部标签栏消失，没有保持在页面顶部下方。

## 2. 原因定位

- 页面根容器使用 `overflow-x-hidden`。CSS 中任一祖先元素出现非 `visible/clip` 的 overflow，可能成为 sticky 的滚动包含块，导致侧栏不再相对浏览器视口吸附。
- 阅读主容器仍固定带有 `overflow-hidden`，同样会截断或改变 sticky 的参照滚动容器。
- 侧栏本身虽声明 `position: sticky`，但祖先 overflow 条件使其无法按预期工作。

## 3. 本次修改

- 页面横向裁切由 `overflow-x-hidden` 改为不创建滚动容器的 `overflow-x: clip`。
- 阅读模式主容器改为 `overflow: visible`；首页与 PDF 模式继续保留必要的裁切。
- 强化学习侧栏 sticky 声明，补充 `-webkit-sticky`、层级和可见 overflow 链。
- 保持侧栏固定视口高度、标签栏不滚动、内容区独立滚动。

## 4. 验收标准

- 页面向下滚动时，学习侧栏始终停留在顶栏下方。
- “全文结构 / 精读结果 / 学习笔记”标签栏始终可见。
- 侧栏长内容只在侧栏内部滚动。
- 正文双栏、段落菜单、批注和全文工具不受影响。
- Babel JSX 解析通过。

## 5. 实际修改

- 根页面容器新增 `reader-page-shell`，横向裁切改用 `overflow-x: clip`，不再创建错误的 sticky 滚动包含块。
- 阅读模式 `<main>` 改为 `overflow-visible`；首页和 PDF 模式继续保留 `overflow-hidden`。
- 工作区和正文列显式保持 `overflow: visible`。
- 学习侧栏补充 `position: -webkit-sticky`，高度改用动态视口单位 `100dvh`，并设置稳定层级。
- 侧栏标签栏继续位于独立滚动区之外，只有内容区域内部滚动。

## 6. 测试

- 修复标记检查：通过。
- 旧 `overflow-x-hidden` 页面根类移除检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器真实滚动：等待用户本地复测。

## 7. 回滚方式

回退本次修复提交即可；不涉及 `main`。
