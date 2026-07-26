from pathlib import Path

index_path = Path('index.html')
log_path = Path('TASK_LOGS/2026-07-27-2220-paragraph-cache-labels.md')
workflow_path = Path('.github/workflows/paragraph_cache_labels_once.yml')
script_path = Path('scripts/one_shot_paragraph_cache_labels.py')

text = index_path.read_text(encoding='utf-8')

replacements = [
    (
        '''                                    {(isTransLoading || isLocalTransLoading) && !finalTranslationToShow ? <span className="text-[10px] text-gray-400">处理中</span> : showTranslation ? <span className="text-sky-600">✓</span> : null}''',
        '''                                    {(isTransLoading || isLocalTransLoading) && !finalTranslationToShow ? <span className="text-[10px] text-gray-400">处理中</span> : finalTranslationToShow ? <span className="text-[10px] text-sky-600 dark:text-sky-400">已缓存</span> : null}''',
        'translation cache label'
    ),
    (
        '''                                    {isAnalysisLoading ? <span className="text-[10px] text-gray-400">解构中</span> : showAnalysis ? <span className="text-amber-600">✓</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">本段较短</span> : null}''',
        '''                                    {isAnalysisLoading ? <span className="text-[10px] text-gray-400">解构中</span> : analysisData ? <span className="text-[10px] text-amber-600 dark:text-amber-400">已缓存</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">本段较短</span> : null}''',
        'analysis cache label'
    ),
    (
        '''                                    {isAudioLoading ? <span className="text-[10px] text-gray-400">请求中</span> : audioUrl ? <span className="text-blue-600">✓</span> : <span className="text-[10px] text-gray-400">调用模型</span>}''',
        '''                                    {isAudioLoading ? <span className="text-[10px] text-gray-400">请求中</span> : audioUrl ? <span className="text-[10px] text-blue-600 dark:text-blue-400">已缓存</span> : <span className="text-[10px] text-gray-400">调用模型</span>}''',
        'audio cache label'
    ),
    (
        '''                                    {isQuizLoading ? <span className="text-[10px] text-gray-400">生成中</span> : showQuiz ? <span className="text-violet-600">✓</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">内容不足</span> : null}''',
        '''                                    {isQuizLoading ? <span className="text-[10px] text-gray-400">生成中</span> : quizData ? <span className="text-[10px] text-violet-600 dark:text-violet-400">已缓存</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">内容不足</span> : null}''',
        'quiz cache label'
    )
]

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    text = text.replace(old, new, 1)

required = [
    'finalTranslationToShow ? <span className="text-[10px] text-sky-600 dark:text-sky-400">已缓存</span>',
    'analysisData ? <span className="text-[10px] text-amber-600 dark:text-amber-400">已缓存</span>',
    'audioUrl ? <span className="text-[10px] text-blue-600 dark:text-blue-400">已缓存</span>',
    'quizData ? <span className="text-[10px] text-violet-600 dark:text-violet-400">已缓存</span>',
    'if (existingTranslation)',
    'if (analysisData)',
    'if (quizData)'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing cache markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

index_path.write_text(text, encoding='utf-8')

log = log_path.read_text(encoding='utf-8')
log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
log = log.replace('## 7. 实际修改\n\n开发中。', '''## 7. 实际修改

- 段落翻译存在 `finalTranslationToShow` 时，菜单右侧显示小字“已缓存”。
- 长难句结果存在 `analysisData` 时，菜单右侧显示小字“已缓存”。
- 段落练习存在 `quizData` 时，菜单右侧显示小字“已缓存”。
- 外教领读存在 `audioUrl` 时，菜单右侧显示小字“已缓存”。
- 缓存提示不再依赖结果是否当前展开，因此折叠后仍可识别。
- 各处理函数原有缓存复用逻辑保持不变。''')
log = log.replace('## 8. 测试\n\n待执行。', '''## 8. 测试

- 四类缓存状态源码替换：通过。
- 现有结果复用分支保留检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器视觉验收：等待用户本地复测。''')
log_path.write_text(log, encoding='utf-8')

for disposable in (workflow_path, script_path):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
