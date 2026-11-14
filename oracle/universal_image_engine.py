#!/usr/bin/env python3
"""ArcaneBook image-first PDF-to-mock engine.

No OCR rewriting: the source PDF pixels are shown. Native text is used only
for locating likely question and solution cuts. Uncertain items stay unscored.
No external services, no arbitrary code execution, no deletion of input PDF.
"""
from __future__ import annotations
import argparse
import html
import json
import re
import time
import uuid
from pathlib import Path
from collections import Counter
import pymupdf

Q_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*[.:-]?\s*)?(\d{1,4})\s*[.,।):]\s*(?=\S|$)", re.I)
ANSWER_RE = re.compile(r"(?i)^\s*(?:ans(?:wer)?\s*[.:]|correct\s+answer\s*[:.]|solution\s*[:.]|उत्तर\s*[:：])")
KEY_RE = re.compile(r"(?i)(?:ans(?:wer)?\s*[.:]|correct\s+answer\s*[:.]|उत्तर\s*[:：])\s*\(?\s*([a-d])\s*\)?(?:\s|$)")
OPTION_RE = re.compile(r"(?<!\w)\(([a-d])\)", re.I)
SUSPECT_RE = re.compile(r"(?<!\w)\(([0-9०-९])\)")
CHAPTER_RE = re.compile(r"chapter\s*[- ]?wise|topic\s*[- ]?wise|अध्यायवार|अध्याय\s*वार|विषयवार|अध्याय\s*[-–]\s*\d", re.I)
SETS_RE = re.compile(r"practice\s*sets?|model\s*papers?|mock\s*tests?|अभ्यास\s*सेट|प्रैक्टिस\s*सेट", re.I)
PAPERS_RE = re.compile(r"previous\s*year|exam\s*paper|year\s*wise|वर्षवार|पिछले\s*वर्ष", re.I)


def structure(doc):
    # Early pages generally contain a title/TOC; they outrank internal past-paper credits.
    header = '\n'.join(doc[i].get_text('text')[:8500] for i in range(min(10, len(doc))))
    if CHAPTER_RE.search(header): return 'chapters'
    if SETS_RE.search(header): return 'sets'
    if PAPERS_RE.search(header): return 'papers'
    return 'unknown'


def extract_lines(page, clip):
    # PyMuPDF frequently emits "Ans" and ": (b)" as separate lines at the
    # exact same baseline; coalesce physical rows before parsing boundaries.
    rows=[]
    raw=page.get_text('dict', clip=clip, sort=True)
    for block in raw['blocks']:
        for line in block.get('lines', []):
            spans=sorted(line['spans'],key=lambda s:s['bbox'][0])
            t=' '.join(s['text'].strip() for s in spans if s['text'].strip())
            if t:
                x0,y0,x1,y1=line['bbox']
                rows.append({'x':float(x0),'y':float(y0),'end_y':float(y1),'text':t})
    rows.sort(key=lambda l:(l['y'],l['x']))
    clusters=[]
    for row in rows:
        # Using a small tolerance keeps adjacent printed lines separate.
        # A sparse OCR line can be out of order; grouping is by geometry.
        group=next((g for g in reversed(clusters[-6:]) if abs(g['y']-row['y'])<4.0),None)
        if group is None:
            group={'y':row['y'],'end_y':row['end_y'],'pieces':[]}
            clusters.append(group)
        group['pieces'].append(row)
        group['end_y']=max(group['end_y'],row['end_y'])
    lines=[]
    for group in clusters:
        parts=sorted(group['pieces'],key=lambda l:l['x'])
        lines.append({'x':min(p['x'] for p in parts),'y':group['y'],'end_y':group['end_y'],
                      'text':' '.join(p['text'] for p in parts)})
    return sorted(lines,key=lambda l:(l['y'],l['x']))

def columns(page):
    w,h=page.rect.width,page.rect.height
    area=pymupdf.Rect(.055*w,.055*h,.95*w,.946*h)
    raw=extract_lines(page,area)
    # Only split if two distinct question-starting margins exist; normal prose
    # extending over the midpoint should not create a fake second column.
    starts=[l for l in raw if Q_RE.match(l['text'])]
    left=sum(l['x']<.43*w for l in starts)
    right=sum(l['x']>.48*w for l in starts)
    if left and right:
        return [('left',pymupdf.Rect(.055*w,.055*h,.495*w,.946*h)),
                ('right',pymupdf.Rect(.495*w,.055*h,.95*w,.946*h))]
    return [('full',area)]


def jpg(page,rect,destination,scale=0.95,quality=79):
    rect=rect & page.rect
    if rect.is_empty or rect.height<12:return False
    pix=page.get_pixmap(matrix=pymupdf.Matrix(scale,scale),clip=rect,alpha=False,colorspace=pymupdf.csRGB)
    pix.save(str(destination),output='jpeg',jpg_quality=quality)
    return True


def write_status(out, **changes):
    path=out/'status.json'
    current=json.loads(path.read_text()) if path.exists() else {}
    current.update(changes)
    temporary=out/'status.json.tmp'
    temporary.write_text(json.dumps(current,ensure_ascii=False),encoding='utf-8')
    temporary.replace(path)


def analyze(pdf,first=1,last=None):
    with pymupdf.open(pdf) as doc:
        if doc.needs_pass:raise ValueError('Password-protected PDFs are not supported')
        if not doc.page_count:raise ValueError('PDF has no pages')
        last=doc.page_count if last is None else int(last)
        if not (1<=first<=last<=doc.page_count):raise ValueError('Invalid page range')
        sampled=[]; scanned=0; qcounts=[]
        for page_number in sorted(set([first]+[min(last,first+i) for i in range(9)]+[last])):
            page=doc[page_number-1]
            words=len(page.get_text('words'))
            if words<12:scanned+=1
            qcounts.append(sum(1 for label,region in columns(page) for line in extract_lines(page,region) if Q_RE.match(line['text'])))
            sampled.append({'page':page_number,'words':words,'question_markers':qcounts[-1]})
        kind='scanned' if scanned>=len(sampled)*.7 else ('hybrid' if scanned else 'text')
        return {'pages':doc.page_count,'page_range':[first,last],'pdf_type':kind,'classification':structure(doc),
                'recommended_strategy':'image-first','images_preserved':True,'sample_details':sampled,
                'review_required':True,'sampled_questions':sum(qcounts),
                'warning':'Question boundary detection and answer keys may be uncertain. Unverified questions remain unscored.'}


def build(pdf,out,first=1,last=None,title='ArcaneBook Image Mock',progress=None):
    pdf,out=Path(pdf),Path(out)
    out.mkdir(parents=True,exist_ok=True)
    asset=out/'assets';asset.mkdir(exist_ok=True)
    with pymupdf.open(pdf) as doc:
        if doc.needs_pass:raise ValueError('Password-protected PDFs are not supported')
        total=doc.page_count
        last=total if last is None else int(last)
        first=int(first)
        if not (1<=first<=last<=total):raise ValueError('Invalid page range')
        if last-first+1>600:raise ValueError('Up to 600 pages can be processed per job')
        typ=structure(doc)
        items=[];fallback=0
        for page_num in range(first,last+1):
            page=doc[page_num-1];w,h=page.rect.width,page.rect.height
            for column,region in columns(page):
                lines=extract_lines(page,region)
                # Candidate starts must sit near the column's question-number gutter.
                threshold=region.x0+max(.1*w,35)
                starters=[(i,l) for i,l in enumerate(lines) if Q_RE.match(l['text']) and l['x']<=threshold]
                # Remove multiple OCR lines for the same physical question.
                starts=[]
                for index,line in starters:
                    if not starts or line['y']-starts[-1][1]['y']>16:
                        starts.append((index,line))
                if not starts:
                    # Unrecognized columns become review cards rather than lost text.
                    # Never pretend a whole page or column is one correctly parsed MCQ.
                    name=f'p{page_num:04d}-{column}-review.jpg'
                    if jpg(page,region,asset/name,scale=.74,quality=74):
                        fallback+=1
                        items.append({'id':f'p{page_num}-{column}-review','number':None,'page':page_num,
                                      'column':column,'kind':'page-review','question_image':'assets/'+name,
                                      'options_image':None,'solution_image':None,'answer':None,'scored':False,
                                      'issues':['no_reliable_question_boundaries'],'options_detected':0})
                    continue
                for index,(pos,start) in enumerate(starts):
                    next_y=starts[index+1][1]['y'] if index+1<len(starts) else region.y1
                    if next_y-start['y']<40:continue
                    inner=[l for l in lines if start['y']<=l['y']<next_y]
                    answer=next((l for l in inner if ANSWER_RE.match(l['text'])),None)
                    q_end=(answer['y'] if answer else next_y)
                    option_line=next((l for l in inner if
                        l['y']>start['y']+30 and l['y']<q_end-20 and
                        (OPTION_RE.search(l['text']) or SUSPECT_RE.search(l['text']))),None)
                    if q_end-start['y']<35:continue
                    marker=Q_RE.match(start['text'])
                    label=int(marker.group(1)) if marker else None
                    stem_text='\n'.join(l['text'] for l in inner if l['y']<q_end)
                    valid_options=OPTION_RE.findall(stem_text)
                    corrupted=SUSPECT_RE.findall(stem_text)
                    answer_text=' '.join(l['text'] for l in inner if answer and l['y']>=answer['y'])
                    keys=KEY_RE.findall(answer['text'] if answer else '')
                    # Only score if four *ordered distinct* options are identifiable,
                    # with no corrupted option labels, and one unambiguous answer.
                    valid=[x.lower() for x in valid_options]
                    safe=(valid==['a','b','c','d'] and not corrupted and len(keys)==1)
                    key=keys[0].lower() if safe else None
                    issues=[]
                    if not answer:issues.append('solution_boundary_not_found')
                    if valid!=['a','b','c','d']:issues.append('options_not_fully_verified')
                    if corrupted:issues.append('ocr_corrupt_option_labels')
                    if not keys:issues.append('answer_key_not_verified')
                    if next_y>=region.y1-3:issues.append('possible_page_or_column_continuation')
                    suffix=f'p{page_num:04d}-{column}-q{index+1:03d}'
                    question_file=f'{suffix}.jpg';solution_file=f'{suffix}-solution.jpg'
                    options_file=f'{suffix}-options.jpg'
                    options_image=None
                    # Separate the original options block without transcribing OCR.
                    question_end=option_line['y'] if option_line else q_end
                    if not jpg(page,pymupdf.Rect(region.x0,start['y']-4,region.x1,question_end-2),asset/question_file):continue
                    if option_line and jpg(page,pymupdf.Rect(region.x0,option_line['y']-3,region.x1,q_end-2),asset/options_file):
                        options_image='assets/'+options_file
                    solution=None
                    if answer and next_y-answer['y']>=15 and jpg(page,pymupdf.Rect(region.x0,answer['y']-2,region.x1,next_y-2),asset/solution_file):
                        solution='assets/'+solution_file
                    items.append({'id':f'p{page_num}-{column}-{index+1}','number':label,'page':page_num,
                                  'column':column,'kind':'question','question_image':'assets/'+question_file,
                                  'options_image':options_image,'solution_image':solution,'answer':key if solution else None,'scored':bool(key and solution),
                                  'options_detected':len(valid),'issues':issues})
            if progress:
                progress(page_num-first+1,last-first+1,len(items))
        if not items:raise ValueError('No usable page images could be generated')
        manifest={'version':1,'mode':'image-first','test_id':uuid.uuid4().hex,'title':str(title)[:160],
                  'pdf_type':analyze(pdf,first,last)['pdf_type'], 'classification':typ,
                  'source_pages':total,'selected_pages':[first,last],
                  'quality':{'cards':len(items),'questions':sum(x['kind']=='question' for x in items),
                             'review_pages':fallback,'scored':sum(x['scored'] for x in items),
                             'unscored':sum(not x['scored'] for x in items)},
                  'review_required':True,'scoring_policy':'Only OCR-clear A-D options and an unambiguous key are scored; otherwise unscored.',
                  'items':items}
        (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        (out/'index.html').write_text(viewer(manifest),encoding='utf-8')
        return manifest


def viewer(manifest):
    # Standalone HTML viewer uses adjacent assets; zip bundles both.
    payload=json.dumps(manifest,ensure_ascii=False).replace('</','<\\/')
    title=html.escape(manifest['title'])
    return '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>''' + title + '''</title>
<style>*,*:before,*:after{box-sizing:border-box}body{margin:0;font:16px system-ui,sans-serif;color:#eff6ff;background:#091322}header{background:#0f2039;border-bottom:1px solid #2a4662;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:clamp(18px,3vw,26px);margin:0}main{max-width:980px;padding:18px;margin:auto}.muted{color:#9bb3cb}#panel{border:1px solid #28445e;background:#111f33;border-radius:18px;padding:16px}img{max-width:100%;height:auto;display:block;margin:12px auto;border-radius:10px;background:#fff}button,select{font:inherit;border-radius:9px;padding:10px 15px;border:1px solid #345779;background:#162d49;color:#fff;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}button:hover:not(:disabled){background:#24476d}.primary{background:#087f8c;border-color:#119ca8}.choices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.choices button.chosen{background:#096a74;border-color:#28d4c7}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.notice{border:1px solid #a17c29;background:#302713;padding:12px;border-radius:10px;margin:12px 0;color:#ffe2a0}.hidden{display:none}#solution{margin-top:20px;border-top:1px solid #29435e;padding-top:14px}@media(max-width:520px){main{padding:10px}#panel{padding:10px}.choices button{padding:10px 5px}}</style></head>
<body><header><div><h1>''' + title + '''</h1><div class="muted">Image-first mock • original PDF screenshots • uncertainty preserved</div></div><div id="stats" class="muted"></div></header><main><div id="notice" class="notice"></div><div class="toolbar"><button id="prev">Previous</button><span id="position"></span><button class="primary" id="next">Next</button></div><div id="panel"><h2 id="heading"></h2><div class="muted" id="source"></div><img id="question" alt="Question from original PDF"><img id="optionsImage" alt="Answer options from original PDF"><p id="hint" class="muted"></p><div class="choices" id="choices"></div><p id="score"></p><button id="reveal">Show original solution image</button><div id="solution" class="hidden"><h3>Original solution / explanation</h3><img id="solutionImage" alt="Solution from original PDF"><p class="muted" id="noSolution"></p><div id="reviewbox" class="notice hidden"><strong>Manual answer verification</strong><p>Check the original solution image before assigning a key. Manual keys are saved only in this browser and are not automatically verified.</p><label>Correct option <select id="manualkey"><option value="">Unverified</option><option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option></select></label></div></div></div><div class="toolbar" style="margin-top:20px"><label>Jump to <select id="jump"></select></label><button id="reset">Clear choices</button><button id="exportKeys">Export reviewed keys</button><label>Import reviewed keys <input type="file" accept=".json,application/json" id="importKeys"></label></div></main>
<script type="application/json" id="data">''' + payload.replace('&','\\u0026').replace('<','\\u003c') + '''</script><script>
const data=JSON.parse(document.getElementById('data').textContent);const items=data.items;let index=0;const answers={};const store='arcanebook-reviewed-'+data.test_id;let reviewed={};try{reviewed=JSON.parse(localStorage.getItem(store)||'{}')}catch{};const saveReviewed=()=>{try{localStorage.setItem(store,JSON.stringify(reviewed))}catch{}};const $=id=>document.getElementById(id);function show(){const q=items[index],choice=answers[q.id],key=q.scored?q.answer:reviewed[q.id];$('heading').textContent=(q.kind==='page-review'?'Page review':`Question ${index+1}`);$('source').textContent=`Original PDF page ${q.page} • ${q.column} • ${q.scored?'OCR-clear source key':key?'manually reviewed key':'unscored / review required'}`;$('question').src=q.question_image;if(q.options_image){$('optionsImage').src=q.options_image;$('optionsImage').style.display='block'}else{$('optionsImage').removeAttribute('src');$('optionsImage').style.display='none'}$('position').textContent=`${index+1} / ${items.length}`;$('prev').disabled=index===0;$('next').disabled=index===items.length-1;$('choices').replaceChildren();if(q.kind==='question'){for(const o of ['a','b','c','d']){const b=document.createElement('button');b.textContent=o.toUpperCase();b.className=choice===o?'chosen':'';b.onclick=()=>{answers[q.id]=o;show()};$('choices').append(b)}}$('hint').textContent=q.kind==='page-review'?'Question boundaries could not be reliably identified on this page. Read the full page image; this is not scored.':key?'Select the option shown in the original PDF image.':'Uncertain source answer: practise unscored or verify the original solution manually.';$('score').textContent=choice?(key?(choice===key?'Correct':'Incorrect'):'Choice recorded, scoring unavailable') : '';$('solution').classList.add('hidden');$('noSolution').textContent='';$('solutionImage').removeAttribute('src');$('stats').textContent=`${Object.keys(answers).length} attempted · ${data.quality.scored} OCR-clear + ${Object.keys(reviewed).length} manually keyed / ${data.quality.cards} cards`;$('jump').value=String(index)}$('reveal').onclick=()=>{const q=items[index];$('solution').classList.remove('hidden');$('reviewbox').classList.toggle('hidden',q.kind!=='question'||q.scored);$('manualkey').value=reviewed[q.id]||'';if(q.solution_image){$('solutionImage').src=q.solution_image;$('solutionImage').style.display='block'}else{$('solutionImage').style.display='none';$('noSolution').textContent='A separate solution boundary was not found; refer to the source PDF page.'}};$('manualkey').onchange=e=>{const q=items[index];const val=e.target.value;if(val){reviewed[q.id]=val}else{delete reviewed[q.id]}saveReviewed();show();$('reveal').click()};$('exportKeys').onclick=()=>{const blob=new Blob([JSON.stringify({test_id:data.test_id,keys:reviewed},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='arcane-reviewed-answer-keys.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('importKeys').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const json=JSON.parse(await file.text());if(json.test_id!==data.test_id||!json.keys||typeof json.keys!=='object')throw Error('Keys belong to a different test');for(const q of items){const v=json.keys[q.id];if(!q.scored&&['a','b','c','d'].includes(v))reviewed[q.id]=v}saveReviewed();show()}catch(err){alert(String(err))}};$('prev').onclick=()=>{if(index>0)index--;show()};$('next').onclick=()=>{if(index<items.length-1)index++;show()};$('reset').onclick=()=>{for(const key of Object.keys(answers))delete answers[key];show()};$('jump').onchange=e=>{index=Number(e.target.value);show()};for(let i=0;i<items.length;i++){const o=document.createElement('option');o.value=String(i);o.textContent=`${i+1}. PDF p.${items[i].page} ${items[i].kind==='question'?'Question image':'Page review'}`;$('jump').append(o)}$('notice').textContent=`${data.quality.questions} question images, ${data.quality.review_pages} page-review images. ${data.quality.unscored} cards unscored due to uncertain boundaries/keys. Images are from the source PDF; verify accuracy before publishing.`;show();
</script></body></html>'''


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--pdf',required=True)
    ap.add_argument('--out-dir',required=True)
    ap.add_argument('--first',type=int,default=1)
    ap.add_argument('--last',type=int)
    ap.add_argument('--title',default='ArcaneBook Image Mock')
    ap.add_argument('--analyze',action='store_true')
    a=ap.parse_args()
    if a.analyze:
        print(json.dumps(analyze(a.pdf,a.first,a.last),ensure_ascii=False,indent=2))
    else:
        m=build(a.pdf,a.out_dir,a.first,a.last,a.title)
        print(json.dumps(m['quality']))

if __name__=='__main__':main()