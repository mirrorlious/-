#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, csv, gzip, hashlib, html, io, json, re, urllib.parse, zipfile
from collections import Counter
from pathlib import Path

PACK_ID = "jlpt-eggrolls-v35"
PACK_TITLE = "【egg rolls】JLPT N1-N5 一万词 v3.5"
SOURCE_REPO = "https://github.com/5mdld/anki-jlpt-decks"
SOURCE_COMMIT = "2fe3632726ff63c429dbb602cf181c711247db53"
EXPECTED_NOTES_BLOB_SHA = "27d43d8379248d652d3a7f16c01ffd3cd9be2e0e"
VERSION = "2026.07.13"
SECTION = "日语"
PART_SIZE = 700_000
DEFAULT_REVIEW = {"dueDate":"","interval":0,"ease":2.5,"reps":0,"lapses":0,"lastGrade":None}
CARD_CSS = """
.miki-jlpt-card{font-size:15px;line-height:1.7;color:#252525;overflow-wrap:anywhere}
.miki-jlpt-card header{margin-bottom:14px}
.miki-jlpt-word{font-size:30px;line-height:1.3;margin:0 0 6px;font-weight:800}
.miki-jlpt-reading{font-size:18px;color:#555}
.miki-jlpt-pitch{margin-left:8px;color:#9a5b27;font-weight:700}
.miki-jlpt-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.miki-jlpt-badge{font-size:12px;padding:2px 8px;border-radius:999px;background:#f1f1f1;color:#555}
.miki-jlpt-definition{font-size:18px;font-weight:700;margin:8px 0}
.miki-jlpt-plus{margin:6px 0;color:#555}
.miki-jlpt-audio{width:100%;max-width:480px;height:34px;margin:8px 0}
.miki-jlpt-examples{list-style:none;margin:14px 0 0;padding:0}
.miki-jlpt-example{padding:12px 0;border-top:1px solid #ececec}
.miki-jlpt-example-type{font-size:12px;font-weight:700;color:#8b5e3c}
.miki-jlpt-example-ja{font-size:17px;margin:4px 0}
.miki-jlpt-example-zh{color:#555;margin:4px 0}
.miki-jlpt-card ruby rt{font-size:.55em;color:#666}
""".strip()

FIELDS = {
    "notetype":0,"deck":1,"guid":2,"word":3,"pitch":4,"pos":5,"reading":6,
    "def_sc":7,"def_tc":8,"plus":9,"word_audio":10,
    "type1":11,"sent1":12,"furigana1":13,"sent_sc1":14,"sent_tc1":15,"audio1":16,
    "type2":17,"sent2":18,"furigana2":19,"sent_sc2":20,"sent_tc2":21,"audio2":22,
    "type3":23,"sent3":24,"furigana3":25,"sent_sc3":26,"sent_tc3":27,"audio3":28,
    "type4":29,"sent4":30,"furigana4":31,"sent_sc4":32,"sent_tc4":33,"audio4":34,
    "frequency":35,"alt1":36,"alt2":37,"tags":38,
}

DECK_MAP = {
"eggrolls-JLPT10k-v3.5::1-N5":("JLPT N1-N5 / N5","N5 词汇"),
"eggrolls-JLPT10k-v3.5::2-N4":("JLPT N1-N5 / N4","N4 词汇"),
"eggrolls-JLPT10k-v3.5::3-N3::1-高频":("JLPT N1-N5 / N3","N3 高频"),
"eggrolls-JLPT10k-v3.5::3-N3::2-中频":("JLPT N1-N5 / N3","N3 中频"),
"eggrolls-JLPT10k-v3.5::3-N3::3-低频":("JLPT N1-N5 / N3","N3 低频"),
"eggrolls-JLPT10k-v3.5::4-N2::1-高频":("JLPT N1-N5 / N2","N2 高频"),
"eggrolls-JLPT10k-v3.5::4-N2::2-中频":("JLPT N1-N5 / N2","N2 中频"),
"eggrolls-JLPT10k-v3.5::4-N2::3-低频":("JLPT N1-N5 / N2","N2 低频"),
"eggrolls-JLPT10k-v3.5::5-N1::1-高频":("JLPT N1-N5 / N1","N1 高频"),
"eggrolls-JLPT10k-v3.5::5-N1::2-中频":("JLPT N1-N5 / N1","N1 中频"),
"eggrolls-JLPT10k-v3.5::5-N1::3-低频":("JLPT N1-N5 / N1","N1 低频"),
}

def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()

def text(v: str) -> str:
    v = re.sub(r"\[sound:[^\]]+\]", "", str(v or ""))
    v = re.sub(r"<[^>]+>", "", v)
    return html.unescape(v).strip()

def furigana_html(v: str) -> str:
    clean = text(v)
    escaped = html.escape(clean)
    return re.sub(r"([^ \t\n\[\]<>]+)\[([^\[\]]+)\]", r"<ruby>\1<rt>\2</rt></ruby>", escaped)

def sound_name(v: str) -> str:
    m = re.search(r"\[sound:([^\]]+)\]", str(v or ""))
    return m.group(1) if m else ""

def audio_url(name: str) -> str:
    if not name: return ""
    quoted = urllib.parse.quote(name, safe="")
    return f"https://raw.githubusercontent.com/5mdld/anki-jlpt-decks/{SOURCE_COMMIT}/deck-source/medias/{quoted}"

def audio_html(name: str) -> str:
    url = audio_url(name)
    return f'<audio class="miki-jlpt-audio" controls preload="none" src="{html.escape(url, quote=True)}"></audio>' if url else ""

def stable_id(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:14]

def deck_meta(source_deck: str):
    if source_deck not in DECK_MAP:
        raise ValueError(f"Unexpected deck: {source_deck}")
    chapter,name=DECK_MAP[source_deck]
    level=re.search(r"N[1-5]",name)
    freq=next((x for x in ("高频","中频","低频") if x in name),"")
    return chapter,name,(level.group(0) if level else ""),freq

def compact_tags(raw: str, level: str, freq: str) -> list[str]:
    out=["JLPT",level]
    if freq: out.append(freq)
    for token in str(raw or "").split():
        part=token.split("::")[-1]
        if part.startswith("v") or part in out or not part: continue
        out.append(part)
    return list(dict.fromkeys(out))

def make_decks(rows):
    counts=Counter(r[FIELDS["deck"]] for r in rows)
    decks=[]
    for ordinal,source_deck in enumerate(DECK_MAP):
        chapter,name,level,freq=deck_meta(source_deck)
        deck_id=f"public-{PACK_ID}-deck-{stable_id(source_deck)}"
        decks.append({
            "id":deck_id,"name":name,
            "description":f"{PACK_TITLE} / {name}，共 {counts[source_deck]} 词。",
            "section":SECTION,"chapter":chapter,"color":"mint",
            "createdAt":1784073600000+ordinal,"builtinPack":PACK_ID,
            "source":{"format":"anki-tsv","sourceDeck":source_deck,"sourceCommit":SOURCE_COMMIT},
        })
    return decks,{d["source"]["sourceDeck"]:d for d in decks}

def render_card(row, deck):
    word=text(row[FIELDS["word"]]); reading=text(row[FIELDS["reading"]])
    pitch=text(row[FIELDS["pitch"]]); pos=text(row[FIELDS["pos"]])
    definition=text(row[FIELDS["def_sc"]]); plus=text(row[FIELDS["plus"]])
    chapter,name,level,freq=deck_meta(row[FIELDS["deck"]])
    badges="".join(f'<span class="miki-jlpt-badge">{html.escape(x)}</span>' for x in [level,freq,pos] if x)
    pitch_html = f'<span class="miki-jlpt-pitch">{html.escape(pitch)}</span>' if pitch else ""
    front_html=(
      '<article class="miki-jlpt-card"><header>'
      f'<h1 class="miki-jlpt-word" lang="ja">{html.escape(word)}</h1>'
      f'<div class="miki-jlpt-reading" lang="ja">{html.escape(reading)}{pitch_html}</div>'
      f'<div class="miki-jlpt-meta">{badges}</div>'
      '</header></article>'
    )
    examples=[]
    plain_examples=[]
    for i in range(1,5):
        sent=text(row[FIELDS[f"sent{i}"]]); sent_sc=text(row[FIELDS[f"sent_sc{i}"]])
        if not sent and not sent_sc: continue
        typ=text(row[FIELDS[f"type{i}"]]) or "例"
        fur=row[FIELDS[f"furigana{i}"]]
        ja=furigana_html(fur) if text(fur) else html.escape(sent)
        au=sound_name(row[FIELDS[f"audio{i}"]])
        examples.append(
          '<li class="miki-jlpt-example">'
          f'<div class="miki-jlpt-example-type">{html.escape(typ)}</div>'
          f'<div class="miki-jlpt-example-ja" lang="ja">{ja}</div>'
          f'<div class="miki-jlpt-example-zh">{html.escape(sent_sc)}</div>'
          f'{audio_html(au)}</li>'
        )
        plain_examples.append(f"{typ}：{sent}——{sent_sc}".strip("——"))
    word_au=sound_name(row[FIELDS["word_audio"]])
    plus_html = f'<div class="miki-jlpt-plus">{furigana_html(plus)}</div>' if plus else ""
    examples_html = '<ul class="miki-jlpt-examples">' + ''.join(examples) + '</ul>' if examples else ""
    back_html=(
      '<article class="miki-jlpt-card">'
      f'<div class="miki-jlpt-definition">{html.escape(pos)}　{html.escape(definition)}</div>'
      f'{plus_html}{audio_html(word_au)}{examples_html}'
      '</article>'
    )
    back_plain="；".join(x for x in [reading,pitch,pos,definition,plus,*plain_examples] if x)
    guid=text(row[FIELDS["guid"]])
    card_id=f"public-{PACK_ID}-card-{guid}"
    tags=compact_tags(row[FIELDS["tags"]],level,freq)
    return {
      "id":card_id,"cardId":card_id,"deckId":deck["id"],
      "front":word,"back":back_plain,
      "frontHtml":front_html,"backHtml":back_html,"cardCss":CARD_CSS,
      "template":"anki","tags":tags,"favorite":False,"flagged":False,"comment":"",
      "createdAt":1784077200000,
      "review":dict(DEFAULT_REVIEW),"builtinPack":PACK_ID,
      "sourceKey":f"jlpt-eggrolls:{guid}",
      "source":{
        "format":"anki-tsv","fileName":"deck-source/notes.csv","noteGuid":guid,
        "sourceDeck":row[FIELDS["deck"]],"sourceCommit":SOURCE_COMMIT,
        "sourceUrl":SOURCE_REPO,"audioBaseUrl":f"https://raw.githubusercontent.com/5mdld/anki-jlpt-decks/{SOURCE_COMMIT}/deck-source/medias/",
      },
    }

def read_notes_from_zip(path: Path) -> bytes:
    with zipfile.ZipFile(path) as z:
        return z.read("anki-jlpt-decks-main/deck-source/notes.csv")

def read_notes(path: Path) -> bytes:
    if path.is_file() and path.suffix.lower()==".zip":
        return read_notes_from_zip(path)
    candidate=path/"deck-source"/"notes.csv"
    if not candidate.exists():
        candidate=path/"anki-jlpt-decks-main"/"deck-source"/"notes.csv"
    return candidate.read_bytes()

def main():
    p=argparse.ArgumentParser()
    p.add_argument("source",type=Path)
    p.add_argument("output",type=Path)
    args=p.parse_args()
    notes=read_notes(args.source)
    blob=git_blob_sha(notes)
    if blob!=EXPECTED_NOTES_BLOB_SHA:
        raise SystemExit(f"notes.csv blob mismatch: {blob}")
    content=notes.decode("utf-8-sig")
    lines=content.splitlines()
    rows=list(csv.reader(io.StringIO("\n".join(lines[5:])),delimiter="\t"))
    if any(len(r)!=39 for r in rows):
        raise SystemExit("Unexpected notes.csv column count")
    decks,deck_by_source=make_decks(rows)
    cards=[render_card(r,deck_by_source[r[FIELDS["deck"]]]) for r in rows]
    if len(cards)!=10634 or len(decks)!=11:
        raise SystemExit("Unexpected output counts")
    out=args.output/"public-resources"/"jlpt-eggrolls"
    out.mkdir(parents=True,exist_ok=True)
    payload={"data":{"packId":PACK_ID,"title":PACK_TITLE,"decks":decks},"cards":cards}
    raw=json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode()
    compressed=gzip.compress(raw,compresslevel=9,mtime=0)
    encoded=base64.b64encode(compressed).decode()
    parts=[encoded[i:i+PART_SIZE] for i in range(0,len(encoded),PART_SIZE)]
    for stale in out.glob("pack.part-*.b64"): stale.unlink()
    part_names=[]
    for i,part in enumerate(parts):
        name=f"pack.part-{i:03d}.b64"; (out/name).write_text(part,encoding="utf-8"); part_names.append(name)
    deck_counts=Counter(r[FIELDS["deck"]] for r in rows)
    audio_refs=[]
    for r in rows:
        for idx in (10,16,22,28,34):
            audio_refs.extend(re.findall(r"\[sound:([^\]]+)\]",r[idx]))
    manifest={
      "schemaVersion":1,"id":PACK_ID,"packId":PACK_ID,"title":PACK_TITLE,
      "description":"收录 JLPT N1-N5 共 10,634 个词条，含假名、音调、词性、简体中文释义、例句与按需音频。",
      "subject":"日语","type":"cards","version":VERSION,
      "cardCount":len(cards),"deckCount":len(decks),"noteCount":len(cards),
      "audioReferenceCount":len(audio_refs),"uniqueAudioCount":len(set(audio_refs)),
      "license":"CC BY-NC 4.0","author":"5mdld","maintainer":"Miki 站点",
      "sourceUrl":SOURCE_REPO,"sourceCommit":SOURCE_COMMIT,
      "files":{"bundleParts":part_names,"attribution":"ATTRIBUTION.md"},
      "decks":[{"id":d["id"],"title":d["name"],"cardCount":deck_counts[d["source"]["sourceDeck"]]} for d in decks],
    }
    (out/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    report={
      "source":{"repository":SOURCE_REPO,"commit":SOURCE_COMMIT,"notesBlobSha":blob},
      "input":{"noteCount":len(rows),"columnCount":39,"audioReferenceCount":len(audio_refs),"uniqueAudioCount":len(set(audio_refs))},
      "output":{"cardCount":len(cards),"deckCount":len(decks),"bundlePartCount":len(parts),"rawBytes":len(raw),"gzipBytes":len(compressed),"base64Chars":len(encoded)},
      "deckCounts":dict(deck_counts),
      "validation":{"uniqueCardIds":len({c["id"] for c in cards})==len(cards),"nonEmptySides":all(c["front"].strip() and c["back"].strip() for c in cards),"validDeckIds":all(c["deckId"] in {d["id"] for d in decks} for c in cards)},
    }
    (out/"conversion-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (out/"README.md").write_text(f"""# {PACK_TITLE}

- 卡片：{len(cards)}
- 卡组：{len(decks)}
- 音频引用：{len(audio_refs)} 次（{len(set(audio_refs))} 个文件）
- 格式：Miki `cards` 公共资料包
- 来源提交：`{SOURCE_COMMIT}`

正文被转换为不执行 Anki JavaScript 的安全 HTML。音频不重复托管，按需读取固定来源提交中的文件。
""",encoding="utf-8")
    (out/"ATTRIBUTION.md").write_text(f"""# Attribution

- 原项目：[{PACK_TITLE}]({SOURCE_REPO})
- 原作者：5mdld
- 固定来源提交：`{SOURCE_COMMIT}`
- 许可：Creative Commons Attribution-NonCommercial 4.0 International（CC BY-NC 4.0）
- 转换：Miki 站点将 Anki TSV 转换为可在 Browse / Study 中使用的普通卡片资料包。

使用者须保留署名，并仅用于非商业用途。Miki 未重新托管原项目的 27,015 个音频文件；卡片按需引用固定来源提交。
""",encoding="utf-8")
    index_path=args.output/"public-resources"/"manifest.json"
    if index_path.exists():
        index=json.loads(index_path.read_text(encoding="utf-8"))
        entry={
          "id":PACK_ID,"packId":PACK_ID,"title":PACK_TITLE,
          "description":"收录 JLPT N1-N5 共 10,634 个词条，含假名、音调、词性、中文释义、例句与按需音频。",
          "subject":"日语","type":"cards","version":VERSION,
          "cardCount":len(cards),"deckCount":len(decks),
          "audioReferenceCount":len(audio_refs),"uniqueAudioCount":len(set(audio_refs)),
          "license":"CC BY-NC 4.0","author":"5mdld",
          "usageHint":"加入后可在浏览页按 JLPT 等级与频率查看，并在学习页复习。",
          "manifestUrl":"jlpt-eggrolls/manifest.json",
        }
        packs=[item for item in index.get("packs",[]) if item.get("packId")!=PACK_ID and item.get("id")!=PACK_ID]
        insert_at=next((i+1 for i,item in enumerate(packs) if item.get("packId")=="pharmacology-xmind-anki"),len(packs))
        packs.insert(insert_at,entry)
        index["updatedAt"]="2026-07-15"
        index["packs"]=packs
        index_path.write_text(json.dumps(index,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
