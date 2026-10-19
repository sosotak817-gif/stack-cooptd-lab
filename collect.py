import urllib.request,re,pathlib,json,concurrent.futures
BASE='https://coop-tools.vercel.app'
ROOT=pathlib.Path('.')
RAW=ROOT/'original'
RAW.mkdir(parents=True,exist_ok=True)
routes=['/','/dps-compare','/dps-rank','/board','/boss-sim','/charts','/tickets','/lib-sim','/wall-sim','/robots.txt','/sitemap.xml']
if pathlib.Path('extra-assets.json').exists():routes+=json.loads(pathlib.Path('extra-assets.json').read_text())
seen=set(); records=[]
def fetch(p):
 try:
  target=RAW/(p.lstrip('/') if '.' in p.rsplit('/',1)[-1] else p.strip('/')+'/index.html')
  if target.exists() and target.stat().st_size>0:data=target.read_bytes()
  else:
   data=urllib.request.urlopen(BASE+p,timeout=15).read()
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  return p,data.decode('utf-8',errors='replace'),len(data)
 except Exception as e:return p,'',str(e)
queue=routes
for stage in range(8):
 queue=sorted(set(p for p in queue if p not in seen));seen.update(queue)
 if not queue:break
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex: results=list(ex.map(fetch,queue))
 queue=[]
 for p,content,size in results:
  records.append({'path':p,'bytes':size})
  if not content:continue
  paths=re.findall(r'(?:["\x27]|\\")(/(?:_next/static/[^"\x27\\\s<>]+|assets/[^"\x27\\\s<>]+|data/[^"\x27\\\s<>]+))',content)
  paths+=['/_next/'+x for x in re.findall(r'["\x27](static/immutable/chunks/[^"\x27]+)',content)]
  queue.extend(x for x in paths if not any(c in x for c in ['${','?']))
 print('stage',stage,'files',len(results),'next',len(set(queue)),flush=True)
(ROOT/'collection.json').write_text(json.dumps(records,indent=2),encoding='utf8')
