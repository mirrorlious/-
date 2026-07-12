from __future__ import annotations

import json
import re
import unicodedata
import urllib.request
from pathlib import Path

SOURCE_URL = (
    "https://raw.githubusercontent.com/3056810551/"
    "2027-kaoyan-english-redbook-json/main/category_page_assign.json"
)
OUTPUT_DIR = Path("public-resources/kaoyan-english-2027-vocabulary")

DECKS = {
    "basic": {
        "id": "kaoyan-english-2027-basic-qy",
        "name": "考研英语词汇27【基础词】qy自制",
        "filename": "考研英语词汇27【基础词】qy自制.tsx",
        "json_filename": "考研英语词汇27【基础词】qy自制.json",
        "const": "KAOYAN_ENGLISH_2027_BASIC_QY",
        "description": "2027考研英语基础词与简单基础词，按原词表 Unit 保留分类。",
        "expected_count": 3680,
    },
    "essential": {
        "id": "kaoyan-english-2027-essential-qy",
        "name": "考研英语词汇27【必考词】qy自制",
        "filename": "考研英语词汇27【必考词】qy自制.tsx",
        "json_filename": "考研英语词汇27【必考词】qy自制.json",
        "const": "KAOYAN_ENGLISH_2027_ESSENTIAL_QY",
        "description": "2027考研英语必考词，按原词表 Unit 保留分类。",
        "expected_count": 1856,
    },
    "extended": {
        "id": "kaoyan-english-2027-extended-qy",
        "name": "考研英语词汇27【超纲词】qy自制",
        "filename": "考研英语词汇27【超纲词】qy自制.tsx",
        "json_filename": "考研英语词汇27【超纲词】qy自制.json",
        "const": "KAOYAN_ENGLISH_2027_EXTENDED_QY",
        "description": "2027考研英语超纲词汇。",
        "expected_count": 1015,
    },
}

# 只给少量高价值词提供可靠的本地助记；其余词留给页面在线 AI 解析。
MEMOS = {
    "radiate": "radius 表示“半径”；radiate 可理解为从中心沿半径向外发散。",
    "radiant": "与 radiate 同族：向外放射光芒，因此可指“灿烂的、容光焕发的”。",
    "radical": "radic-/radix 表示“根”；从根部着手可引申为“根本的、彻底的”。",
    "objective": "object 是“外在对象”；不被个人感情左右即 objective，也可作“目标”。",
    "precede": "pre-（在前）+ cede（走）→ 走在前面，即“先于”。",
    "concede": "cede 有“让、退”之意；concede 常表示“承认”或“让步”。",
    "mortgage": "mort-（死）+ gage（抵押、保证）；原指债务清偿前一直有效的抵押契约。",
    "wreck": "既可指严重损毁，也可指残骸；常见搭配：a train wreck / wreck a plan。",
    "strand": "strand 可指“岸”；be stranded 像被留在岸边，表示“滞留、陷入困境”。",
    "trim": "核心画面是“剪掉多余部分，使整齐”；可引申为削减、修整。",
    "havoc": "常见固定搭配：wreak havoc on，表示“对……造成严重破坏”。",
    "turnover": "turn over 有“翻转、周转”之意；turnover 可表示营业额或人员流动率。",
    "stall": "可联想发动机“卡住不转”；作动词常表示停顿、拖延或熄火。",
    "discrepancy": "常用于数据、记录或说法之间不一致：a discrepancy between A and B。",
    "franchise": "核心义是被授予的“特权/经营权”；商业语境常指特许经营。",
    "sober": "本义“不醉的”，也常引申为冷静的、严肃的、清醒的。",
    "infrastructure": "infra-（在下方）+ structure（结构）→ 支撑上层运行的基础设施。",
    "rejuvenate": "re-（再次）+ juven-（年轻）→ 使恢复活力、使年轻。",
    "astronaut": "astro-（星体、太空）+ -naut（航行者）→ 宇航员。",
    "transport": "trans-（跨越）+ port（携带）→ 把人或物运送过去。",
    "import": "im-/in-（进入）+ port（携带）→ 进口、输入。",
    "export": "ex-（向外）+ port（携带）→ 出口、输出。",
    "contradict": "contra-（相反）+ dict（说）→ 说法相反，即反驳、矛盾。",
    "predict": "pre-（提前）+ dict（说）→ 提前说出，即预测。",
    "inspect": "in-（向内）+ spect（看）→ 仔细查看、检查。",
    "prospect": "pro-（向前）+ spect（看）→ 向前看，引申为前景、可能性。",
    "retrospect": "retro-（向后）+ spect（看）→ 回顾。",
    "construct": "con-（共同）+ struct（建造）→ 建造、构成。",
    "destruction": "de-（向下、彻底）+ struct（建造）→ 破坏、毁灭。",
    "cooperate": "co-（共同）+ operate（运作）→ 合作。",
    "interaction": "inter-（在……之间）+ action（行动）→ 相互作用、互动。",
    "international": "inter-（在……之间）+ national（国家的）→ 国际的。",
    "submarine": "sub-（在下）+ marine（海洋的）→ 潜水艇；也可作“海底的”。",
    "superficial": "super-（在上面）+ -ficial（表面）→ 表面的、肤浅的。",
    "antibiotic": "anti-（反对、抵抗）+ bio-（生命）→ 抗生素。",
    "autobiography": "auto-（自己）+ bio-（生命）+ graphy（书写）→ 自传。",
    "bilingual": "bi-（两个）+ lingual（语言的）→ 双语的。",
    "misunderstand": "mis-（错误）+ understand → 误解。",
    "underestimate": "under-（不足）+ estimate（估计）→ 低估。",
    "overestimate": "over-（过度）+ estimate（估计）→ 高估。",
    "unprecedented": "un-（不）+ precedent（先例）+ -ed → 前所未有的。",
}


def clean_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\u200b", "").replace("\ufeff", "")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([，。；：！？、）])", r"\1", text)
    text = re.sub(r"([（])\s+", r"\1", text)
    return text


def classify(page: str) -> str:
    if page.startswith("必考词"):
        return "essential"
    if page.startswith("基础词") or page.startswith("简单基础词"):
        return "basic"
    if page.startswith("超纲词"):
        return "extended"
    raise ValueError(f"无法识别分类：{page!r}")


def normalize_category(page: str) -> str:
    page = clean_text(page)
    match = re.fullmatch(r"(必考词|基础词|简单基础词)Unit(.+)", page)
    if match:
        return f"{match.group(1)} Unit {match.group(2)}"
    return page


def make_word(item: dict) -> dict:
    word = clean_text(item.get("word")).replace("’", "'")
    return {
        "zh": clean_text(item.get("meaning")),
        "en": [word],
        "category": normalize_category(str(item.get("page", ""))),
        "memo": MEMOS.get(word.lower(), ""),
    }


def make_tsx(meta: dict, words: list[dict]) -> str:
    payload = json.dumps(words, ensure_ascii=False, indent=2)
    return f'''/**
 * {meta["name"]}
 *
 * 数据来源：用户提供的 2027 考研英语词汇结构化数据。
 * 整理方式：按原文件的基础词 / 必考词 / 超纲词分类；释义做 Unicode 与空白规范化。
 * 使用入口：Miki 首页 → 词汇默写（/vocabulary-spelling）。
 * 说明：仅少量词提供本地助记，其余词可使用页面在线 AI 解析。
 */

export type VocabularySpellingWord = {{
  zh: string
  en: string[]
  category: string
  memo: string
}}

export const {meta["const"]}: VocabularySpellingWord[] = {payload}

export default {meta["const"]}
'''


def fetch_source() -> list[dict]:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Miki-vocabulary-builder"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> None:
    source = fetch_source()
    groups = {key: [] for key in DECKS}
    for item in source:
        page = clean_text(item.get("page"))
        groups[classify(page)].append(make_word(item))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for key, meta in DECKS.items():
        words = groups[key]
        if len(words) != meta["expected_count"]:
            raise ValueError(f'{meta["name"]} 数量异常：{len(words)}')

        (OUTPUT_DIR / meta["filename"]).write_text(make_tsx(meta, words), encoding="utf-8", newline="\n")
        payload = {
            "schemaVersion": 1,
            "id": meta["id"],
            "name": meta["name"],
            "description": meta["description"],
            "usageHint": "下载后请在首页 → 词汇默写中导入查看。",
            "source": {
                "title": "2027考研英语红宝书结构化词表",
                "maintainer": "qy自制 / Miki",
                "notice": "仅供个人学习与词汇默写使用。",
            },
            "words": words,
        }
        (OUTPUT_DIR / meta["json_filename"]).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        memo_count = sum(bool(word["memo"]) for word in words)
        print(f'{meta["name"]}: {len(words)} words, {memo_count} local memos')


if __name__ == "__main__":
    main()
