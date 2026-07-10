#!/usr/bin/env python3
from pathlib import Path
import base64
import gzip
import hashlib
import json
import re
import shutil
import sys

PACK_ID = 'politics-2027'
VERSION = '2026.07.10'
SUBJECTS = {
    '马原': '马克思主义基本原理',
    '史纲': '中国近代史纲要',
    '毛中特': '毛泽东思想和中国特色社会主义理论体系概论',
    '新思想': '习近平新时代中国特色社会主义思想概论',
    '思修': '思想道德与法治',
}
SUBJECT_ORDER = list(SUBJECTS)


def stable_hash(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:16]


def clean_title(title):
    value = re.sub(r'^(?:考点\s*\d+|总结&扩展\s*\d+|总结与扩展\s*\d+)\s*', '', title).strip()
    return value or '政治考点'


def clean_obsidian_text(text):
    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    if lines and re.fullmatch(r'(?:#[^\s#]+\s*)+', lines[0].strip()):
        lines = lines[1:]
    value = '\n'.join(lines)
    value = re.sub(r'!\[\[([^\]]+)\]\]', lambda m: f'【嵌入内容：{m.group(1).split("|", 1)[-1]}】', value)
    value = re.sub(r'(?<!!)\[\[([^\]]+)\]\]', lambda m: m.group(1).split('|', 1)[-1], value)
    value = re.sub(r'\n##\s*\n---\s*\n', '\n---\n', value)
    value = re.sub(r'\n{4,}', '\n\n\n', value).strip()
    while value.endswith('\n---'):
        value = value[:-4].rstrip()
    return value


def strip_md(text):
    value = text
    value = re.sub(r'`([^`]+)`', r'\1', value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'\1', value)
    value = re.sub(r'(?m)^#{1,6}\s*', '', value)
    value = re.sub(r'(?m)^>\s?', '', value)
    value = re.sub(r'(?m)^---\s*$', '', value)
    value = re.sub(r'(?m)^\|\s*:?-+', '', value)
    value = re.sub(r'\n{3,}', '\n\n', value)
    return value.strip()


def split_sections(body):
    lines = body.split('\n')
    headings = []
    for index, line in enumerate(lines):
        match = re.match(r'^(#{2,3})\s+(.+?)\s*$', line)
        if match:
            headings.append((index, len(match.group(1)), match.group(2).strip()))
    sections = []
    for position, (start, level, title) in enumerate(headings):
        end = len(lines)
        for next_start, next_level, _ in headings[position + 1:]:
            if next_level <= level:
                end = next_start
                break
        content = '\n'.join(lines[start + 1:end]).strip()
        if len(strip_md(content)) >= 35:
            sections.append((title, content))
    return sections


def first_line_tags(text):
    first = text.split('\n', 1)[0].strip()
    if not re.fullmatch(r'(?:#[^\s#]+\s*)+', first):
        return []
    return re.findall(r'#([^\s#]+)', first)


def make_decks():
    decks = []
    for index, subject in enumerate(SUBJECT_ORDER):
        decks.append({
            'id': f'public-politics-{index + 1}',
            'name': subject,
            'description': SUBJECTS[subject],
            'section': '政治',
            'chapter': SUBJECTS[subject],
        })
    return decks


def locate_subject_dirs(source_root):
    result = {}
    for subject in SUBJECT_ORDER:
        candidate = source_root / subject
        if candidate.is_dir():
            result[subject] = candidate
    missing = [subject for subject in SUBJECT_ORDER if subject not in result]
    if missing:
        raise RuntimeError(f'缺少科目目录：{", ".join(missing)}')
    return result


def build(source_root, output_root):
    subject_dirs = locate_subject_dirs(source_root)
    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    decks = make_decks()
    deck_by_subject = {subject: deck['id'] for subject, deck in zip(SUBJECT_ORDER, decks)}
    cards = []
    note_count = 0
    subject_counts = {subject: 0 for subject in SUBJECT_ORDER}

    for subject in SUBJECT_ORDER:
        subject_dir = subject_dirs[subject]
        for path in sorted(subject_dir.rglob('*.md'), key=lambda item: item.as_posix()):
            raw = path.read_text(encoding='utf-8', errors='replace')
            body = clean_obsidian_text(raw)
            plain = strip_md(body)
            if len(plain) < 45:
                continue

            rel = path.relative_to(source_root).as_posix()
            note_key = stable_hash(rel)
            title = clean_title(path.stem)
            category_parts = list(path.relative_to(subject_dir).parts[:-1])
            deck_path = ['政治', subject, *category_parts, title]
            tags = list(dict.fromkeys([subject, *first_line_tags(raw), *re.findall(r'(?<!\w)#([\w\u4e00-\u9fff《》-]+)', body)]))[:24]
            source = {
                'noteId': note_key,
                'deckPath': deck_path,
                'subject': subject,
            }

            overview_id = f'public-politics-{note_key}-overview'
            question = f'请概述：{title}'
            cards.append({
                'id': overview_id,
                'deckId': deck_by_subject[subject],
                'front': question,
                'back': plain,
                'template': 'qa',
                'tags': tags,
                'sourceKey': f'public:{PACK_ID}:{note_key}:overview',
                'source': source,
            })
            section_count = 0
            for section_index, (section_title, content) in enumerate(split_sections(body), start=1):
                section_plain = strip_md(content)
                if not section_plain or len(section_plain) > 6500:
                    continue
                section_clean = strip_md(section_title)
                card_id = f'public-politics-{note_key}-s{section_index:02d}'
                cards.append({
                    'id': card_id,
                    'deckId': deck_by_subject[subject],
                    'front': f'{title}：{section_clean}',
                    'back': section_plain,
                    'template': 'qa',
                    'tags': list(dict.fromkeys([*tags, '分项']))[:24],
                    'sourceKey': f'public:{PACK_ID}:{note_key}:section:{section_index}',
                    'source': source,
                })
                section_count += 1
            note_count += 1
            subject_counts[subject] += 1 + section_count

    bundle = {'data': {'decks': decks}, 'cards': cards}
    raw_bundle = json.dumps(bundle, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    encoded_bundle = base64.b64encode(gzip.compress(raw_bundle, compresslevel=9, mtime=0)).decode('ascii')
    (output_root / 'pack.json.gz.b64').write_text(encoded_bundle, encoding='ascii')

    manifest = {
        'schemaVersion': 1,
        'id': PACK_ID,
        'packId': PACK_ID,
        'title': '考研政治笔记卡组',
        'description': '由公开 Obsidian 政治笔记整理的五科考点卡组，保留重点、高频、论述题与易混淆标签。',
        'subject': '考研政治',
        'type': 'cards',
        'version': VERSION,
        'cardCount': len(cards),
        'deckCount': len(decks),
        'noteCount': note_count,
        'license': 'CC BY-SA 4.0',
        'author': 'XColorful',
        'maintainer': 'Miki 站点',
        'files': {'bundle': 'pack.json.gz.b64', 'attribution': 'ATTRIBUTION.md'},
        'subjects': [
            {'id': subject, 'title': SUBJECTS[subject], 'cardCount': subject_counts[subject]}
            for subject in SUBJECT_ORDER
        ],
    }
    (output_root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (output_root / 'ATTRIBUTION.md').write_text(
        '# Attribution\n\n'
        '- 原作者：XColorful\n'
        '- 原项目：https://github.com/XColorful/Politics-Obsidian-Note\n'
        '- 原许可：CC BY-SA 4.0\n'
        '- 整理用途：将公开 Markdown 笔记转换为 Miki 可加载的考研政治卡片资料包。\n\n'
        '本资料包继续采用 CC BY-SA 4.0。内容属于复习笔记，不替代当年考试大纲、教材与时政资料。\n',
        encoding='utf-8',
    )
    (output_root / 'README.md').write_text(
        f'# 考研政治笔记卡组\n\n- 卡片：{len(cards)} 张\n- 原笔记：{note_count} 篇\n'
        '- 科目：马原、史纲、毛中特、新思想、思修\n- 许可：CC BY-SA 4.0\n',
        encoding='utf-8',
    )

    catalog = {
        'schemaVersion': 1,
        'title': 'Miki 站点资料池',
        'updatedAt': '2026-07-10',
        'packs': [{
            key: manifest[key]
            for key in ['id', 'packId', 'title', 'description', 'subject', 'type', 'version', 'cardCount', 'deckCount', 'noteCount', 'license', 'author']
        }],
    }
    catalog['packs'][0]['manifestUrl'] = 'politics-2027/manifest.json'
    (output_root.parent / 'manifest.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')

    if len({card['id'] for card in cards}) != len(cards):
        raise RuntimeError('卡片 ID 重复。')
    if len({card['sourceKey'] for card in cards}) != len(cards):
        raise RuntimeError('卡片 sourceKey 重复。')

    print(json.dumps({
        'cards': len(cards),
        'notes': note_count,
        'decks': len(decks),
        'bundleBytes': len(encoded_bundle),
        'subjects': subject_counts,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: build-politics-pack.py SOURCE_ROOT OUTPUT_ROOT')
    build(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
