from pathlib import Path

index_path = Path('index.html')
log_path = Path('TASK_LOGS/2026-07-28-0030-restore-syntax-inline-full-quiz.md')
workflow_path = Path('.github/workflows/restore_syntax_full_quiz_once.yml')
script_path = Path('scripts/one_shot_restore_syntax_full_quiz.py')

text = index_path.read_text(encoding='utf-8')

# 1. Add a dedicated three-question full-text quiz generator while keeping paragraph quiz single-question.
quiz_anchor = '''        const callGeminiSummary = async (fullText, apiConfig) => {
'''
full_quiz_code = '''        const normalizeQuizQuestions = (quizData) => {
            if (!quizData) return [];
            if (Array.isArray(quizData)) return quizData.filter(Boolean);
            if (Array.isArray(quizData.questions)) return quizData.questions.filter(Boolean);
            if (quizData.questionEn || quizData.options) return [quizData];
            return [];
        };

        const callGeminiFullQuiz = async (text, apiConfig) => {
            const prompt = `你是一名考研英语阅读命题专家。请根据以下完整文章生成恰好3道单项选择题。
题目要求：
1. 第1题考查全文主旨或作者观点。
2. 第2题考查重要细节、推断或逻辑关系。
3. 第3题考查语境词义、作者态度或写作目的。
4. 每题必须有A-D四个英文选项，干扰项要符合考研命题方式。
5. questionZh、选项中文和analysis用于用户提交答案后显示，不能在题干中泄露答案。
6. 三题答案不应全部相同。

文章：\n"${text}"

只输出纯JSON，结构必须为：
{
  "questions": [
    {
      "id": "Q1",
      "questionEn": "...",
      "questionZh": "...",
      "options": [
        {"id": "A", "textEn": "...", "textZh": "..."},
        {"id": "B", "textEn": "...", "textZh": "..."},
        {"id": "C", "textEn": "...", "textZh": "..."},
        {"id": "D", "textEn": "...", "textZh": "..."}
      ],
      "correctAnswerId": "A",
      "analysis": "..."
    }
  ]
}`;
            const result = await callLLM(prompt, apiConfig, true);
            const questions = normalizeQuizQuestions(result).slice(0, 3);
            if (questions.length !== 3) throw new Error(`全文练习应返回3题，实际返回${questions.length}题`);
            return { questions };
        };

'''
if text.count(quiz_anchor) != 1:
    raise SystemExit(f'Full quiz insertion anchor count: {text.count(quiz_anchor)}')
text = text.replace(quiz_anchor, full_quiz_code + quiz_anchor, 1)

# 2. Add an interactive quiz set component: answers and explanations remain hidden until submission.
syntax_anchor = '''        const SyntaxBreakdowns = ({ data }) => {
'''
quiz_component = '''        const QuizSetPractice = ({ quizData }) => {
            const questions = useMemo(() => normalizeQuizQuestions(quizData), [quizData]);
            const [answers, setAnswers] = useState({});
            const [submitted, setSubmitted] = useState(false);

            useEffect(() => {
                setAnswers({});
                setSubmitted(false);
            }, [quizData]);

            if (!questions.length) return <p className="text-gray-400">暂无练习题。</p>;
            const answeredCount = questions.filter((question, index) => answers[question.id || String(index)]).length;
            const score = submitted ? questions.reduce((total, question, index) => total + (answers[question.id || String(index)] === question.correctAnswerId ? 1 : 0), 0) : 0;

            const submitAnswers = () => {
                if (answeredCount < questions.length) {
                    window.showToast(`请先完成全部 ${questions.length} 道题`, 'warning');
                    return;
                }
                setSubmitted(true);
            };

            return (
                <div className="space-y-5" data-reader-full-quiz-practice="true">
                    <div className="flex items-center justify-between gap-3 p-3 border border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-900/10">
                        <div><div className="text-[12px] font-semibold text-violet-700 dark:text-violet-300">全文阅读练习 · {questions.length} 题</div><div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">提交前不会显示正确答案和解析。</div></div>
                        <div className="text-[11px] text-gray-500">{submitted ? `得分 ${score}/${questions.length}` : `已答 ${answeredCount}/${questions.length}`}</div>
                    </div>
                    {questions.map((question, index) => {
                        const questionKey = question.id || String(index);
                        const selected = answers[questionKey] || '';
                        const isCorrect = selected === question.correctAnswerId;
                        return (
                            <section key={questionKey} className="p-4 border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 rounded-sm">
                                <div className="flex items-start gap-2"><span className="mt-0.5 w-6 h-6 shrink-0 grid place-items-center bg-slate-100 dark:bg-gray-800 text-[11px] font-semibold">{index + 1}</span><div className="min-w-0"><p className="font-serif font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{question.questionEn}</p>{question.questionZh && <p className="mt-1 text-[11px] text-gray-400">{question.questionZh}</p>}</div></div>
                                <div className="mt-4 space-y-2">
                                    {(question.options || []).map(option => {
                                        let optionClass = 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-violet-300 dark:hover:border-violet-600';
                                        if (submitted) {
                                            if (option.id === question.correctAnswerId) optionClass = 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200';
                                            else if (selected === option.id) optionClass = 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300';
                                            else optionClass = 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400';
                                        } else if (selected === option.id) {
                                            optionClass = 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-900 dark:text-violet-200';
                                        }
                                        return (
                                            <button key={option.id} type="button" disabled={submitted} onClick={() => setAnswers(previous => ({ ...previous, [questionKey]: option.id }))} className={`w-full p-3 border rounded-sm text-left transition-colors ${optionClass}`}>
                                                <span className="font-serif text-[13px] font-medium">{option.id}. {option.textEn}</span>
                                                {submitted && option.textZh && <span className="block mt-1 text-[11px] opacity-80">{option.textZh}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {submitted && (
                                    <div className={`mt-4 p-3 border-l-2 ${isCorrect ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/15' : 'border-red-400 bg-red-50/60 dark:bg-red-900/15'}`}>
                                        <div className={`text-[12px] font-semibold ${isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{isCorrect ? '回答正确' : `回答错误 · 正确答案 ${question.correctAnswerId}`}</div>
                                        {question.analysis && <p className="mt-2 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300"><span className="font-semibold text-violet-700 dark:text-violet-300">解析：</span>{question.analysis}</p>}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                    <div className="flex justify-end gap-2">
                        {submitted ? <button type="button" onClick={() => { setAnswers({}); setSubmitted(false); }} className="min-h-[38px] px-4 border border-gray-200 dark:border-gray-700 rounded-sm text-[12px] hover:bg-gray-50 dark:hover:bg-gray-800">重新作答</button> : <button type="button" onClick={submitAnswers} className="min-h-[38px] px-5 bg-violet-600 text-white rounded-sm text-[12px] font-medium hover:bg-violet-500">提交答案</button>}
                    </div>
                </div>
            );
        };

'''
if text.count(syntax_anchor) != 1:
    raise SystemExit(f'Quiz component anchor count: {text.count(syntax_anchor)}')
text = text.replace(syntax_anchor, quiz_component + syntax_anchor, 1)

# 3. Paragraph details are inline only when the learning sidebar is not actively visible.
old_signature = '''        const Paragraph = ({ text, paragraphIndex, annotations = [], activeAnnotationId, activeDicts, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, savedResults = null, onPersistParagraphResult, onOpenAnalysis, onRequestAnnotation, onFocusAnnotation }) => {
'''
new_signature = '''        const Paragraph = ({ text, paragraphIndex, annotations = [], activeAnnotationId, activeDicts, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, savedResults = null, inlineResultsEnabled = true, onPersistParagraphResult, onOpenAnalysis, onRequestAnnotation, onFocusAnnotation }) => {
'''
if text.count(old_signature) != 1:
    raise SystemExit(f'Paragraph signature count: {text.count(old_signature)}')
text = text.replace(old_signature, new_signature, 1)

inline_replacements = {
    '''                    {showTranslation && finalTranslationToShow && <div className="mt-4 text-gray-800 dark:text-gray-300 animate-fade-in-down whitespace-pre-wrap border-l-[3px] border-gray-300 dark:border-gray-600 pl-4 py-1 bg-gray-50/50 dark:bg-gray-800/50 rounded-r-lg" style={{ fontFamily: typographyConfig.chineseFontFamily || '"Noto Serif SC", STSong, serif', fontSize: `${Math.max(14, typographyConfig.fontSize - 2)}px`, lineHeight: typographyConfig.lineHeight }}>{finalTranslationToShow}</div>}
''': '''                    {inlineResultsEnabled && showTranslation && finalTranslationToShow && <div className="mt-4 text-gray-800 dark:text-gray-300 animate-fade-in-down whitespace-pre-wrap border-l-[3px] border-gray-300 dark:border-gray-600 pl-4 py-1 bg-gray-50/50 dark:bg-gray-800/50 rounded-r-lg" style={{ fontFamily: typographyConfig.chineseFontFamily || '"Noto Serif SC", STSong, serif', fontSize: `${Math.max(14, typographyConfig.fontSize - 2)}px`, lineHeight: typographyConfig.lineHeight }}>{finalTranslationToShow}</div>}
''',
    '''                    {showAnalysis && analysisData && <SyntaxBreakdowns data={analysisData} />}
''': '''                    {inlineResultsEnabled && showAnalysis && analysisData && <SyntaxBreakdowns data={analysisData} />}
''',
    '''                    {showQuiz && quizData && (
''': '''                    {inlineResultsEnabled && showQuiz && quizData && (
'''
}
for old, new in inline_replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f'Inline result anchor count: {text.count(old)} for {old[:50]}')
    text = text.replace(old, new, 1)

# 4. Route paragraph details to the sidebar only while split sidebar is actually visible.
old_props = '''                                                savedResults={paragraphResults[String(idx)] || null}
                                                onPersistParagraphResult={handlePersistParagraphResult}
                                                onOpenAnalysis={(result) => { setRightPanelAnalysis(result); setRightPanelTab('analysis'); setLayoutMode('split'); setRightPanelOpen(true); }}
'''
new_props = '''                                                savedResults={paragraphResults[String(idx)] || null}
                                                inlineResultsEnabled={!(layoutMode === 'split' && rightPanelOpen)}
                                                onPersistParagraphResult={handlePersistParagraphResult}
                                                onOpenAnalysis={(result) => {
                                                    if (layoutMode === 'split' && rightPanelOpen) {
                                                        setRightPanelAnalysis(result);
                                                        setRightPanelTab('analysis');
                                                    }
                                                }}
'''
if text.count(old_props) != 1:
    raise SystemExit(f'Paragraph routing anchor count: {text.count(old_props)}')
text = text.replace(old_props, new_props, 1)

# 5. Restore the complete old syntax presentation in the right learning panel.
analysis_start = text.index("                } else if (result.kind === 'paragraph-analysis') {")
analysis_end = text.index("                } else if (result.kind === 'paragraph-quiz') {", analysis_start)
analysis_block = '''                } else if (result.kind === 'paragraph-analysis') {
                    content = result.data?.complexSentences?.length ? <SyntaxBreakdowns data={result.data} /> : <p className="text-gray-400">当前段落未识别到复杂句。</p>;
'''
text = text[:analysis_start] + analysis_block + text[analysis_end:]

# 6. Make the full-text quiz interactive and hide answers until submission.
doc_quiz_start = text.index("                } else if (result.kind === 'document-quiz') {")
doc_quiz_end = text.index("                }\n\n                return (", doc_quiz_start)
doc_quiz_block = '''                } else if (result.kind === 'document-quiz') {
                    content = <QuizSetPractice quizData={result.data} />;
'''
text = text[:doc_quiz_start] + doc_quiz_block + text[doc_quiz_end:]

# 7. Generate three questions for current and batch full-text quiz actions.
current_full_quiz_old = "const data = await callGeminiQuiz(getModelSafeText(inputText || defaultText, 10000, '全文练习'), apiConfig);"
current_full_quiz_new = "const data = await callGeminiFullQuiz(getModelSafeText(inputText || defaultText, 18000, '全文练习'), apiConfig);"
if text.count(current_full_quiz_old) != 1:
    raise SystemExit(f'Current full quiz call count: {text.count(current_full_quiz_old)}')
text = text.replace(current_full_quiz_old, current_full_quiz_new, 1)

batch_full_quiz_old = "else bundle.results.fullQuizData = await callGeminiQuiz(getModelSafeText(sourceText, 10000, '批量全文练习'), apiConfig);"
batch_full_quiz_new = "else bundle.results.fullQuizData = await callGeminiFullQuiz(getModelSafeText(sourceText, 18000, '批量全文练习'), apiConfig);"
if text.count(batch_full_quiz_old) != 1:
    raise SystemExit(f'Batch full quiz call count: {text.count(batch_full_quiz_old)}')
text = text.replace(batch_full_quiz_old, batch_full_quiz_new, 1)

# 8. Markdown export supports both old single-question data and new three-question sets.
quiz_md_start = text.index("        const quizToMarkdown = (quiz, heading = '练习题') => {")
quiz_md_end = text.index("\n\n        const paragraphResultsToMarkdown", quiz_md_start)
quiz_md_function = '''        const quizToMarkdown = (quizData, heading = '练习题') => {
            const questions = normalizeQuizQuestions(quizData);
            if (!questions.length) return '';
            return questions.map((quiz, index) => {
                const options = Array.isArray(quiz.options) ? quiz.options.map(option => `- ${option.id || ''}. ${option.textEn || ''}${option.textZh ? ` / ${option.textZh}` : ''}`).join('\\n') : '';
                return [
                    `### ${heading}${questions.length > 1 ? ` ${index + 1}` : ''}`,
                    quiz.questionEn || '',
                    quiz.questionZh || '',
                    options,
                    quiz.correctAnswerId ? `**答案：${quiz.correctAnswerId}**` : '',
                    quiz.analysis ? `**解析：** ${quiz.analysis}` : ''
                ].filter(Boolean).join('\\n\\n');
            }).join('\\n\\n');
        };'''
text = text[:quiz_md_start] + quiz_md_function + text[quiz_md_end:]

required = [
    'const callGeminiFullQuiz = async',
    'const QuizSetPractice = ({ quizData }) =>',
    'data-reader-full-quiz-practice="true"',
    'inlineResultsEnabled={!(layoutMode === \'split\' && rightPanelOpen)}',
    'content = result.data?.complexSentences?.length ? <SyntaxBreakdowns data={result.data} />',
    "content = <QuizSetPractice quizData={result.data} />;",
    'callGeminiFullQuiz(getModelSafeText(inputText || defaultText, 18000',
    'callGeminiFullQuiz(getModelSafeText(sourceText, 18000',
    '请先完成全部 ${questions.length} 道题',
    '提交前不会显示正确答案和解析。'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing required markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

index_path.write_text(text, encoding='utf-8')

log = log_path.read_text(encoding='utf-8')
log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
log = log.replace('## 5. 实际修改\n\n开发中。', '''## 5. 实际修改

- 右侧段落长难句结果恢复使用完整 `SyntaxBreakdowns` 组件，重新显示四色句子成分、句子翻译、AI模拟例句、真题原句来源及写作提炼法则。
- `Paragraph` 新增 `inlineResultsEnabled`：分栏学习侧栏开启时，翻译/解析/段落练习进入右侧；侧栏关闭或非分栏模式时，结果在原段落下按旧版方式展开。
- 关闭学习侧栏不会丢失当前段落的展开状态，已有结果会立即回到正文下方。
- 新增 `callGeminiFullQuiz`，全文及批量全文练习固定生成3题；段落练习仍保持1题。
- 新增 `QuizSetPractice`：用户必须先选择三题答案并提交，提交前不显示正确答案、选项翻译或解析；提交后显示得分和逐题反馈，并可重新作答。
- 旧缓存的一道题会自动归一化为单题练习，仍可正常作答。
- Markdown练习导出同时兼容单题与三题数据。''')
log = log.replace('## 6. 测试\n\n待执行。', '''## 6. 测试

- 精确源码锚点替换：通过。
- 完整长难句组件复用标记：通过。
- 侧栏/内联结果路由标记：通过。
- 三题全文练习与提交后揭示答案标记：通过。
- 当前文章和批量队列全文练习调用检查：通过。
- Markdown单题/多题兼容检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX解析：由一次性工作流执行。
- 浏览器真实交互：等待用户本地验收。''')
log_path.write_text(log, encoding='utf-8')

for disposable in (workflow_path, script_path):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
