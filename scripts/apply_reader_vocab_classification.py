from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8-sig')


def sub_once(pattern, replacement, label, flags=0):
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')


sub_once(
    r'(?m)^\s*const PRESET_DICT_URL = .*?;\n\s*const HARD_DICT_URL = .*?;\n',
    '''        const VOCAB_RESOURCE_BASE = "./public-resources/kaoyan-english-2027-vocabulary";
        const BASIC_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【基础词】qy自制.json`;
        const REQUIRED_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【必考词】qy自制.json`;
        const EXTRA_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【超纲词】qy自制.json`;

        // 历史词库仅保留来源记录，不再参与“基础词 / 必考词 / 超纲词”分级。
        const LEGACY_PRESET_DICT_GIST_URL = "https://gist.github.com/mirrorlious97/e39459d2885f9eb78257d4524e18df6f";
        const LEGACY_HARD_DICT_GIST_URL = "https://gist.github.com/mirrorlious97/9e36522b809b300f316fc5899bbb448f";
''',
    'vocabulary URL block'
)

if 'const parseVocabularyPack = (items) =>' not in text:
    marker = '        const fetchAndParseCorpus = async (setCorpusCount) => {'
    if marker not in text:
        raise SystemExit('corpus loader marker not found')
    insertion = '''        const parseVocabularyPack = (items) => {
            const dict = {};
            if (!Array.isArray(items)) return dict;

            items.forEach(item => {
                const words = Array.isArray(item?.en) ? item.en : [];
                words.forEach(rawWord => {
                    const key = String(rawWord || '').trim().toLowerCase();
                    if (!key) return;
                    dict[key] = {
                        translation: String(item?.zh || '').trim(),
                        category: String(item?.category || '').trim(),
                        memo: String(item?.memo || '').trim()
                    };
                });
            });
            return dict;
        };

        const fetchVocabularyPack = async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch vocabulary pack: ${response.status}`);
            return parseVocabularyPack(await response.json());
        };

'''
    text = text.replace(marker, insertion + marker, 1)

sub_once(
    r"\s*const check = \(word\) => data\[word\] \? \{ translation: data\[word\], type, word \} : null;",
    '''
                const check = (word) => {
                    const entry = data[word];
                    if (!entry) return null;
                    if (typeof entry === 'string') return { translation: entry, type, word };
                    return {
                        translation: entry.translation || entry.zh || '',
                        category: entry.category || '',
                        memo: entry.memo || '',
                        note: entry.memo || '',
                        type,
                        word
                    };
                };''',
    'lemma dictionary entry parser'
)

start_marker = '        const WordHighlighter = ({ text, activeDicts, highlightMode, onWordClick }) => {'
end_marker = '        const SingleQuizPractice = ({ quizData }) => {'
start = text.find(start_marker)
end = text.find(end_marker, start + 1)
if start < 0 or end < 0:
    raise SystemExit('word highlighter markers not found')

new_highlighter = '''        const VOCAB_TYPE_META = {
            basic: {
                label: '基础词',
                underline: 'decoration-green-600 dark:decoration-green-400',
                badge: 'bg-green-600 dark:bg-green-700',
                text: 'text-green-700 dark:text-green-400'
            },
            required: {
                label: '必考词',
                underline: 'decoration-sky-600 dark:decoration-sky-400',
                badge: 'bg-sky-600 dark:bg-sky-700',
                text: 'text-sky-700 dark:text-sky-300'
            },
            extra: {
                label: '超纲词',
                underline: 'decoration-red-600 dark:decoration-red-400',
                badge: 'bg-red-600 dark:bg-red-700',
                text: 'text-red-700 dark:text-red-400'
            },
            custom: {
                label: '个人词库',
                underline: 'decoration-amber-500 dark:decoration-amber-400 decoration-dotted',
                badge: 'bg-amber-600 dark:bg-amber-700',
                text: 'text-amber-700 dark:text-amber-400'
            },
            phrase: {
                label: '语法与佳句',
                underline: 'decoration-violet-500 dark:decoration-violet-400 decoration-dashed',
                badge: 'bg-violet-600 dark:bg-violet-700',
                text: 'text-violet-700 dark:text-violet-300'
            }
        };

        const shouldShowVocabType = (type, highlightMode) => {
            if (highlightMode === 'none') return false;
            if (highlightMode === 'all') return true;
            if (highlightMode === 'exam') return type === 'required' || type === 'extra';
            return highlightMode === type;
        };

        const WordHighlighter = ({ text, activeDicts, highlightMode, onWordClick }) => {
            const parts = text.split(/([a-zA-Z]+-?[a-zA-Z]*)/g);
            return (
                <Fragment>
                    {parts.map((part, index) => {
                        const match = getLemmaMatches(part, activeDicts);
                        if (match && part.trim().length > 0 && shouldShowVocabType(match.type, highlightMode)) {
                            const { translation, type, word: lemma, category, memo } = match;
                            const meta = VOCAB_TYPE_META[type] || VOCAB_TYPE_META.custom;
                            return (
                                <span
                                    key={index}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onWordClick({ word: part, lemma, translation, type, category, memo, note: memo });
                                    }}
                                    className={`mx-[1px] cursor-pointer underline decoration-2 underline-offset-[3px] decoration-skip-ink-auto transition-[text-decoration-thickness,opacity] hover:decoration-[3px] hover:opacity-80 ${meta.underline}`}
                                >
                                    {part}
                                </span>
                            );
                        }
                        return <span key={index} className="transition-all">{part}</span>;
                    })}
                </Fragment>
            );
        };

'''
text = text[:start] + new_highlighter + text[end:]

sub_once(
    r'''for \(const dict of activeDicts\) \{\s*if \(dict\.data && dict\.data\[lowerChunk\]\) \{\s*phraseData = \{ trans: dict\.data\[lowerChunk\], type: dict\.type \};\s*break;\s*\}\s*\}''',
    '''for (const dict of activeDicts) {
                            const entry = dict.data?.[lowerChunk];
                            if (entry) {
                                phraseData = typeof entry === 'string'
                                    ? { trans: entry, type: dict.type }
                                    : {
                                        trans: entry.translation || entry.zh || '',
                                        note: entry.memo || '',
                                        category: entry.category || '',
                                        type: dict.type
                                    };
                                break;
                            }
                        }''',
    'phrase dictionary lookup',
    re.S
)

sub_once(
    r'''\s*if \(phraseData && lowerChunk\.includes\(' '\) && highlightMode !== 'none'\) \{.*?\n\s*\}\n\s*return <WordHighlighter''',
    '''
                    if (phraseData && lowerChunk.includes(' ')) {
                        const phraseType = phraseData.type || 'phrase';
                        if (!shouldShowVocabType(phraseType, highlightMode)) return <span key={index}>{chunk}</span>;

                        const isActive = activeNote && activeNote.word === chunk && activeNote.isPhrase;
                        const meta = VOCAB_TYPE_META[phraseType] || VOCAB_TYPE_META.phrase;
                        return (
                            <span
                                key={index}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveNote({
                                        word: chunk,
                                        isPhrase: true,
                                        trans: phraseData.trans || phraseData.translation,
                                        note: phraseData.note,
                                        category: phraseData.category,
                                        type: phraseType
                                    });
                                }}
                                className={`cursor-pointer mx-0.5 underline decoration-2 underline-offset-[3px] decoration-skip-ink-auto transition-[text-decoration-thickness,opacity] hover:decoration-[3px] hover:opacity-80 ${meta.underline} ${isActive ? 'decoration-[3px]' : ''}`}
                            >
                                {chunk}
                            </span>
                        );
                    }
                    return <WordHighlighter''',
    'phrase highlighter block',
    re.S
)

sub_once(
    r'''<span className=\{`text-white text-\[10px\].*?activeNote\.type === 'hard'.*?</span>\s*<span className=\{`font-serif font-bold text-\[15px\].*?activeNote\.type === 'hard'.*?</span>''',
    '''<span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wider ${(VOCAB_TYPE_META[activeNote.type] || VOCAB_TYPE_META.custom).badge}`}>{activeNote.isPhrase ? "语法与佳句" : (VOCAB_TYPE_META[activeNote.type] || VOCAB_TYPE_META.custom).label}</span>
                                <span className={`font-serif font-bold text-[15px] ${(VOCAB_TYPE_META[activeNote.type] || VOCAB_TYPE_META.custom).text}`}>{activeNote.word}</span>''',
    'active word card labels',
    re.S
)

category_marker = '                            <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap">{activeNote.translation || activeNote.trans}</div>'
if category_marker not in text:
    raise SystemExit('active word translation marker not found')
text = text.replace(
    category_marker,
    category_marker + '\n                            {activeNote.category && <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">{activeNote.category}</div>}',
    1
)

sub_once(
    r"const \[highlightMode, setHighlightMode\] = useState\('red'\);",
    "const [highlightMode, setHighlightMode] = useState('exam');",
    'default highlight mode'
)

sub_once(
    r'''const \[presetDict, setPresetDict\] = useState\(\{\}\);\s*const \[hardDict, setHardDict\] = useState\(\{\}\);''',
    '''const [basicDict, setBasicDict] = useState({});
            const [requiredDict, setRequiredDict] = useState({});
            const [extraDict, setExtraDict] = useState({});''',
    'dictionary state block',
    re.S
)

sub_once(
    r'''const activeDicts = useMemo\(\(\) => \[\s*\{ data: hardDict, type: 'hard' \},\s*\{ data: customDict, type: 'custom' \},\s*\{ data: presetDict, type: 'preset' \},\s*\{ data: VOCAB_DB\.kaoyan, type: 'default' \},\s*\{ data: VOCAB_DB\.cet6, type: 'default' \}\s*\], \[hardDict, customDict, presetDict\]\);''',
    '''const activeDicts = useMemo(() => [
                { data: extraDict, type: 'extra' },
                { data: requiredDict, type: 'required' },
                { data: basicDict, type: 'basic' },
                { data: customDict, type: 'custom' }
            ], [extraDict, requiredDict, basicDict, customDict]);''',
    'active dictionary priority',
    re.S
)

sub_once(
    r'''useEffect\(\(\) => \{\s*fetchAndParseCorpus\(setCorpusCount\);\s*fetch\(PRESET_DICT_URL\).*?setPresetDict.*?;\s*fetch\(HARD_DICT_URL\).*?setHardDict.*?;\s*\}, \[\]\);''',
    '''useEffect(() => {
                fetchAndParseCorpus(setCorpusCount);
                Promise.all([
                    fetchVocabularyPack(BASIC_DICT_URL),
                    fetchVocabularyPack(REQUIRED_DICT_URL),
                    fetchVocabularyPack(EXTRA_DICT_URL)
                ]).then(([basic, required, extra]) => {
                    setBasicDict(basic);
                    setRequiredDict(required);
                    setExtraDict(extra);
                }).catch(error => {
                    console.error('Error loading classified vocabulary packs:', error);
                    window.showToast('分级词库加载失败，请刷新后重试', 'error');
                });
            }, []);''',
    'classified vocabulary loader',
    re.S
)

sub_once(
    r'''<option value="red">考研生词</option>\s*<option value="both">全部词汇</option>\s*<option value="blue">基础词汇</option>\s*<option value="none">关闭高亮</option>''',
    '''<option value="exam">必考＋超纲</option>
                                                <option value="all">全部词汇</option>
                                                <option value="basic">基础词</option>
                                                <option value="required">必考词</option>
                                                <option value="extra">超纲词</option>
                                                <option value="none">关闭标注</option>''',
    'highlight filter options',
    re.S
)

for forbidden in (
    'bg-red-100/80 dark:bg-red-900/40',
    'bg-sky-100/80 dark:bg-sky-900/40',
    "type === 'hard'",
    "type: 'hard'",
    'PRESET_DICT_URL',
    'HARD_DICT_URL'
):
    if forbidden in text:
        raise SystemExit(f'legacy marker remains: {forbidden}')

path.write_text(text, encoding='utf-8')
print('Reader vocabulary classification patch applied successfully.')
