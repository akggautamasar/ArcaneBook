import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Question } from './QuizBuilder';

type Draft = { number: number; set: string; question: Question; answerFound: boolean; source: string; warning: string };
type PdfJs = { getDocument: (input: { data: Uint8Array; disableWorker: boolean }) => { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{str?:string;transform?:number[]}> }> }> }> } };
declare global { interface Window { pdfjsLib?: PdfJs } }

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
    if(answer){current.question.correctOptionIndex=letter(answer[1]);current.answerFound=true;explanation=false;continue;}
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
  const [message,setMessage]=useState('');
  const [selected,setSelected]=useState<Record<number,boolean>>({});
  const parse=()=>{const found=extract(raw,positive,negative);setDrafts(found);setSelected({});setMessage(found.length?`Found ${found.length} possible questions. Review before importing.`:'No questions recognized. Try text with numbered questions and (a)-(d) options.');};
  const readPdf=async(file:File)=>{
    setLoading(true);setMessage('Reading PDF text...');
    try{
      const pdfjs=await loadPdfJs();
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableWorker:true}).promise;
      const pages:string[]=[];
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i), items=(await page.getTextContent()).items;
        let previousY=Infinity, out='';
        for(const item of items){const y=item.transform?.[5]??0;if(previousY!==Infinity&&Math.abs(y-previousY)>3)out+='\n';out+=(item.str||'')+' ';previousY=y;}
        pages.push(out);
      }
      const text=pages.join('\n');
      setRaw(text);
      setMessage(text.trim().length<100?'This PDF appears scanned/image-only. Text extraction is unavailable here; Hindi OCR and diagram extraction require the upcoming server processing stage.':'PDF text extracted. Check line order, especially two-column pages, then select Detect Questions.');
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
      <label className="block rounded-xl border-2 border-dashed p-5 text-center cursor-pointer bg-slate-50">
        <span className="block font-semibold">Choose a PDF to extract text</span>
        <span className="block text-xs text-muted-foreground mt-1">Text PDFs first · Scanned Hindi books and diagrams require OCR support</span>
        <input className="mt-3 block w-full text-sm" type="file" accept="application/pdf,.pdf" disabled={loading} onChange={e=>{const f=e.target.files?.[0];if(f)void readPdf(f);}}/>
      </label>
      <p className="text-sm text-muted-foreground" role="status">{loading?'Processing pages…':message}</p>
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
