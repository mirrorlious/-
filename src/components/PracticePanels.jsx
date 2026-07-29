import React, { useEffect, useMemo, useState } from 'react';
import { normalizeQuizQuestions } from '../services/ai.js';

const SingleQuizPractice = ({ quizData }) => {
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const quiz = quizData || {};
    const options = Array.isArray(quiz.options) ? quiz.options : [];
    const submit = () => {
        if (!selectedAnswer) {
            window.showToast('请先选择一个答案', 'warning');
            return;
        }
        setSubmitted(true);
    };
    return (
        <div className="space-y-4" data-reader-single-practice="true">
            <div>
                <p className="font-serif font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{quiz.questionEn}</p>
                {submitted && quiz.questionZh && <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{quiz.questionZh}</p>}
            </div>
            <div className="space-y-2">
                {options.map(option => {
                    const isSelected = selectedAnswer === option.id;
                    const isCorrect = submitted && option.id === quiz.correctAnswerId;
                    const isWrong = submitted && isSelected && option.id !== quiz.correctAnswerId;
                    const className = isCorrect
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : isWrong
                            ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20'
                            : isSelected
                                ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
                                : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 hover:border-sky-300';
                    return (
                        <button key={option.id} type="button" disabled={submitted} onClick={() => setSelectedAnswer(option.id)} className={`w-full p-3 border rounded-sm text-left transition-colors ${className}`}>
                            <div className="font-medium">{option.id}. {option.textEn}</div>
                            {submitted && option.textZh && <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{option.textZh}</div>}
                        </button>
                    );
                })}
            </div>
            {!submitted ? (
                <button type="button" onClick={submit} className="min-h-[38px] px-4 rounded-sm bg-sky-700 text-white hover:bg-sky-800">提交答案</button>
            ) : (
                <div className="space-y-3">
                    <div className={`font-semibold ${selectedAnswer === quiz.correctAnswerId ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedAnswer === quiz.correctAnswerId ? '回答正确' : `回答错误，正确答案：${quiz.correctAnswerId || '-'}`}
                    </div>
                    {quiz.analysis && <div className="p-3 bg-violet-50 dark:bg-violet-900/15 border-l-2 border-violet-400 leading-relaxed"><span className="font-semibold">解析：</span>{quiz.analysis}</div>}
                    <button type="button" onClick={() => { setSelectedAnswer(''); setSubmitted(false); }} className="min-h-[34px] px-3 border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-800">重新作答</button>
                </div>
            )}
        </div>
    );
};

const QuizSetPractice = ({ quizData }) => {
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

const SyntaxBreakdowns = ({ data }) => {
    if (!data || !data.hasComplexSentence || !data.complexSentences || data.complexSentences.length === 0) return null;
    const typeColorMap = { "主干": "bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800", "非谓语动词": "bg-blue-100/70 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800", "介词短语": "bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800", "从句": "bg-rose-100/70 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800", "其他": "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600" };
    const dotColorMap = { "主干": "bg-amber-400", "非谓语动词": "bg-blue-400", "介词短语": "bg-emerald-400", "从句": "bg-rose-400" };

    return (
        <div className="space-y-6 mt-6">
            {data.complexSentences.map((sentenceObj, sIdx) => {
                const { chunks, sentenceTranslation, writingTip, aiExample, realExamMatch, originalSentence } = sentenceObj;
                return (
                    <div key={sIdx} className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden animate-fade-in-down">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-3">核心难句解构 #{sIdx + 1}</h4>

                        {originalSentence && (
                            <div className="bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-amber-400 dark:border-amber-600 pl-4 py-2 mb-5 rounded-r-lg">
                                <p className="text-[14px] text-amber-900 dark:text-amber-200 font-serif leading-relaxed">{originalSentence}</p>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-4 mb-5 border-b border-gray-100 dark:border-gray-700 pb-3">
                            {['主干', '非谓语动词', '介词短语', '从句'].map(type => (
                                <div key={type} className="flex items-center space-x-1.5"><span className={`w-2 h-2 rounded-full ${dotColorMap[type]}`}></span><span className="text-[11.5px] font-medium text-gray-500 dark:text-gray-400">{type}</span></div>
                            ))}
                        </div>
                        <div className="leading-[2.8] text-[1.05rem] font-serif text-gray-900 dark:text-gray-200 mb-5">
                            {chunks?.map((chunk, idx) => chunk.text.trim() ? <span key={idx} className="mr-1.5 mb-2 inline-block"><span className={`px-2.5 py-1 rounded-md border ${typeColorMap[chunk.type] || typeColorMap["其他"]}`}>{chunk.text.trim()}</span></span> : null)}
                        </div>
                        <div className="text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed mb-6 text-justify border-l-2 border-gray-300 dark:border-gray-600 pl-3">{sentenceTranslation}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl flex flex-col justify-between">
                                <div><div className="flex items-center space-x-2 mb-3"><span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">🤖 AI 模拟例句</span></div><p className="text-[13.5px] font-serif text-blue-900 dark:text-blue-300 mb-2 leading-relaxed">"{aiExample?.sentence}"</p></div>
                                <p className="text-[12px] text-blue-700 dark:text-blue-400 leading-relaxed border-t border-blue-100 dark:border-blue-900/50 pt-2">{aiExample?.translation}</p>
                            </div>
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/50 p-4 rounded-xl flex flex-col justify-between">
                                <div><div className="flex items-center justify-between mb-3"><span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">🏛️ 真题原句追踪</span>{realExamMatch?.source && <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold border-b border-emerald-300 dark:border-emerald-700">{realExamMatch.source}</span>}</div><p className="text-[13.5px] font-serif text-emerald-900 dark:text-emerald-300 mb-2 leading-relaxed">"{realExamMatch?.sentence}"</p></div>
                                <p className="text-[12px] text-emerald-700 dark:text-emerald-400 leading-relaxed border-t border-emerald-100 dark:border-emerald-900/50 pt-2">{realExamMatch?.translation}</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 dark:bg-gray-900 p-4 rounded-xl border border-amber-200 dark:border-gray-700">
                            <div className="flex items-center space-x-2 mb-2"><svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span className="text-[13px] font-bold text-amber-400 tracking-wider">写作提炼法则</span></div>
                            <div className="text-[13px] text-slate-700 dark:text-gray-300 leading-relaxed text-justify">{writingTip}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export {
  SingleQuizPractice,
  QuizSetPractice,
  SyntaxBreakdowns
};

