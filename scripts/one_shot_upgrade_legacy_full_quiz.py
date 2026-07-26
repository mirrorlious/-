from pathlib import Path

index_path = Path('index.html')
log_path = Path('TASK_LOGS/2026-07-28-0030-restore-syntax-inline-full-quiz.md')
workflow_path = Path('.github/workflows/upgrade_legacy_full_quiz_once.yml')
script_path = Path('scripts/one_shot_upgrade_legacy_full_quiz.py')

text = index_path.read_text(encoding='utf-8')

old_cached = '''                if (fullQuizData) {
                    setRightPanelAnalysis({ kind: 'document-quiz', title: '全文练习', data: fullQuizData, createdAt: Date.now() });
                    return fullQuizData;
                }
'''
new_cached = '''                if (normalizeQuizQuestions(fullQuizData).length >= 3) {
                    setRightPanelAnalysis({ kind: 'document-quiz', title: '全文练习', data: fullQuizData, createdAt: Date.now() });
                    return fullQuizData;
                }
'''
if text.count(old_cached) != 1:
    raise SystemExit(f'Full quiz cache anchor count: {text.count(old_cached)}')
text = text.replace(old_cached, new_cached, 1)

old_batch = '''                                    if (bundle.results.fullQuizData) job.skippedModules += 1;
                                    else bundle.results.fullQuizData = await callGeminiFullQuiz(getModelSafeText(sourceText, 18000, '批量全文练习'), apiConfig);
'''
new_batch = '''                                    if (normalizeQuizQuestions(bundle.results.fullQuizData).length >= 3) job.skippedModules += 1;
                                    else bundle.results.fullQuizData = await callGeminiFullQuiz(getModelSafeText(sourceText, 18000, '批量全文练习'), apiConfig);
'''
if text.count(old_batch) != 1:
    raise SystemExit(f'Batch quiz cache anchor count: {text.count(old_batch)}')
text = text.replace(old_batch, new_batch, 1)

old_menu = '''<span className="text-[10px] text-gray-400">{isFullQuizLoading ? '生成中' : fullQuizData ? '已有结果' : '调用模型'}</span>'''
new_menu = '''<span className="text-[10px] text-gray-400">{isFullQuizLoading ? '生成中' : normalizeQuizQuestions(fullQuizData).length >= 3 ? '已有3题' : fullQuizData ? '升级为3题' : '调用模型'}</span>'''
if text.count(old_menu) != 1:
    raise SystemExit(f'Full quiz menu anchor count: {text.count(old_menu)}')
text = text.replace(old_menu, new_menu, 1)

required = [
    'normalizeQuizQuestions(fullQuizData).length >= 3',
    'normalizeQuizQuestions(bundle.results.fullQuizData).length >= 3',
    "fullQuizData ? '升级为3题'"
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing upgrade markers: {missing}')

index_path.write_text(text, encoding='utf-8')

log = log_path.read_text(encoding='utf-8')
insert = '- 旧版单题全文练习不会被误判为完整缓存：再次打开或批量处理时会自动升级为3题；菜单显示“升级为3题”。\n'
marker = '- Markdown练习导出同时兼容单题与三题数据。\n'
if insert not in log:
    log = log.replace(marker, marker + insert, 1)
log_path.write_text(log, encoding='utf-8')

for disposable in (workflow_path, script_path):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
