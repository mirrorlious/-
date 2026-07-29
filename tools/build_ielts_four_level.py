from __future__ import annotations

import base64
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ROOT / "tools/ielts-vocabulary-4-level.payload.b64"
INDEX = ROOT / "index.html"
OUTPUT_DIR = ROOT / "public-resources/ielts-vocabulary"
OUTPUT_JSON = OUTPUT_DIR / "ielts-vocabulary-4-level.json"
OUTPUT_REPORT = OUTPUT_DIR / "README.md"
REDBOOK_DIR = ROOT / "public-resources/kaoyan-english-2027-vocabulary"
REDBOOK_PACKS = [
    ("考研基础词", REDBOOK_DIR / "考研英语红宝书词汇27新版【基础词】qy自制.json"),
    ("考研必考词", REDBOOK_DIR / "考研英语红宝书词汇27新版【必考词】qy自制.json"),
    ("考研超纲词", REDBOOK_DIR / "考研英语红宝书词汇27新版【超纲词】qy自制.json"),
]

LEVEL_META = {
    "core": ("优先学习", "雅思阅读、听力、写作或口语价值明显，建议优先掌握。"),
    "scenario": ("正常学习", "住宿、旅游、课程、图书馆、交通或工作咨询等雅思听力场景常见。"),
    "overlap": ("可选择跳过", "与考研红宝书词汇重合，但仍具有雅思理解或表达价值。"),
    "extended": ("后期学习", "词义较专业、使用频率较低或证据较弱，适合后期扩展。"),
}
RAW_LEVELS = {"c": "core", "s": "scenario", "b": "base", "e": "extended"}
QUALITY = {"v": "verified", "r": "review", "c": "corrected"}


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def load_redbook(path: Path) -> dict[str, dict[str, str]]:
    items = json.loads(path.read_text(encoding="utf-8-sig"))
    result: dict[str, dict[str, str]] = {}
    for item in items:
        for raw_word in item.get("en") or []:
            word = normalize(raw_word)
            if word:
                result[word] = {
                    "translation": str(item.get("zh") or "").strip(),
                    "category": str(item.get("category") or "").strip(),
                }
    return result


def decode_payload() -> dict[str, list[str]]:
    text = PAYLOAD.read_text(encoding="utf-8").strip()
    text += "=" * (-len(text) % 4)
    data = json.loads(gzip.decompress(base64.b64decode(text)).decode("utf-8"))
    if len(data) != 1992:
        raise RuntimeError(f"IELTS payload count mismatch: {len(data)}")
    return data


def build_vocabulary() -> tuple[dict[str, dict[str, object]], dict[str, int], dict[str, int]]:
    preliminary = decode_payload()
    redbooks = [(label, load_redbook(path)) for label, path in REDBOOK_PACKS]
    counts = {level: 0 for level in LEVEL_META}
    overlap_counts = {label: 0 for label, _ in REDBOOK_PACKS}
    final: dict[str, dict[str, object]] = {}

    for term, payload in preliminary.items():
        source_translation, raw_code, quality_code = payload
        overlap_tags: list[str] = []
        redbook_translation = ""
        redbook_categories: list[str] = []

        for label, word_map in redbooks:
            match = word_map.get(term)
            if not match:
                continue
            overlap_tags.append(label)
            overlap_counts[label] += 1
            if not redbook_translation and match["translation"]:
                redbook_translation = match["translation"]
            if match["category"]:
                redbook_categories.append(match["category"])

        raw_level = RAW_LEVELS.get(raw_code, "base")
        final_level = ("overlap" if overlap_tags else "extended") if raw_level == "base" else raw_level
        advice, reason = LEVEL_META[final_level]
        counts[final_level] += 1
        final[term] = {
            "translation": redbook_translation or source_translation,
            "ieltsLevel": final_level,
            "learningAdvice": advice,
            "ieltsReason": reason,
            "overlapTags": overlap_tags,
            "redbookCategories": redbook_categories,
            "qualityStatus": QUALITY.get(quality_code, "review"),
        }

    return final, counts, overlap_counts


def sub_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


def insert_after_once(text: str, marker: str, addition: str, label: str) -> str:
    if text.count(marker) != 1:
        raise RuntimeError(f"{label}: marker count is {text.count(marker)}")
    return text.replace(marker, marker + addition, 1)


def patch_reader(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    text = insert_after_once(
        text,
        "        const EXTRA_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【超纲词】qy自制.json`;",
        "\n        const IELTS_DICT_URL = './public-resources/ielts-vocabulary/ielts-vocabulary-4-level.json';",
        "IELTS URL",
    )

    parser = r'''        const parseIELTSVocabularyPack = (items) => {
            const dict = {};
            if (!items || typeof items !== 'object' || Array.isArray(items)) return dict;
            Object.entries(items).forEach(([rawWord, item]) => {
                const key = String(rawWord || '').trim().toLowerCase();
                if (!key || !item) return;
                dict[key] = {
                    translation: String(item.translation || '').trim(),
                    ieltsLevel: String(item.ieltsLevel || 'extended').trim(),
                    learningAdvice: String(item.learningAdvice || '').trim(),
                    ieltsReason: String(item.ieltsReason || '').trim(),
                    overlapTags: Array.isArray(item.overlapTags) ? item.overlapTags : [],
                    redbookCategories: Array.isArray(item.redbookCategories) ? item.redbookCategories : [],
                    qualityStatus: String(item.qualityStatus || 'review').trim()
                };
            });
            return dict;
        };

        const fetchIELTSVocabularyPack = async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch IELTS vocabulary pack: ${response.status}`);
            return parseIELTSVocabularyPack(await response.json());
        };

'''
    marker = "        const fetchAndParseCorpus = async (setCorpusCount) => {"
    if "const parseIELTSVocabularyPack" not in text:
        text = sub_once(text, re.escape(marker), parser + marker, "IELTS parser")

    lemma_replacement = r'''                    return {
                        translation: entry.translation || entry.zh || '',
                        category: entry.category || '',
                        memo: entry.memo || '',
                        note: entry.memo || '',
                        type: entry.ieltsLevel || type,
                        learningAdvice: entry.learningAdvice || '',
                        ieltsReason: entry.ieltsReason || '',
                        overlapTags: Array.isArray(entry.overlapTags) ? entry.overlapTags : [],
                        redbookCategories: Array.isArray(entry.redbookCategories) ? entry.redbookCategories : [],
                        qualityStatus: entry.qualityStatus || '',
                        word
                    };'''
    lemma_pattern = (
        r"[ \t]+return\s*\{\s*"
        r"translation:\s*entry\.translation\s*\|\|\s*entry\.zh\s*\|\|\s*'',\s*"
        r"category:\s*entry\.category\s*\|\|\s*'',\s*"
        r"memo:\s*entry\.memo\s*\|\|\s*'',\s*"
        r"note:\s*entry\.memo\s*\|\|\s*'',\s*"
        r"type,\s*word\s*\};"
    )
    text = sub_once(text, lemma_pattern, lemma_replacement, "lemma metadata", re.S)

    vocab_meta = r'''        const VOCAB_TYPE_META = {
            core: {
                label: '雅思核心词', advice: '优先学习',
                underline: 'decoration-sky-600 dark:decoration-sky-400',
                badge: 'bg-sky-600 dark:bg-sky-700', text: 'text-sky-700 dark:text-sky-300'
            },
            scenario: {
                label: '雅思场景词', advice: '正常学习',
                underline: 'decoration-emerald-600 dark:decoration-emerald-400',
                badge: 'bg-emerald-600 dark:bg-emerald-700', text: 'text-emerald-700 dark:text-emerald-300'
            },
            overlap: {
                label: '雅思基础重合词', advice: '可选择跳过',
                underline: 'decoration-amber-500 dark:decoration-amber-400',
                badge: 'bg-amber-500 dark:bg-amber-600', text: 'text-amber-700 dark:text-amber-300'
            },
            extended: {
                label: '雅思扩展词', advice: '后期学习',
                underline: 'decoration-violet-500 dark:decoration-violet-400 decoration-dotted',
                badge: 'bg-violet-600 dark:bg-violet-700', text: 'text-violet-700 dark:text-violet-300'
            },
            custom: {
                label: '个人词库', advice: '个人标记',
                underline: 'decoration-rose-500 dark:decoration-rose-400 decoration-dotted',
                badge: 'bg-rose-600 dark:bg-rose-700', text: 'text-rose-700 dark:text-rose-300'
            },
            phrase: {
                label: '语法与佳句', advice: '结合语境学习',
                underline: 'decoration-indigo-500 dark:decoration-indigo-400 decoration-dashed',
                badge: 'bg-indigo-600 dark:bg-indigo-700', text: 'text-indigo-700 dark:text-indigo-300'
            }
        };

        const shouldShowVocabType = (type, highlightMode) => {
            if (highlightMode === 'none') return false;
            if (highlightMode === 'all') return true;
            if (highlightMode === 'daily') return type === 'core' || type === 'scenario';
            return highlightMode === type;
        };'''
    text = sub_once(
        text,
        r"[ \t]*const VOCAB_TYPE_META\s*=\s*\{.*?[ \t]*const shouldShowVocabType\s*=\s*\(type, highlightMode\)\s*=>\s*\{.*?\n[ \t]*\};",
        vocab_meta,
        "vocabulary metadata",
        re.S,
    )

    text = sub_once(
        text,
        r"const \{\s*translation,\s*type,\s*word:\s*lemma,\s*category,\s*memo\s*\}\s*=\s*match;",
        "const { translation, type, word: lemma, category, memo, learningAdvice, ieltsReason, overlapTags, redbookCategories, qualityStatus } = match;",
        "word destructuring",
    )
    text = sub_once(
        text,
        r"onWordClick\(\{\s*word:\s*part,\s*lemma,\s*translation,\s*type,\s*category,\s*memo,\s*note:\s*memo\s*\}\);",
        "onWordClick({ word: part, lemma, translation, type, category, memo, note: memo, learningAdvice, ieltsReason, overlapTags, redbookCategories, qualityStatus });",
        "word click payload",
    )

    phrase_replacement = r'''                                    : {
                                        trans: entry.translation || entry.zh || '',
                                        note: entry.memo || '',
                                        category: entry.category || '',
                                        type: entry.ieltsLevel || dict.type,
                                        learningAdvice: entry.learningAdvice || '',
                                        ieltsReason: entry.ieltsReason || '',
                                        overlapTags: Array.isArray(entry.overlapTags) ? entry.overlapTags : [],
                                        redbookCategories: Array.isArray(entry.redbookCategories) ? entry.redbookCategories : [],
                                        qualityStatus: entry.qualityStatus || ''
                                    };'''
    text = sub_once(
        text,
        r"[ \t]+:\s*\{\s*trans:\s*entry\.translation\s*\|\|\s*entry\.zh\s*\|\|\s*'',\s*note:\s*entry\.memo\s*\|\|\s*'',\s*category:\s*entry\.category\s*\|\|\s*'',\s*type:\s*dict\.type\s*\};",
        phrase_replacement,
        "phrase metadata",
        re.S,
    )
    text = sub_once(
        text,
        r"category:\s*phraseData\.category,\s*type:\s*phraseType",
        "category: phraseData.category,\n                                        type: phraseType,\n                                        learningAdvice: phraseData.learningAdvice,\n                                        ieltsReason: phraseData.ieltsReason,\n                                        overlapTags: phraseData.overlapTags,\n                                        redbookCategories: phraseData.redbookCategories,\n                                        qualityStatus: phraseData.qualityStatus",
        "phrase click payload",
    )

    category_line = r'''                            {activeNote.category && <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">{activeNote.category}</div>}'''
    details = category_line + r'''
                            {(activeNote.learningAdvice || (VOCAB_TYPE_META[activeNote.type] || {}).advice) && (
                                <div className="mb-2 flex items-center gap-2 text-[11px]">
                                    <span className="font-semibold text-gray-500 dark:text-gray-400">学习建议</span>
                                    <span className="px-2 py-0.5 rounded-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{activeNote.learningAdvice || (VOCAB_TYPE_META[activeNote.type] || {}).advice}</span>
                                </div>
                            )}
                            {activeNote.ieltsReason && <div className="mb-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">{activeNote.ieltsReason}</div>}
                            {Array.isArray(activeNote.overlapTags) && activeNote.overlapTags.length > 0 && (
                                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">重合标签</span>
                                    {activeNote.overlapTags.map(tag => <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded-sm border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">{tag}</span>)}
                                </div>
                            )}
                            {activeNote.qualityStatus === 'review' && <div className="mb-2 text-[10px] text-amber-700 dark:text-amber-300">该词来自 OCR 或程序补充释义，建议结合语境复核。</div>}'''
    text = sub_once(text, re.escape(category_line), details, "active card details")

    text = sub_once(text, r"const \[highlightMode, setHighlightMode\] = useState\('exam'\);", "const [highlightMode, setHighlightMode] = useState('daily');", "default filter")
    text = insert_after_once(text, "            const [extraDict, setExtraDict] = useState({});", "\n            const [ieltsDict, setIeltsDict] = useState({});", "IELTS state")

    active_dicts = r'''            const activeDicts = useMemo(() => [
                { data: ieltsDict, type: 'extended' },
                { data: customDict, type: 'custom' }
            ], [ieltsDict, customDict]);'''
    text = sub_once(
        text,
        r"[ \t]*const activeDicts\s*=\s*useMemo\(\(\)\s*=>\s*\[.*?\],\s*\[extraDict,\s*requiredDict,\s*basicDict,\s*customDict\]\);",
        active_dicts,
        "active dictionaries",
        re.S,
    )

    loader = r'''                Promise.all([
                    fetchVocabularyPack(BASIC_DICT_URL),
                    fetchVocabularyPack(REQUIRED_DICT_URL),
                    fetchVocabularyPack(EXTRA_DICT_URL),
                    fetchIELTSVocabularyPack(IELTS_DICT_URL)
                ]).then(([basic, required, extra, ielts]) => {
                    setBasicDict(basic);
                    setRequiredDict(required);
                    setExtraDict(extra);
                    setIeltsDict(ielts);
                }).catch(error => {'''
    text = sub_once(
        text,
        r"[ \t]*Promise\.all\(\[\s*fetchVocabularyPack\(BASIC_DICT_URL\),\s*fetchVocabularyPack\(REQUIRED_DICT_URL\),\s*fetchVocabularyPack\(EXTRA_DICT_URL\)\s*\]\)\.then\(\(\[basic, required, extra\]\)\s*=>\s*\{\s*setBasicDict\(basic\);\s*setRequiredDict\(required\);\s*setExtraDict\(extra\);\s*\}\)\.catch\(error\s*=>\s*\{",
        loader,
        "dictionary loader",
        re.S,
    )
    text = text.replace("Error loading classified vocabulary packs:", "Error loading IELTS vocabulary packs:", 1)
    text = text.replace("分级词库加载失败，请刷新后重试", "雅思分层词库加载失败，请刷新后重试", 1)

    options = r'''                                                <option value="daily">核心＋场景</option>
                                                <option value="all">全部雅思词</option>
                                                <option value="core">雅思核心词</option>
                                                <option value="scenario">雅思场景词</option>
                                                <option value="overlap">基础重合词</option>
                                                <option value="extended">雅思扩展词</option>
                                                <option value="none">关闭标注</option>'''
    text = sub_once(
        text,
        r"[ \t]*<option value=\"exam\">必考＋超纲</option>\s*<option value=\"all\">全部词汇</option>\s*<option value=\"basic\">基础词</option>\s*<option value=\"required\">必考词</option>\s*<option value=\"extra\">超纲词</option>\s*<option value=\"none\">关闭标注</option>",
        options,
        "filter options",
        re.S,
    )
    text = text.replace("w-[112px]", "w-[124px]", 1)
    return text


def write_report(counts: dict[str, int], overlap_counts: dict[str, int]) -> None:
    report = f"""# 雅思四层词汇 · 数据说明

本词库基于用户提供的雅思学习资料进行轻度去重，并与仓库中的 2027 考研英语红宝书三类词表交叉标注。

## 数量

- 总词条：{sum(counts.values())}
- 雅思核心词：{counts['core']}
- 雅思场景词：{counts['scenario']}
- 雅思基础重合词：{counts['overlap']}
- 雅思扩展词：{counts['extended']}

## 红宝书重合

- 考研基础词命中：{overlap_counts['考研基础词']}
- 考研必考词命中：{overlap_counts['考研必考词']}
- 考研超纲词命中：{overlap_counts['考研超纲词']}

## 原则

- 与考研词汇重合不是删除理由，只作为次级标签。
- 仅合并标准词形完全相同的机械重复。
- OCR 风险词继续保留，并以 `qualityStatus: review` 标记。
- 点击词汇时显示雅思层级、学习建议、判定说明和红宝书重合标签。
"""
    OUTPUT_REPORT.write_text(report, encoding="utf-8")


def validate(final: dict[str, dict[str, object]], text: str) -> None:
    if len(final) != 1992:
        raise RuntimeError(f"Final IELTS vocabulary count mismatch: {len(final)}")
    required = [
        "const IELTS_DICT_URL",
        "label: '雅思核心词'",
        "label: '雅思场景词'",
        "label: '雅思基础重合词'",
        "label: '雅思扩展词'",
        '<option value="daily">核心＋场景</option>',
        "activeNote.overlapTags",
        "setIeltsDict(ielts)",
        "fetchIELTSVocabularyPack(IELTS_DICT_URL)",
    ]
    missing = [marker for marker in required if marker not in text]
    if missing:
        raise RuntimeError(f"Missing reader markers: {missing}")
    if '<option value="exam">' in text:
        raise RuntimeError("Legacy exam filter still exists")


def main() -> None:
    final, counts, overlap_counts = build_vocabulary()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(final, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    write_report(counts, overlap_counts)
    updated_index = patch_reader(INDEX.read_text(encoding="utf-8-sig"))
    validate(final, updated_index)
    INDEX.write_text(updated_index, encoding="utf-8")

    for chunk in (ROOT / "tools").glob("ielts-payload-correct.part*"):
        chunk.unlink()
    trigger = ROOT / "tools/ielts-build-trigger.txt"
    if trigger.exists():
        trigger.unlink()

    print(json.dumps({"total": len(final), "levels": counts, "overlaps": overlap_counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
