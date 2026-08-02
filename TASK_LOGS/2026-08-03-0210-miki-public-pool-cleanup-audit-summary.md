# Miki 公共池清理审计摘要

- branch: `chore/remove-miki-public-pool`
- audited head: `322a0a33dac5545bbe6f608073426a680951d330`
- tracked files: **594**

## public-resources 顶层内容

| 名称 | 文件数 |
|---|---:|
| `dyl-exam-public-backup` | 430 |
| `ielts-vocabulary` | 2 |
| `jlpt-eggrolls` | 10 |
| `kaoyan-english-2027-vocabulary` | 1 |
| `kaoyan-english-one-papers` | 4 |
| `kaoyan-english-two-papers` | 4 |
| `manifest.json` | 1 |
| `pharmacology` | 32 |
| `politics-2027` | 4 |

## 总 manifest 条目

- `dyl-exam-public-backup`
- `politics-2027`
- `pharmacology-xmind-anki`
- `jlpt-eggrolls-v35`
- `kaoyan-english-one-papers`
- `kaoyan-english-two-papers`
- `kaoyan-english-2027-basic-qy`
- `kaoyan-english-2027-essential-qy`
- `kaoyan-english-2027-extended-qy`

## 删除候选

| 路径 | 存在 | 文件数 |
|---|---|---:|
| `public-resources/manifest.json` | True | 1 |
| `public-resources/politics-2027` | True | 4 |
| `public-resources/pharmacology` | True | 32 |
| `public-resources/jlpt-eggrolls` | True | 10 |
| `public-resources/kaoyan-english-one-papers` | True | 4 |
| `public-resources/kaoyan-english-two-papers` | True | 4 |

## 保护路径

| 路径 | 存在 | 文件数 |
|---|---|---:|
| `public-resources/dyl-exam-public-backup` | True | 430 |
| `public-resources/ielts-vocabulary` | True | 2 |
| `public-resources/kaoyan-english-2027-vocabulary` | True | 1 |
| `scripts/build-cloudbase-v2.cjs` | True | 1 |

## 候选标记的候选目录外引用

### `politics-2027`

- `.github/workflows/build-politics-pack.yml`
  - L24: `run: python3 scripts/build-politics-pack.py /tmp/Politics-Obsidian-Note public-resources/politics-2027`
- `scripts/build-politics-pack.py`
  - L12: `PACK_ID = 'politics-2027'`
  - L453: `catalog['packs'][0]['manifestUrl'] = 'politics-2027/manifest.json'`

### `pharmacology`

- `tools/build_jlpt_eggrolls_pack.py`
  - L279: `insert_at=next((i+1 for i,item in enumerate(packs) if item.get("packId")=="pharmacology-xmind-anki"),len(packs))`
- `tools/build_pharmacology_pack.py`
  - L7: `PACK_ID='pharmacology-xmind-anki'`
  - L10: `SOURCE_URL='https://github.com/nanguaguag/pharmacology'`
  - L11: `MEDIA_BASE='https://raw.githubusercontent.com/mirrorlious/-/main/public-resources/pharmacology/media'`
  - L132: `entry={'id':PACK_ID,'packId':PACK_ID,'title':TITLE,'description':'由 XMind 药理学纲要与 Anki 药物卡片转换，支持在浏览页与学习页按章节使用。','subject':'药理学','type':'cards','version':VERSION,'cardCount':len(cards),'deckCount':len(deck_list),'xmindSheetCount':stats['xmind']['convertedSheetCount'],'ankiCardCount':stats['anki']['con`
  - L138: `if len(sys.argv)!=3: raise SystemExit('usage: build_pharmacology_pack.py SOURCE_DIR PUBLIC_RESOURCES_DIR')`
  - L139: `main(Path(sys.argv[1]),Path(sys.argv[2])/'pharmacology')`

### `jlpt-eggrolls`

- `tools/build_jlpt_eggrolls_pack.py`
  - L7: `PACK_ID = "jlpt-eggrolls-v35"`
  - L171: `"sourceKey":f"jlpt-eggrolls:{guid}",`
  - L209: `out=args.output/"public-resources"/"jlpt-eggrolls"`
  - L276: `"manifestUrl":"jlpt-eggrolls/manifest.json",`

### `kaoyan-english-2027-vocabulary`

- `.github/workflows/generate-kaoyan-english-vocabulary.yml`
  - L37: `git add public-resources/kaoyan-english-2027-vocabulary/*.tsx`
  - L38: `git add public-resources/kaoyan-english-2027-vocabulary/*.json`
- `scripts/build-cloudbase-v2.cjs`
  - L72: `"kaoyan-english-2027-vocabulary"`
- `scripts/generate_kaoyan_english_vocabulary.py`
  - L13: `OUTPUT_DIR = Path("public-resources/kaoyan-english-2027-vocabulary")`
- `src/core/vocabulary.js`
  - L3: `const VOCAB_RESOURCE_BASE = "./public-resources/kaoyan-english-2027-vocabulary";`

### `ielts-vocabulary`

- `src/core/vocabulary.js`
  - L11: `const IELTS_DICT_URL = './public-resources/ielts-vocabulary/ielts-vocabulary-4-level.json';`

### `dyl-exam-public-backup`

- `public-resources/dyl-exam-public-backup/manifest.json`
  - L3: `"packId": "dyl-exam-public-backup",`

### `build-politics-pack`

- `.github/workflows/build-politics-pack.yml`
  - L7: `- scripts/build-politics-pack.py`
  - L8: `- .github/workflows/build-politics-pack.yml`
  - L24: `run: python3 scripts/build-politics-pack.py /tmp/Politics-Obsidian-Note public-resources/politics-2027`
- `scripts/build-politics-pack.py`
  - L472: `raise SystemExit('usage: build-politics-pack.py SOURCE_ROOT OUTPUT_ROOT')`

### `generate_kaoyan_english_vocabulary`

- `.github/workflows/generate-kaoyan-english-vocabulary.yml`
  - L8: `- scripts/generate_kaoyan_english_vocabulary.py`
  - L30: `run: python scripts/generate_kaoyan_english_vocabulary.py`

### `build_pharmacology_pack`

- `tools/build_pharmacology_pack.py`
  - L138: `if len(sys.argv)!=3: raise SystemExit('usage: build_pharmacology_pack.py SOURCE_DIR PUBLIC_RESOURCES_DIR')`


## scripts / tools

- `scripts/build-cloudbase-v2.cjs`
- `scripts/build-politics-pack.py`
- `scripts/generate-pwa-icons.mjs`
- `scripts/generate_kaoyan_english_vocabulary.py`
- `scripts/reading-completion-vite-plugin.mjs`
- `tools/build_jlpt_eggrolls_pack.py`
- `tools/build_pharmacology_pack.py`

## workflows

- `.github/workflows/apply-reader-ui-first-batch.yml`
- `.github/workflows/audit-miki-public-pool-cleanup.yml`
- `.github/workflows/build-politics-pack.yml`
- `.github/workflows/generate-kaoyan-english-vocabulary.yml`
- `.github/workflows/pwa-branch-check.yml`
- `.github/workflows/summarize-miki-public-pool-audit.yml`
