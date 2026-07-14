#!/usr/bin/env python3
from __future__ import annotations

import base64, csv, gzip, hashlib, html, json, re, shutil, sys, zipfile
from pathlib import Path

PACK_ID='pharmacology-xmind-anki'
TITLE='药理学思维导图与药物卡片'
VERSION='2026.07.13.1'
SOURCE_URL='https://github.com/nanguaguag/pharmacology'
MEDIA_BASE='https://raw.githubusercontent.com/mirrorlious/-/main/public-resources/pharmacology/media'
URL_RE=re.compile(r'https?://[^\s<>\"]+',re.I)
TAG_RE=re.compile(r'<[^>]+>')
DEFAULT_REVIEW={'dueDate':'','interval':0,'ease':2.5,'reps':0,'lapses':0,'lastGrade':None}
GROUPS=[
 ('总论与重点',[0,2,3,54,55,57]),
 ('传出神经系统',[4,6,7,8,10,31,32,33,34,56,58]),
 ('中枢神经系统',[9,13,14,16,17,18,23,38,39,51,52]),
 ('自体活性物质与抗炎药',[19,25]),
 ('心血管系统',[12,15,20,22,26,27,29,30,40,41]),
 ('内分泌、呼吸与消化',[24,28,35,37,48,50]),
 ('抗菌药',[36,42,43,44,45,46,47,49,53]),
]
CSS='''.miki-xmind-outline{font-size:15px;line-height:1.75;color:#252525;max-width:100%;overflow-wrap:anywhere}.miki-xmind-outline header{padding:0 0 12px;border-bottom:1px solid #ececec;margin-bottom:12px}.miki-xmind-outline h2{font-size:20px;line-height:1.35;margin:0 0 8px;font-weight:800}.miki-xmind-outline ul{margin:6px 0 6px 1.15em;padding-left:1em}.miki-xmind-outline li{margin:5px 0}.xmind-topic-title{font-weight:700}.xmind-topic-note{margin:4px 0;color:#555}.xmind-source-link{display:inline-block;margin-right:8px;font-size:12px;font-weight:700;color:#a92f28;text-decoration:none}.xmind-topic-image{display:block;max-width:min(100%,720px);height:auto;margin:10px auto;border-radius:10px}'''

def norm(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def sid(v): return hashlib.sha1(str(v).encode()).hexdigest()[:14]
def clean_title(v):
 s=str(v or '').strip(); found=URL_RE.findall(s); s=URL_RE.sub('',s)
 s=re.sub(r'^药理学\s*\d+(?:-\d+)?\s*[:：]?\s*','',s,flags=re.I)
 return norm(s) or (found[0] if found else '未命名主题')
def urls(v): return list(dict.fromkeys(URL_RE.findall(str(v or ''))))
def children(t):
 out=[]
 for v in (t.get('children') or {}).values():
  if isinstance(v,list): out.extend(x for x in v if isinstance(x,dict))
 return out
def walk(t):
 yield t
 for c in children(t): yield from walk(c)
def strip_html(v):
 s=str(v or ''); s=re.sub(r'<br\s*/?>','\n',s,flags=re.I); s=TAG_RE.sub(' ',s)
 return norm(html.unescape(s))
def sanitize(v):
 s=str(v or '')
 s=re.sub(r'<(script|iframe|object|embed|form)\b[^>]*>[\s\S]*?</\1>','',s,flags=re.I)
 s=re.sub(r'<(script|iframe|object|embed|form|input|button)\b[^>]*?/?>','',s,flags=re.I)
 s=re.sub(r'\s+on[a-z]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)','',s,flags=re.I)
 s=re.sub(r'\s+(href|src)\s*=\s*(["\'])\s*javascript:[\s\S]*?\2','',s,flags=re.I)
 return s.strip()
def notes(t):
 n=t.get('notes')
 if not isinstance(n,dict): return ''
 for k in ('plain','html'):
  v=n.get(k)
  if isinstance(v,dict): v=v.get('content')
  if v: return strip_html(v)
 return ''
def link_list(t):
 out=urls(t.get('title')); h=str(t.get('href') or '')
 if h.startswith(('http://','https://')): out.append(h)
 return list(dict.fromkeys(out))
def image_name(t):
 i=t.get('image') or {}; src=str(i.get('src') or ''); p='xap:resources/'
 return src[len(p):] if src.startswith(p) else ''
def render(t,root=False,depth=0):
 title=clean_title(t.get('title')); blocks=[]
 if not root: blocks.append(f'<span class="xmind-topic-title">{html.escape(title)}</span>')
 if notes(t): blocks.append(f'<p class="xmind-topic-note">{html.escape(notes(t))}</p>')
 for u in link_list(t): blocks.append(f'<a class="xmind-source-link" href="{html.escape(u,quote=True)}" target="_blank" rel="noreferrer">来源链接</a>')
 img=image_name(t)
 if img: blocks.append(f'<img class="xmind-topic-image" src="{MEDIA_BASE}/{html.escape(img,quote=True)}" alt="{html.escape(title,quote=True)}" loading="lazy" />')
 cs=children(t)
 if cs: blocks.append('<ul>'+''.join(f'<li>{render(c,False,depth+1)}</li>' for c in cs)+'</ul>')
 body=''.join(blocks)
 return body if root else '<div class="xmind-topic">'+body+'</div>'
def group_for(i):
 for name,idxs in GROUPS:
  if i in idxs:return name
 return 'XMind 纲要'
def deck(name,n):
 return {'id':f'public-{PACK_ID}-deck-{sid(name)}','name':name,'description':f'{name}资料。','section':'医学','chapter':'药理学 / 纲要' if name!='药物卡片' else '药理学 / 药物','color':'mint','createdAt':1760000000000+n,'builtinPack':PACK_ID,'source':{'format':'xmind-converted'}}

def main(source:Path,out:Path):
 xmind=next(source.glob('*.xmind')); txt=next(source.glob('*.txt'))
 if out.exists(): shutil.rmtree(out)
 (out/'media').mkdir(parents=True)
 with zipfile.ZipFile(xmind) as z:
  sheets=json.loads(z.read('content.json'))
  idx={str(t.get('id')):t for s in sheets for t in walk(s.get('rootTopic') or {}) if t.get('id')}
  for name in z.namelist():
   if name.startswith('resources/') and not name.endswith('/'):(out/'media'/Path(name).name).write_bytes(z.read(name))
 decks={name:deck(name,n) for n,(name,_) in enumerate(GROUPS)}
 decks['药物卡片']=deck('药物卡片',len(decks)); cards=[]; skipped=[]
 for i,s in enumerate(sheets):
  root=s.get('rootTopic') or {}; topic=root
  if not children(root) and str(root.get('href') or '').startswith('xmind:#'): topic=idx.get(str(root['href']).split('#',1)[1])
  if not topic:
   skipped.append({'index':i,'title':clean_title(s.get('title')),'reason':'missing-topic'}); continue
  title=clean_title(s.get('title') or topic.get('title')); name=group_for(i); d=decks[name]
  source_links=''.join(f'<a class="xmind-source-link" href="{html.escape(u,quote=True)}" target="_blank" rel="noreferrer">查看原文</a>' for u in list(dict.fromkeys(urls(s.get('title'))+link_list(topic))))
  back_html=f'<article class="miki-xmind-outline"><header><h2>{html.escape(title)}</h2>{source_links}</header>{render(topic,True)}</article>'
  back='；'.join(clean_title(t.get('title')) for t in walk(topic) if clean_title(t.get('title'))) or title
  cid=f'public-{PACK_ID}-xmind-{sid(s.get("id") or i)}'
  cards.append({'id':cid,'cardId':cid,'deckId':d['id'],'front':title,'back':back,'backHtml':back_html,'cardCss':CSS,'template':'anki','tags':['XMind','药理学',name],'favorite':False,'flagged':False,'comment':'','createdAt':1760001000000+len(cards),'review':dict(DEFAULT_REVIEW),'builtinPack':PACK_ID,'sourceKey':f'xmind:{s.get("id") or i}','source':{'format':'xmind','fileName':xmind.name,'sheetId':str(s.get('id') or i),'sheetIndex':i,'sourceUrls':urls(s.get('title'))}})
 rows=[]
 for raw in csv.reader([l for l in txt.read_text(encoding='utf-8-sig').splitlines() if l and not l.startswith('#')],delimiter='\t',quotechar='"',doublequote=True):
  if len(raw)<5:continue
  raw+=['']*(6-len(raw)); guid,nt,dn,f,b,tags=raw[:6]; ft,bt=strip_html(f),strip_html(b)
  if ft and bt: rows.append((guid,nt,dn,ft,sanitize(f) if TAG_RE.search(f) else '',bt,sanitize(b) if TAG_RE.search(b) else '',tags))
 seen=set(); dup=0
 for guid,nt,dn,ft,fh,bt,bh,tags in rows:
  key=ft.casefold()
  if key in seen:dup+=1;continue
  seen.add(key); cid=f'public-{PACK_ID}-anki-{sid(guid or ft)}'
  card={'id':cid,'cardId':cid,'deckId':decks['药物卡片']['id'],'front':ft,'back':bt,'template':'anki','tags':['药理学','药物卡片',*[x for x in re.split(r'[\s,;]+',tags) if x]],'favorite':False,'flagged':False,'comment':'','createdAt':1760002000000+len(cards),'review':dict(DEFAULT_REVIEW),'builtinPack':PACK_ID,'sourceKey':f'anki-text:{guid or sid(ft)}','source':{'format':'anki-text-export','fileName':txt.name,'guid':guid,'noteType':nt,'deckName':dn}}
  if fh:card['frontHtml']=fh
  if bh:card['backHtml']=bh
  cards.append(card)
 deck_list=list(decks.values()); stats={'xmind':{'sheetCount':len(sheets),'convertedSheetCount':len(sheets)-len(skipped),'skippedSheets':skipped,'mediaCount':len(list((out/'media').glob('*')))},'anki':{'rawRowCount':len(rows),'convertedCardCount':len(seen),'duplicateCount':dup},'cardCount':len(cards),'deckCount':len(deck_list)}
 bundle={'schemaVersion':1,'packId':PACK_ID,'title':TITLE,'data':{'decks':deck_list},'cards':cards}
 encoded=base64.b64encode(gzip.compress(json.dumps(bundle,ensure_ascii=False,separators=(',',':')).encode(),9)).decode()
 parts=[encoded[i:i+70000] for i in range(0,len(encoded),70000)]
 for i,p in enumerate(parts):(out/f'pack.part-{i:03d}.b64').write_text(p)
 manifest={'schemaVersion':1,'id':PACK_ID,'packId':PACK_ID,'title':TITLE,'description':'由药理学 XMind 思维导图与 Anki 药物卡片转换，支持在 Browse 与 Study 中按章节阅读和复习。','subject':'药理学','type':'cards','version':VERSION,'cardCount':len(cards),'deckCount':len(deck_list),'license':'按原项目许可（已确认允许再分发）','author':'nanguaguag','maintainer':'Miki 站点','sourceUrl':SOURCE_URL,'files':{'bundleParts':[f'pack.part-{i:03d}.b64' for i in range(len(parts))],'attribution':'ATTRIBUTION.md'},'decks':[{'id':d['id'],'title':d['name'],'cardCount':sum(c['deckId']==d['id'] for c in cards)} for d in deck_list],'conversion':stats}
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 (out/'conversion-report.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
 (out/'conversion-config.json').write_text(json.dumps({'section':'医学','groups':[{'deck':n,'sheetIndexes':idxs} for n,idxs in GROUPS]},ensure_ascii=False,indent=2))
 (out/'README.md').write_text(f'''# {TITLE}\n\n由 `{SOURCE_URL}` 的 XMind 思维导图与 Anki 文本导出转换。\n\n- XMind 纲要卡：{stats['xmind']['convertedSheetCount']} 张\n- Anki 药物卡：{stats['anki']['convertedCardCount']} 张\n- 合计：{len(cards)} 张卡片，{len(deck_list)} 个卡组\n\n资料包使用 Miki public asset pack 格式，可从公共池安装后在 Browse 与 Study 中使用。\n''')
 (out/'ATTRIBUTION.md').write_text(f'''# 来源与许可说明\n\n- 原项目：[{SOURCE_URL}]({SOURCE_URL})\n- 原作者：nanguaguag\n- 许可：按原项目许可；用户已确认允许本次整理、转换和再分发\n- 转换维护：Miki 站点\n\n转换仅改变数据结构和展示形式。部分工作表保留原作者公开文章链接。本资料仅供学习，不构成诊疗或用药建议。\n''')
 root=out.parent/'manifest.json'; data=json.loads(root.read_text())
 entry={'id':PACK_ID,'packId':PACK_ID,'title':TITLE,'description':'由 XMind 药理学纲要与 Anki 药物卡片转换，支持在浏览页与学习页按章节使用。','subject':'药理学','type':'cards','version':VERSION,'cardCount':len(cards),'deckCount':len(deck_list),'xmindSheetCount':stats['xmind']['convertedSheetCount'],'ankiCardCount':stats['anki']['convertedCardCount'],'license':'按原项目许可（已确认允许再分发）','author':'nanguaguag','manifestUrl':'pharmacology/manifest.json'}
 data['updatedAt']='2026-07-13'; data['packs']=[p for p in data.get('packs',[]) if p.get('packId')!=PACK_ID]; data['packs'].insert(1,entry)
 root.write_text(json.dumps(data,ensure_ascii=False,indent=2))
 print(json.dumps(stats,ensure_ascii=False,indent=2))

if __name__=='__main__':
 if len(sys.argv)!=3: raise SystemExit('usage: build_pharmacology_pack.py SOURCE_DIR PUBLIC_RESOURCES_DIR')
 main(Path(sys.argv[1]),Path(sys.argv[2])/'pharmacology')
