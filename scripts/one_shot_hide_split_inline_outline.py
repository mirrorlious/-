from pathlib import Path

index_path = Path('index.html')
log_path = Path('TASK_LOGS/2026-07-27-2200-hide-inline-outline-in-split.md')
workflow_path = Path('.github/workflows/hide_split_inline_outline_once.yml')
script_path = Path('scripts/one_shot_hide_split_inline_outline.py')

text = index_path.read_text(encoding='utf-8')

start_anchor = '''                                    <div className="flex flex-col items-center">
                                        {!fullMapData ? (
'''
replacement_start = '''                                    {!(layoutMode === 'split' && rightPanelOpen) && (
                                    <div data-reader-inline-outline="true" className="flex flex-col items-center">
                                        {!fullMapData ? (
'''

if text.count(start_anchor) != 1:
    raise SystemExit(f'Inline outline start anchor count: {text.count(start_anchor)}')

start = text.index(start_anchor)
text = text.replace(start_anchor, replacement_start, 1)

end_anchor = '''                                    </div>
                                </article>
                                {layoutMode === 'split' && rightPanelOpen && (
'''
replacement_end = '''                                    </div>
                                    )}
                                </article>
                                {layoutMode === 'split' && rightPanelOpen && (
'''

end_search_start = text.index(replacement_start)
end_pos = text.find(end_anchor, end_search_start)
if end_pos == -1:
    raise SystemExit('Inline outline end anchor not found')
text = text[:end_pos] + replacement_end + text[end_pos + len(end_anchor):]

required = [
    "{!(layoutMode === 'split' && rightPanelOpen) && (",
    'data-reader-inline-outline="true"',
    "{layoutMode === 'split' && rightPanelOpen && (",
    'data-reader-selection-toolbar="true"'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing markers after patch: {missing}')
if text.count('data-reader-inline-outline="true"') != 1:
    raise SystemExit('Inline outline marker count is not 1')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

index_path.write_text(text, encoding='utf-8')

log = log_path.read_text(encoding='utf-8')
log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
log = log.replace('## 6. 实际修改\n\n开发中。', '''## 6. 实际修改

- 为正文底部结构树增加条件：仅在“不是分栏且侧栏开启”的情况下渲染。
- 分栏模式且学习侧栏打开时，结构树生成按钮与结构树结果均不进入 DOM，不再占据左侧正文列高度。
- 标准、专注或关闭侧栏时，原正文底部结构树继续保留。
- 添加 `data-reader-inline-outline` 标记用于自动检查。
- 未修改选区工具条、段落菜单和右侧学习面板。''')
log = log.replace('## 7. 测试\n\n待执行。', '''## 7. 测试

- 精确源码锚点：通过。
- 分栏隐藏条件与正文结构树标记检查：通过。
- 选区工具条保留标记检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器视觉验收：等待用户本地复测。''')
log_path.write_text(log, encoding='utf-8')

for disposable in (workflow_path, script_path):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
