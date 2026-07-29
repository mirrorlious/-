# 任务：阶段 3 全站交互无障碍治理

- 时间：2026-07-29 20:47
- 执行者：Codex
- 状态：已完成
- 本地路径：`D:\01_project\杨的阅读器`
- GitHub 上传：否

## 1. 用户原始要求

完成阶段三。

## 2. 任务目标

- 按前序路线完成阶段 3：修复关键弹层、菜单、点击卡片和表单标签的键盘与焦点行为。
- 建立共用、可测试的焦点管理基础设施，避免每个弹层各写一套不一致逻辑。
- 保持视觉、业务状态、数据 schema 和 API 行为兼容。

## 3. 本次范围

- `src/components/` 中段落菜单、词卡和阅读交互。
- `src/App.jsx` 中关键弹层、菜单、抽屉、点击卡片及表单控件。
- 共用无障碍 hooks/工具。
- 键盘与焦点浏览器回归。

## 4. 明确不做

- 不重做视觉系统。
- 不修改模型调用、OCR、PDF 处理、Firebase、缓存和持久化 schema。
- 不增加第三方无障碍组件库。
- 不提交、不推送、不部署。

## 5. 审计结果

- 阶段 0+1 已建立 Vite 生产构建和自动回归；阶段 2 已完成 core/services/components 拆分。
- 前序静态审计记录的主要缺口为：多个弹层缺少焦点圈定和关闭后返回；菜单缺少打开后聚焦与方向键；点击 `div` 缺少键盘触发；部分输入控件缺少程序化标签关联。
- 当前基线为 3 个 Vitest 文件、13 条单测和 4 条 Playwright + Edge 回归。
- 阶段 3 将优先覆盖用户最常用的词卡、段落菜单、阅读库/配置弹层和确认弹层。
- AST 审计确认 8 个覆盖层需要统一 dialog 行为；主菜单、全文工具、段落菜单和选区菜单需要方向键模型；阅读库和书籍识别各有包含嵌套控件的点击卡片，适合补 `role`/`tabIndex`/键盘触发而不是直接改成嵌套 button。
- 表单审计覆盖 App、思维导图和段落组件；修复前发现多处仅有可见文字但未通过 `id`/`htmlFor` 或 `aria-label` 建立程序化名称。

## 6. 涉及文件

- `src/App.jsx`
- `src/components/Paragraph.jsx`
- `src/components/MindMap.jsx`
- `src/accessibility/focus.js`
- `tests/unit/accessibility-focus.test.js`
- `tests/e2e/reader-baseline.spec.js`
- `README.md`
- 本任务日志

## 7. 实施计划

1. 统计 dialog/menu/clickable/label 缺口，按复用价值排序。
2. 实现焦点陷阱、初始聚焦、Escape 关闭、关闭后焦点返回和菜单键盘导航 hooks。
3. 接入关键弹层和菜单；将非语义点击卡片改为 button 或补齐 role/tabIndex/键盘触发。
4. 补齐关键输入控件的 id/label 或 aria-label。
5. 增加单元契约和浏览器真实键盘回归，运行完整构建与安全检查。

## 8. 实际修改

- 新增 `src/accessibility/focus.js`：
  - 统一可聚焦元素识别和首焦点选择。
  - dialog 初始聚焦、Tab/Shift+Tab 圈定、Escape 关闭和焦点返回。
  - menu 首项聚焦、ArrowUp/ArrowDown/Home/End、Tab 关闭和 Escape 返回触发器。
  - 非原生点击卡片的 Enter/Space 激活工具。
- 8 个关键覆盖层接入 dialog 语义与焦点管理：
  - 阅读排版、阅读库、个人词库、模型配置；
  - 书籍识别结果、PDF 打开方式、批量全文解析、全屏思维导图。
- 主菜单、全文工具、段落菜单和选区快捷菜单补充完整 menu/menuitem 结构、`aria-controls`、打开后聚焦和方向键导航。
- 阅读库文章卡片和书籍识别文章卡片增加 `role="button"`、`tabIndex`、Enter/Space、焦点环和准确名称；嵌套复选框、标题输入及删除按钮保持独立操作。
- 单词和短语划线增加键盘焦点、Enter/Space 打开、读屏名称和焦点环；词汇卡关闭按钮补充名称。
- 排版范围控件、API 配置、文件输入、正文、批注、全文笔记、导图节点等表单控件补齐程序化名称。
- 遮罩层中原有可点击 `div` 改为具名 button，避免非语义点击入口。
- README 增加阶段 3 键盘与焦点能力说明。
- 新增 4 条焦点工具单元测试和 4 条真实键盘浏览器回归。

## 9. 数据与配置迁移

无。未修改 IndexedDB、localStorage/sessionStorage key、Markdown schema、API 路由、缓存键或用户内容。

## 10. 测试

### 自动测试

- `npm run test:unit`：4 个文件、17 条测试全部通过。
- `npm run build`：通过；Vite 转换 57 个模块，静态资源脚本确认 3 份词库 JSON。
- `npm run test:e2e`：8 条 Microsoft Edge 回归全部通过。
- `npm test`：完整流水线通过。
- `npm audit --audit-level=low`：0 项漏洞。
- `git diff --check`：通过；仅有 Windows LF/CRLF 提示，无空白错误。
- AST 全量扫描：14 个源码模块可解析，8 个 dialog、4 个 menu；未标记表单控件 0，未具备语义的点击 `div/span/article/li` 0。
- 框架 CDN、浏览器端 Babel、开发版 React 和常见 API Key 字面量扫描：未发现。

### 浏览器验收

- Playwright + 系统 Edge 验证：
  - 主菜单首项自动聚焦，ArrowDown/End 和 Escape 返回正常。
  - 排版弹层首控件聚焦、Shift+Tab/Tab 首尾循环、Escape 关闭并回到主菜单。
  - 全文工具与段落菜单方向键和 Escape 返回正常。
  - 划线词可以通过 Enter 打开释义卡。
- Codex 应用内浏览器复核：
  - 页面无障碍树正确暴露 banner/main/textbox。
  - 主菜单正确暴露 menu/menuitem，首项为 active，方向键移动到下一项。
  - 排版层正确暴露为 `dialog "阅读排版设置"`，首个 combobox 为 active。
  - Escape 后 dialog 消失，active 元素恢复为“主菜单”。

## 11. 风险与已知问题

- 焦点工具使用 DOM 可见性与标准可聚焦选择器，不依赖第三方组件库；如果未来引入 Shadow DOM 或 iframe，需要扩展遍历策略。
- 阅读库和书籍卡片因包含嵌套控件使用 `role="button"`，键盘激活只在卡片本身为事件目标时执行，避免子控件回车冒泡误触。
- 词汇划线使用可聚焦 span 以保持行内排版；读屏和键盘语义已补齐，但高密度文章中 Tab 顺序会包含所有已划线词，这是可发现性与跳转次数之间的取舍。
- 未执行完整人工读屏软件会话，仅验证浏览器无障碍树、键盘行为和程序化名称。

## 12. 未完成项

- NVDA、Narrator 或 VoiceOver 的整段人工朗读体验。
- 高对比度模式、200%/400% 缩放和触控读屏的专项验收。
- 对 AI/PDF/OCR 失败状态进行 `aria-live` 优先级的系统梳理。

## 13. 回滚方式

回退 `src/accessibility/focus.js`、App/Paragraph/MindMap 中阶段 3 新增的 refs、role、aria、键盘处理和标签关联，并删除阶段 3 新增测试增量；阶段 0—2 及已掌握词功能不回滚。

## 14. 最终结论

阶段 3 已完成。关键弹层、菜单、点击卡片、划线词和表单控件已具备一致的键盘与焦点行为；单元、生产构建、系统 Edge 和应用内浏览器验证均通过。

GitHub：未上传，等待用户本地验收。
