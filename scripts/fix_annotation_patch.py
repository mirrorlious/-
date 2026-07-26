from pathlib import Path

path = Path('scripts/apply_reader_annotations.py')
source = path.read_text(encoding='utf-8')
old = 'inputText.split(/\\n+/)'
new = 'inputText.split(/\\\\n+/)'
count = source.count(old)
if count != 2:
    raise RuntimeError(f'expected 2 paragraph regex anchors, found {count}')
path.write_text(source.replace(old, new), encoding='utf-8')
print('Escaped paragraph regex anchors in patch script.')
