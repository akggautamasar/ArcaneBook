import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Question } from './QuizBuilder';

type Draft = { number: number; set: string; question: Question; answerFound: boolean; source: string; warning: string };
type PdfJs = { getDocument: (input: { data: Uint8Array; disableWorker: boolean }) => { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<{ getViewport: (opts:{scale:number}) => {width:number;height:number}; render:(opts:{canvasContext:CanvasRenderingContext2D;viewport:{width:number;height:number}})=>{promise:Promise<void>}; getTextContent: () => Promise<{ items: Array<{str?:string;transform?:number[]}> }> }> }> } };
type OcrWorker = { recognize:(image:HTMLCanvasElement)=>Promise<{data:{text:string}}> ; terminate:()=>Promise<unknown> }; 
declare global { interface Window { pdfjsLib?: PdfJs; Tesseract?: { createWorker:(langs:string,mode?:number,options?:object)=>Promise<OcrWorker> } } }

function loadPdfJs(): Promise<PdfJs> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error('PDF reader unavailable'));
    script.onerror = () => reject(new Error('Could not load PDF reader; check internet access'));
    document.head.appendChild(script);
  });
}
async function loadOcr(): Promise<NonNullable<Window['Tesseract']>> {
  if(window.Tesseract) return window.Tesseract;
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library did not initialize'));
    script.onerror=()=>reject(new Error('Unable to load OCR library. Check internet access.'));
    document.head.appendChild(script);
  });
}
function renderCrop(canvas:HTMLCanvasElement, x:number, width:number):HTMLCanvasElement {
  const out=document.createElement('canvas');out.width=width;out.height=canvas.height;
  const ctx=out.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,out.height);ctx.drawImage(canvas,x,0,width,canvas.height,0,0,width,canvas.height);
  return out;
}
async function recognizeImages(files: File[], onProgress:(message:string)=>void):Promise<string> {
  const ocr=await loadOcr();
  onProgress('Loading Hindi and English OCR models…');
  const worker=await ocr.createWorker('hin+eng');
  const results:string[]=[];
  try {
    for(let index=0;index<files.length;index++){
      const file=files[index];
      onProgress(`Reading screenshot ${index+1} of ${files.length}: ${file.name}`);
      const bitmap=await createImageBitmap(file);
      try {
        const maxWidth=2200;
        const scale=Math.min(1,maxWidth/bitmap.width);
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(bitmap.width*scale);
        canvas.height=Math.round(bitmap.height*scale);
        const context=canvas.getContext('2d');
        if(!context)throw new Error('Image canvas unavailable');
        context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(bitmap,0,0,canvas.width,canvas.height);
        // OCR the left and right columns independently on landscape / wide pages.
        const twoColumns=canvas.width/canvas.height>0.72 && canvas.width>=950;
        if(twoColumns){
          const half=Math.floor(canvas.width/2);
          const left=await worker.recognize(renderCrop(canvas,0,half));
          const right=await worker.recognize(renderCrop(canvas,half,canvas.width-half));
          results.push(left.data.text+'\\n'+right.data.text);
        }else{
          const result=await worker.recognize(canvas);
          results.push(result.data.text);
        }
      }finally{bitmap.close();}
    }
    return results.join('\\n');
  }finally{await worker.terminate();}
}
const OCR_SERVICE = 'https://arcanebook-ocr.onrender.com';
async function serverExtract(file:File, pages:string, columns:string):Promise<string> {
  const data=new FormData();
  data.append('file',file);
  data.append('pages',pages);
  data.append('columns',columns);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),180000);
  try{
    const response=await fetch(OCR_SERVICE+'/extract',{method:'POST',body:data,signal:controller.signal});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.detail||'OCR service error');
    if(typeof payload.text!=='string')throw new Error('Invalid OCR response');
    return payload.text;
  }finally{clearTimeout(timeout);}
}
function extract(text: string, positive: number, negative: number): Draft[] {
  const lines = text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
  const drafts: Draft[] = [];
  const keys = new Map<string, Map<number, number>>();
  let set = 'Practice Set 1', section = 'questions', current: Draft | null = null, explanation = false;
  const setMatch = (s: string) => s.match(/(?:practice\s*set|प्रैक्टिस\s*सेट|अभ्यास\s*सेट)\s*[-:–]?\s*(\d+)/i);
  const optionMatch = (s: string) => s.match(/^\(?([a-dA-D])\)?[.)]\s*(.+)$/);
  const answerMatch = (s: string) => s.match(/^(?:answer|ans|correct\s*answer|उत्तर|सही\s*उत्तर)\s*[:：.-]?\s*\(?([a-dA-D])\)?\b/i);
  const explanationMatch = (s: string) => s.match(/^(?:explanation|solution|व्याख्या|समाधान|हल)\s*[:：.-]?\s*(.*)/i);
  const letter = (s: string) => s.toLowerCase().charCodeAt(0)-97;
  const keyFor = (name: string) => { if(!keys.has(name)) keys.set(name,new Map()); return keys.get(name)!; };
  for(const line of lines) {
    const sm = setMatch(line);
    if(sm){set='Practice Set '+sm[1];section='questions';current=null;explanation=false;continue;}
    if(/^(?:answer\s*key|उत्तर\s*कुंजी|उत्तरमाला)/i.test(line)){section='key';current=null;continue;}
    if(/^(?:solutions?\s*[:：-]?|विस्तृत\s*हल)/i.test(line)){section='solutions';current=null;continue;}
    if(section==='key'){
      const entries=[...line.matchAll(/(?:^|\s)(\d{1,3})\s*[.)-]?\s*\(?([a-dA-D])\)?(?=\s|$|[,;])/g)];
      entries.forEach(m=>keyFor(set).set(Number(m[1]),letter(m[2])));
      continue;
    }
    if(section==='solutions'){
      const match=line.match(/^(\d{1,3})\s*[.)]\s*(?:\(?([a-dA-D])\)?\s*[.)-]?)?\s*(.*)/);
      if(match){current=drafts.find(d=>d.set===set&&d.number===Number(match[1]))||null; if(current&&match[2]){current.question.correctOptionIndex=letter(match[2]);current.answerFound=true;} if(current&&match[3])current.question.explanation+=match[3]+' ';continue;}
      if(current)current.question.explanation+=line+' ';
      continue;
    }
    const q=line.match(/^(\d{1,3})\s*[.)]\s*(.+)$/);
    if(q){current={number:Number(q[1]),set,source:line,answerFound:false,warning:'',question:{id:crypto.randomUUID(),questionText:q[2],options:[],correctOptionIndex:0,explanation:'',section:set,positiveMarks:positive,negativeMarks:negative,compText:''}};drafts.push(current);explanation=false;continue;}
    if(!current)continue;
    const answer=answerMatch(line);
    if(answer){current.question.correctOptionIndex=letter(answer[1]);current.answerFound=true;explanation=true;const remainder=line.slice(answer[0].length).replace(/^[\\s:.)-]+/,'');if(remainder)current.question.explanation+=remainder+' ';continue;}
    const exp=explanationMatch(line);
    if(exp){explanation=true;current.question.explanation+=exp[1]+' ';continue;}
    const option=optionMatch(line);
    if(option&&!explanation){const index=letter(option[1]);if(index===current.question.options.length)current.question.options.push(option[2]);else current.warning='Options may be misordered';continue;}
    if(explanation)current.question.explanation+=line+' ';
    else if(current.question.options.length)current.question.options[current.question.options.length-1]+=' '+line;
    else current.question.questionText+=' '+line;
  }
  for(const d of drafts){
    const key=keyFor(d.set).get(d.number);
    if(key!==undefined){if(d.answerFound&&d.question.correctOptionIndex!==key)d.warning='Inline answer conflicts with answer key';else{d.question.correctOptionIndex=key;d.answerFound=true;}}
    if(d.question.options.length!==4)d.warning=[d.warning,'Expected four options; verify against source PDF'].filter(Boolean).join('; ');
    if(!d.answerFound)d.warning=[d.warning,'Answer not found — review required'].filter(Boolean).join('; ');
    if(!d.question.explanation.trim())d.warning=[d.warning,'Explanation not found'].filter(Boolean).join('; ');
  }
  return drafts;
}

export function PdfQuestionImport({ onImport, positive, negative }: { onImport:(questions:Question[])=>void; positive:number; negative:number }) {
  const [raw,setRaw]=useState('');
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [loading,setLoading]=useState(false);
  const [ocrProgress,setOcrProgress]=useState('');
  const [processingMode,setProcessingMode]=useState<'server'|'device'>('server');
  const [columns,setColumns]=useState<'auto'|'one'|'two'>('auto');
  const [ocrEnabled,setOcrEnabled]=useState(true);
  const [images,setImages]=useState<File[]>([]);
  const [appendText,setAppendText]=useState(false);
  const [startPage,setStartPage]=useState(1);
  const [pdfFile,setPdfFile]=useState<File|null>(null);
  const [totalPages,setTotalPages]=useState<number|null>(null);
  const [pageMode,setPageMode]=useState<'range'|'list'|'all'>('range');
  const [pageList,setPageList]=useState('1,2,3');
  const [pageCount,setPageCount]=useState(3);
  const [message,setMessage]=useState('');
  const [selected,setSelected]=useState<Record<number,boolean>>({});
  const parse=()=>{const found=extract(raw,positive,negative);setDrafts(found);setSelected({});setMessage(found.length?`Found ${found.length} possible questions. Review before importing.`:'No questions recognized. Try text with numbered questions and (a)-(d) options.');};
  const readImages=async()=>{
    if(!images.length)return;
    setLoading(true);setDrafts([]);
    try{
      let text='';
      if(processingMode==='server'){
        const chunks:string[]=[];
        for(const [index,file] of images.entries()){
          setMessage(`Server OCR: screenshot ${index+1} of ${images.length}…`);
          chunks.push(await serverExtract(file,'1',columns));
        }
        text=chunks.join('\\n');
      }else{
        text=await recognizeImages(images,setMessage);
      }
      setRaw(previous=>appendText&&previous.trim()?previous+'\\n'+text:text);
      setMessage(`Processed ${images.length} screenshot(s). Review the OCR text, then detect questions and answers. Missing figures require manual handling.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Unable to process screenshots');}
    finally{setLoading(false);}
  };
  const readPdf=async(file:File)=>{
    setLoading(true);setMessage('Reading PDF text...');
    try{
      if(processingMode==='server'){
        let pages='1-10';
        if(pageMode==='range')pages=`${startPage}-${startPage+pageCount-1}`;
        if(pageMode==='list')pages=pageList;
        setMessage('Sending selected pages to OCR server. First request may take longer while free service starts…');
        const text=await serverExtract(file,pages,columns);
        setRaw(previous=>appendText&&previous.trim()?previous+'\\n'+text:text);
        setMessage('Server extraction complete. Review the text and detect questions.');
        return;
      }
      const pdfjs=await loadPdfJs();
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableWorker:true}).promise;
      setTotalPages(pdf.numPages);
      const pages:string[]=[];
      let selectedPages:number[]=[];
      if(pageMode==='range'){
        const begin=Math.min(Math.max(1,startPage),pdf.numPages);
        const end=Math.min(pdf.numPages,begin+Math.min(10,Math.max(1,pageCount))-1);
        selectedPages=Array.from({length:end-begin+1},(_,i)=>begin+i);
      }else if(pageMode==='all'){
        selectedPages=Array.from({length:Math.min(pdf.numPages,10)},(_,i)=>i+1);
      }else{
        const chosen=new Set<number>();
        for(const token of pageList.split(',')){
          const trimmed=token.trim();
          if(!trimmed)continue;
          const match=trimmed.match(/^(\\d+)(?:\\s*-\\s*(\\d+))?$/);
          if(!match)throw new Error('Invalid page list. Use 2,4,7-9.');
          const first=Number(match[1]),last=match[2]?Number(match[2]):first;
          if(first<1||last<first||last>pdf.numPages)throw new Error(`Pages must be between 1 and ${pdf.numPages}.`);
          if(last-first>100)throw new Error('Choose a smaller page range.');
          for(let n=first;n<=last;n++)chosen.add(n);
        }
        selectedPages=Array.from(chosen).sort((a,b)=>a-b);
        if(!selectedPages.length||selectedPages.length>10)throw new Error('Select between 1 and 10 pages per batch.');
      }
      let worker:OcrWorker|undefined;
      try{
        for(const [index,i] of selectedPages.entries()){
          setMessage(`Processing selected page ${index+1} of ${selectedPages.length} (PDF page ${i})…`);
          const page=await pdf.getPage(i), items=(await page.getTextContent()).items;
          let previousY=Infinity, out='';
          for(const item of items){const y=item.transform?.[5]??0;if(previousY!==Infinity&&Math.abs(y-previousY)>3)out+='\\n';out+=(item.str||'')+' ';previousY=y;}
          if(out.replace(/\\s/g,'').length<80&&ocrEnabled){
            if(!worker){const tesseract=await loadOcr();setMessage('Downloading Hindi + English OCR language data (first run may take time)…');worker=await tesseract.createWorker('hin+eng');}
            const viewport=page.getViewport({scale:2.5});
            const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas rendering unsupported');
            await page.render({canvasContext:ctx,viewport}).promise;
            // Two-column books must be read left-to-right by column, not across both columns.
            const half=Math.floor(canvas.width/2);
            const left=await worker.recognize(renderCrop(canvas,0,half));
            const right=await worker.recognize(renderCrop(canvas,half,canvas.width-half));
            out=left.data.text+'\\n'+right.data.text;
          }
          pages.push('\\n'+out);
        }
      }finally{if(worker)await worker.terminate();}
      const text=pages.join('\\n');
      setRaw(previous=>appendText&&previous.trim()?previous+'\\n'+text:text);
      setMessage(text.trim().length<100?'No usable text detected. Try OCR and choose question pages rather than cover pages.':'Text ready. Inspect OCR accuracy and reading order, then select Detect Questions. Diagrams still require manual verification.');
    }catch(err){setMessage(err instanceof Error?err.message:'Unable to read PDF');}
    finally{setLoading(false);}
  };
  const update=(index:number, patch:Partial<Question>, answerFound?:boolean)=>{
    setDrafts(prev=>prev.map((d,i)=>i===index?{...d,question:{...d.question,...patch},answerFound:answerFound??d.answerFound}:d));
  };
  const importApproved=()=>{
    const accepted=drafts.filter((d,i)=>selected[i]&&d.answerFound&&d.question.options.length===4&&d.question.options.every(Boolean)&&d.question.questionText.trim());
    onImport(accepted.map(d=>d.question));setMessage(`Imported ${accepted.length} reviewed questions. Unverified answers were excluded.`);
  };
  return <Card className="w-full min-w-0">
    <CardHeader><CardTitle>PDF to Mock Test — Review Import</CardTitle><CardDescription>Supports answers immediately after questions, answer keys after a complete set, and separately numbered solutions. Review every result before publishing.</CardDescription></CardHeader>
    <CardContent className="space-y-4 min-w-0">
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">Processing engine</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={processingMode==='server'} onChange={()=>setProcessingMode('server')}/> Fast server OCR (recommended)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={processingMode==='device'} onChange={()=>setProcessingMode('device')}/> On-device OCR (backup)</label>
        </div>
        <label className="block text-sm">Page layout
          <select className="block mt-1 rounded-md border p-2 w-full max-w-sm" value={columns} onChange={e=>setColumns(e.target.value as 'auto'|'one'|'two')}>
            <option value="auto">Automatic column detection</option>
            <option value="one">Single column</option>
            <option value="two">Two columns (left then right)</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Server mode uploads selected source files to ArcaneBook OCR on Render. Device mode processes locally. Server OCR may have a cold-start delay on the free plan.</p>
      </div>
      <label className="block rounded-xl border-2 border-dashed p-5 text-center cursor-pointer bg-slate-50">
        <span className="block font-semibold">Upload scanned or text PDF</span>
        <span className="block text-xs text-muted-foreground mt-1">Hindi + English OCR for scanned pages · Two-column reading · Process 1–10 pages at a time</span>
        <input className="mt-3 block w-full text-sm" type="file" accept="application/pdf,.pdf" disabled={loading} onChange={e=>{const f=e.target.files?.[0];if(f){setPdfFile(f);setTotalPages(null);setMessage(`Selected ${f.name}. Choose pages below, then press Scan selected PDF pages.`);}}}/>
      </label>
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">Choose which PDF pages to scan</h3>
        {totalPages!==null&&<p className="text-sm text-muted-foreground">PDF contains {totalPages} pages.</p>}
        <div className="flex flex-wrap gap-3 text-sm">
          {([{value:'range',label:'Start page + number of pages'},{value:'list',label:'Specific pages'},{value:'all',label:'First 10 pages'}] as const).map(mode=><label key={mode.value} className="flex items-center gap-2"><input type="radio" name="pdf-page-mode" checked={pageMode===mode.value} onChange={()=>setPageMode(mode.value)}/>{mode.label}</label>)}
        </div>
        {pageMode==='range'&&<div className="flex flex-wrap gap-3">
          <label className="text-sm">Start page <input className="block w-28 rounded border p-2" type="number" min="1" value={startPage} onChange={e=>setStartPage(Math.max(1,Number(e.target.value)||1))}/></label>
          <label className="text-sm">How many pages? <input className="block w-28 rounded border p-2" type="number" min="1" max="10" value={pageCount} onChange={e=>setPageCount(Math.min(10,Math.max(1,Number(e.target.value)||1)))}/></label>
        </div>}
        {pageMode==='list'&&<label className="block text-sm">Pages (e.g. 2, 5, 8-10)<input className="mt-1 block w-full rounded border p-2" value={pageList} onChange={e=>setPageList(e.target.value)} placeholder="2,5,8-10"/></label>}
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={ocrEnabled} onChange={e=>setOcrEnabled(e.target.checked)}/> Enable Hindi/English OCR for scanned pages</label>
        <p className="text-xs text-muted-foreground">Maximum 10 PDF pages per batch to reduce mobile memory usage. Repeat batches and enable Append to existing extracted text to combine question pages with later answer pages.</p>
        <Button type="button" disabled={loading||!pdfFile} onClick={()=>{if(pdfFile)void readPdf(pdfFile);}}>Scan selected PDF pages</Button>
      </div>
      <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
        <div><h3 className="font-semibold">Import screenshots or photographed pages</h3><p className="text-xs text-muted-foreground">Select multiple JPG, PNG, or WebP images. Arrange them in reading order by filename before selecting. Supports inline answers and separate answer-key screenshots.</p></div>
        <input aria-label="Choose book page images" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={loading} className="block w-full text-sm" onChange={event=>setImages(Array.from(event.target.files||[]).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).slice(0,12))}/>
        {images.length>0&&<div className="text-xs text-slate-700">Selected: {images.map(file=>file.name).join(', ')}</div>}
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={appendText} onChange={event=>setAppendText(event.target.checked)}/> Append to existing extracted text (for separate answer pages)</label>
        <Button type="button" disabled={loading||images.length===0} onClick={()=>void readImages()}>Extract questions from {images.length||''} image{images.length===1?'':'s'}</Button>
      </div>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message || (loading?'Processing pages…':'Ready')}</p>
      <Textarea className="min-h-48 font-mono text-xs" value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Extracted PDF text appears here. You can also paste corrected OCR text. Include numbered questions, (a)-(d) options, inline Answer:/Explanation: or a separate ANSWER KEY."/>
      <Button disabled={loading||!raw.trim()} onClick={parse}>Detect questions and answers</Button>
      {drafts.length>0&&<div className="space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2"><strong>{drafts.length} candidates · {drafts.filter(d=>d.answerFound&&d.question.options.length===4).length} with answers and four options</strong><Button onClick={importApproved} disabled={!drafts.some((d,i)=>selected[i]&&d.answerFound&&d.question.options.length===4)}>Import selected verified questions</Button></div>
        {drafts.map((d,i)=><div key={d.question.id} className="rounded-xl border p-3 space-y-2 min-w-0">
          <label className="flex gap-2 items-center text-sm font-semibold"><input type="checkbox" checked={!!selected[i]} disabled={!d.answerFound||d.question.options.length!==4} onChange={e=>setSelected(prev=>({...prev,[i]:e.target.checked}))}/>{d.set} · Question {d.number}</label>
          {d.warning&&<p className="text-xs text-amber-700">{d.warning}</p>}
          <Textarea value={d.question.questionText} onChange={e=>update(i,{questionText:e.target.value})} aria-label="Question text"/>
          {d.question.options.map((option,j)=><input key={j} className="w-full min-w-0 rounded-md border p-2 text-sm" aria-label={`Option ${j+1}`} value={option} onChange={e=>update(i,{options:d.question.options.map((v,k)=>j===k?e.target.value:v)})}/>)}
          <label className="block text-sm">Correct answer <select className="ml-2 rounded border p-2" value={d.answerFound?d.question.correctOptionIndex:'unknown'} onChange={e=>update(i,{correctOptionIndex:Number(e.target.value)},true)}><option value="unknown" disabled>Not found</option>{d.question.options.map((_,j)=><option key={j} value={j}>{String.fromCharCode(65+j)}</option>)}</select></label>
          <Textarea placeholder="Explanation (optional)" value={d.question.explanation} onChange={e=>update(i,{explanation:e.target.value})}/>
        </div>)}
      </div>}
    </CardContent>
  </Card>;
}
