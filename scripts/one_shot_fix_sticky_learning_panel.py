from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-27-0545-fix-sticky-learning-panel.md')
WORKFLOW = Path('.github/workflows/fix_sticky_learning_panel_once.yml')
SELF = Path('scripts/one_shot_fix_sticky_learning_panel.py')

text = INDEX.read_text(encoding='utf-8')

old_css = '''        .reader-workspace-split {
            display: grid;
            grid-template-columns: minmax(0, 58fr) minmax(360px, 42fr);
            gap: clamp(12px, 1.2vw, 20px);
            align-items: start;
            width: 100%;
            padding-inline: clamp(8px, 1vw, 18px);
        }
'''
new_css = '''        .reader-page-shell {
            overflow-x: clip;
        }

        .reader-workspace-split {
            display: grid;
            grid-template-columns: minmax(0, 58fr) minmax(360px, 42fr);
            gap: clamp(12px, 1.2vw, 20px);
            align-items: start;
            width: 100%;
            padding-inline: clamp(8px, 1vw, 18px);
            overflow: visible;
        }
'''
if old_css not in text:
    raise SystemExit('workspace CSS anchor not found')
text = text.replace(old_css, new_css, 1)

old_main_column = '''        .reader-main-column,
        .reader-side-panel {
            min-width: 0;
        }
'''
new_main_column = '''        .reader-main-column,
        .reader-side-panel {
            min-width: 0;
        }

        .reader-main-column {
            overflow: visible;
        }
'''
if old_main_column not in text:
    raise SystemExit('main column CSS anchor not found')
text = text.replace(old_main_column, new_main_column, 1)

old_side = '''        .reader-side-panel {
            position: sticky;
            top: 72px;
            height: calc(100vh - 80px);
            max-height: none;
            overflow: hidden;
            align-self: start;
            min-height: 0;
        }
'''
new_side = '''        .reader-side-panel {
            position: -webkit-sticky;
            position: sticky;
            top: 72px;
            height: calc(100dvh - 80px);
            max-height: calc(100dvh - 80px);
            overflow: hidden;
            align-self: start;
            min-height: 0;
            z-index: 20;
        }
'''
if old_side not in text:
    raise SystemExit('side panel CSS anchor not found')
text = text.replace(old_side, new_side, 1)

old_shell = '''<div className={`min-h-screen bg-[#F9FAFB] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans pb-24 relative overflow-x-hidden transition-colors duration-300 ${isImmersive ? 'reader-immersive' : ''}`}>'''
new_shell = '''<div className={`reader-page-shell min-h-screen bg-[#F9FAFB] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans pb-24 relative transition-colors duration-300 ${isImmersive ? 'reader-immersive' : ''}`}>'''
if old_shell not in text:
    raise SystemExit('page shell anchor not found')
text = text.replace(old_shell, new_shell, 1)

old_main = '''<main className={`${isReadingMode || isPdfMode ? 'w-full max-w-none my-0 sm:my-0 sm:border-x-0 sm:rounded-none min-h-[calc(100vh-64px)]' : 'max-w-[1200px] sm:my-8'} mx-auto bg-white dark:bg-gray-900 sm:border border-gray-200 dark:border-gray-800 sm:rounded-sm min-h-[85vh] transition-colors overflow-hidden`}>'''
new_main = '''<main className={`${isReadingMode || isPdfMode ? 'w-full max-w-none my-0 sm:my-0 sm:border-x-0 sm:rounded-none min-h-[calc(100vh-64px)]' : 'max-w-[1200px] sm:my-8'} mx-auto bg-white dark:bg-gray-900 sm:border border-gray-200 dark:border-gray-800 sm:rounded-sm min-h-[85vh] transition-colors ${isReadingMode ? 'overflow-visible' : 'overflow-hidden'}`}>'''
if old_main not in text:
    raise SystemExit('main overflow anchor not found')
text = text.replace(old_main, new_main, 1)

required = [
    'reader-page-shell',
    'overflow-x: clip',
    'position: -webkit-sticky',
    'height: calc(100dvh - 80px)',
    "${isReadingMode ? 'overflow-visible' : 'overflow-hidden'}"
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing sticky repair markers: {missing}')
if 'overflow-x-hidden transition-colors' in text:
    raise SystemExit('Old page overflow class remains')

INDEX.write_text(text, encoding='utf-8')

if LOG.exists():
    log = LOG.read_text(encoding='utf-8')
    log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
    log = log.replace('## 5. 实际修改\n\n开发中。', '''## 5. 实际修改

- 根页面容器新增 `reader-page-shell`，横向裁切改用 `overflow-x: clip`，不再创建错误的 sticky 滚动包含块。
- 阅读模式 `<main>` 改为 `overflow-visible`；首页和 PDF 模式继续保留 `overflow-hidden`。
- 工作区和正文列显式保持 `overflow: visible`。
- 学习侧栏补充 `position: -webkit-sticky`，高度改用动态视口单位 `100dvh`，并设置稳定层级。
- 侧栏标签栏继续位于独立滚动区之外，只有内容区域内部滚动。''')
    log = log.replace('## 6. 测试\n\n待执行。', '''## 6. 测试

- 修复标记检查：通过。
- 旧 `overflow-x-hidden` 页面根类移除检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器真实滚动：等待用户本地复测。''')
    LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
