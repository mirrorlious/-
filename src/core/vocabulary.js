const CORPUS_URL = "https://gist.githubusercontent.com/mirrorlious97/1f649feb13d7da16cbdc3817841c16cc/raw/a90daca68e24f5892f68edc38793f858ceca5f05/12345.txt";

const VOCAB_RESOURCE_BASE = "./public-resources/kaoyan-english-2027-vocabulary";

const BASIC_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【基础词】qy自制.json`;

const REQUIRED_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【必考词】qy自制.json`;

const EXTRA_DICT_URL = `${VOCAB_RESOURCE_BASE}/考研英语红宝书词汇27新版【超纲词】qy自制.json`;

const LEGACY_PRESET_DICT_GIST_URL = "https://gist.github.com/mirrorlious97/e39459d2885f9eb78257d4524e18df6f";

const LEGACY_HARD_DICT_GIST_URL = "https://gist.github.com/mirrorlious97/9e36522b809b300f316fc5899bbb448f";

let REAL_EXAM_CORPUS = [];

const parseDictText = (text) => {
    const dict = {};
    text.split('\n').forEach(line => {
        const sepMatch = line.match(/([=：:]|\s{2,})/);
        if (sepMatch) {
            const sepIndex = line.indexOf(sepMatch[0]);
            let key = line.substring(0, sepIndex).trim().toLowerCase();
            let meaning = line.substring(sepIndex + sepMatch[0].length).trim();
            meaning = meaning.replace(/\b(?:v|n|adj|adv|prep|conj|pron|art|num|vi|vt)\./gi, '').replace(/\s+/g, ' ').trim();
            if (key) dict[key] = meaning;
        }
    });
    return dict;
};

const parseVocabularyPack = (items) => {
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

const fetchAndParseCorpus = async (setCorpusCount) => {
    if (!CORPUS_URL) return;
    try {
        const response = await fetch(CORPUS_URL);
        if (!response.ok) throw new Error("Failed to fetch corpus");
        const rawText = await response.text();

        REAL_EXAM_CORPUS = rawText.trim().split('\n').map(line => {
            const match = line.match(/^\[(.*?)\]\s*(.*)$/);
            if (match) return { source: match[1].trim(), sentence: match[2].trim() };
            return null;
        }).filter(Boolean);

        if (setCorpusCount) setCorpusCount(REAL_EXAM_CORPUS.length);
    } catch (error) { console.error("Error loading external corpus:", error); }
};

const getRelevantCorpus = (targetText, corpus, topN = 40) => {
    if (!corpus || corpus.length === 0) return [];
    const targetWords = new Set(targetText.toLowerCase().match(/[a-z]+/g) || []);
    const structureWords = new Set([
        'which', 'that', 'who', 'whom', 'where', 'when', 'whose',
        'although', 'though', 'because', 'if', 'unless', 'since', 'as', 'while',
        'to', 'with', 'by', 'for', 'about', 'without', 'despite', 'doing', 'done'
    ]);

    const scoredCorpus = corpus.map(item => {
        const itemWords = item.sentence.toLowerCase().match(/[a-z]+/g) || [];
        let score = 0;
        itemWords.forEach(w => {
            if (targetWords.has(w)) score += structureWords.has(w) ? 3 : 1;
        });
        score -= (Math.abs(itemWords.length - targetWords.size) * 0.1);
        return { ...item, score };
    });

    return scoredCorpus.sort((a, b) => b.score - a.score).slice(0, topN).map(item => ({
        source: item.source,
        sentence: item.sentence
    }));
};

const getLemmaMatches = (rawWord, dicts) => {
    const w = rawWord.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return null;

    for (const dictObj of dicts) {
        const { data, type } = dictObj;
        if (!data) continue;
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
        };

        let match = check(w);
        if (match) return match;

        if (w.endsWith('s')) {
            match = check(w.slice(0, -1)); if (match) return match;
            if (w.endsWith('es')) { match = check(w.slice(0, -2)); if (match) return match; }
            if (w.endsWith('ies')) { match = check(w.slice(0, -3) + 'y'); if (match) return match; }
        }

        if (w.endsWith('ed')) {
            match = check(w.slice(0, -1)); if (match) return match;
            match = check(w.slice(0, -2)); if (match) return match;
            if (w.endsWith('ied')) { match = check(w.slice(0, -3) + 'y'); if (match) return match; }
            if (w.length > 3 && w[w.length-3] === w[w.length-4]) {
                match = check(w.slice(0, -3)); if (match) return match;
            }
        }

        if (w.endsWith('ing')) {
            match = check(w.slice(0, -3)); if (match) return match;
            match = check(w.slice(0, -3) + 'e'); if (match) return match;
            if (w.length > 4 && w[w.length-4] === w[w.length-5]) {
                match = check(w.slice(0, -4)); if (match) return match;
            }
        }

        if (w.endsWith('ly')) {
            match = check(w.slice(0, -2)); if (match) return match;
            if (w.endsWith('ily')) { match = check(w.slice(0, -3) + 'y'); if (match) return match; }
        }
    }
    return null;
};

const VOCAB_DB = {
    cet6: {
        resolution: "决议", initiate: "发起", authorization: "授权", commits: "投入",
        dismissing: "驳回", exclusive: "排他的", regulate: "规范", designates: "指定"
    },
    kaoyan: {
        unilateral: "单边的", vowed: "发誓", halt: "停止", imminent: "迫在眉睫的",
        assertion: "断言", verge: "边缘", preemptive: "先发制人的", echoed: "附和"
    }
};

const PHRASE_DB = {
    "war of choice": { trans: "选择性战争", note: "【政经/法律背景】区别于“自卫反击(war of necessity)”，指非被迫、主动发起的战争。" },
    "state of the union": { trans: "国情咨文", note: "【常识/专有名词】美国总统每年在国会发表的年度报告。" },
    "dimming the prospects": { trans: "使前景黯淡", note: "【高级动宾搭配】dim 作及物动词用（使变暗）+ prospect（前景/可能性）。" }
};

const normalizeMasteredLemmas = (values) => Array.from(new Set(
    (Array.isArray(values) ? values : [])
        .map(value => String(value || '').trim().toLowerCase())
        .filter(value => /^[a-z]+(?:-[a-z]+)*$/.test(value))
)).sort((a, b) => a.localeCompare(b));

const buildPortableVocabularyPreferences = (ignoredLemmas) => ({
    vocabulary: {
        version: 1,
        ignoredLemmas: normalizeMasteredLemmas(ignoredLemmas)
    }
});

export {
  BASIC_DICT_URL,
  REQUIRED_DICT_URL,
  EXTRA_DICT_URL,
  REAL_EXAM_CORPUS,
  parseDictText,
  fetchVocabularyPack,
  fetchAndParseCorpus,
  getRelevantCorpus,
  getLemmaMatches,
  PHRASE_DB,
  normalizeMasteredLemmas,
  buildPortableVocabularyPreferences
};
