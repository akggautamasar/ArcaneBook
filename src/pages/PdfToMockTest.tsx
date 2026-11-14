import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, FileUp, Loader2, Download, Play } from "lucide-react";

const API = "";
type SmartAnalysis = {pages:number;pdf_type:string;classification:string;confidence:string;recommended_strategy:string;supported_automatic_conversion:boolean;sampled_pages:number[];question_pages_sampled:number[];answer_pages_sampled:number[];warnings:string[];};
type Job = { id?: string; job_id?: string; status?: string; error?: string; message?: string; detail?: string; question_count?: number; questions?: number; progress?: number; phase?: string; quality?: {cards:number;questions:number;review_pages:number;scored:number;unscored:number}; review_required?: boolean };
export default function PdfToMockTest({ embedded = false }: { embedded?: boolean }) {
  const [pdf, setPdf] = useState<File | null>(null);
  const { isAuthenticated } = useAuth();
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  useEffect(() => { fetch("/api/converter-settings", {credentials:"same-origin"}).then(r=>r.json()).then(v=>setPublicEnabled(v.publicEnabled===true)).catch(()=>{}); }, []);
  async function updatePublic(enabled: boolean) { setSettingsError(""); try { const r=await fetch("/api/converter-settings",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({publicEnabled:enabled})}); if(!r.ok)throw Error("Unable to update access setting"); const j=await r.json();setPublicEnabled(j.publicEnabled===true); } catch(e) {setSettingsError(e instanceof Error?e.message:String(e));} }
  const [config, setConfig] = useState('{"title":"My Mock Test","mode":"papers","papers":[{"name":"Paper 1","pages":[1,10]}]}');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [title, setTitle] = useState('My Mock Test');
  const [mode, setMode] = useState<'universal'|'papers'|'chapters'|'scanned-dda'>('universal');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(10);
  const [allPages, setAllPages] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [preview, setPreview] = useState("");
  const [noAnswers, setNoAnswers] = useState(false);
  const [htmlUrl, setHtmlUrl] = useState("");
  const [zipUrl, setZipUrl] = useState("");
  const [reviewRequired, setReviewRequired] = useState(false);
  const [analysis, setAnalysis] = useState<SmartAnalysis | null>(null);
  async function sendPdf(action: 'probe'|'jobs'|'analyze'|'universal/jobs', parsed?: Record<string,unknown>): Promise<Response> {
    if (!pdf) throw new Error('Choose a PDF first');
    // Small uploads keep the simple multipart path; large uploads use individually retried chunks.
    if (pdf.size <= 1024 * 1024) {
      const data=new FormData();data.append('file',pdf);
      if (action==='jobs')data.append('config',JSON.stringify(parsed));
      setPhase('Uploading PDF');setProgress(0);
      return fetch('/api/'+action,{method:'POST',body:data,credentials:'same-origin'});
    }
    setPhase('Preparing resumable upload');setProgress(0);
    const init=await fetch('/api/upload/init',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({size:pdf.size})});
    const info=await init.json();
    if(!init.ok)throw new Error(info.error||'Unable to start upload');
    const id=String(info.id);
    const chunkSize=Number(info.chunkSize)||1024*1024;
    let offset=0;
    try {
      while(offset<pdf.size){
        const end=Math.min(offset+chunkSize,pdf.size);
        let completed=false;
        for(let attempt=0;attempt<5&&!completed;attempt++){
          try{
            const res=await fetch('/api/upload/'+encodeURIComponent(id)+'/chunk',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-Upload-Offset':String(offset)},body:pdf.slice(offset,end)});
            if(!res.ok)throw new Error('Chunk upload HTTP '+res.status);
            const result=await res.json();
            if(result.received!==end)throw new Error('Upload offset mismatch');
            offset=end;completed=true;
            setProgress(Math.round(offset/pdf.size*100));setPhase('Uploading PDF');
          }catch(e){
            const check=await fetch('/api/upload/'+encodeURIComponent(id)+'/status',{credentials:'same-origin'}).catch(()=>null);
            if(check?.ok){
              const status=await check.json();
              if(status.received===end){offset=end;completed=true;setProgress(Math.round(offset/pdf.size*100));break;}
              if(status.received!==offset)throw new Error('Upload state changed; please retry');
            }
            if(attempt===4)throw new Error('Network interrupted repeatedly while uploading. '+(e instanceof Error?e.message:''));
            await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
          }
        }
      }
      setPhase('Processing PDF on server');
      return await fetch('/api/upload/'+encodeURIComponent(id)+'/finish',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,config:parsed})});
    }catch(e){
      await fetch('/api/upload/'+encodeURIComponent(id)+'/cancel',{method:'POST',credentials:'same-origin'}).catch(()=>{});
      throw e;
    }
  }
  async function readError(res: Response): Promise<string> {
    const body=await res.text();
    try{const j=JSON.parse(body);return String(j.detail||j.error||j.message||body);}catch{return body.slice(0,400)||'Request failed (HTTP '+res.status+')';}
  }
  async function upload() {
    if (!pdf || (!isAuthenticated && !publicEnabled)) return;
    setBusy(true); setError(""); setJob(null); setHtmlUrl(""); setZipUrl(""); setReviewRequired(false);setProgress(0);
    try {
      const parsed = mode === 'universal' ? {title,mode:'universal',start_page:allPages?1:startPage,end_page:allPages?0:endPage,preserveImages:true,flagUncertainAnswers:true} : advanced && mode !== 'scanned-dda' ? JSON.parse(config) : mode === 'scanned-dda' ? {title,mode,papers:[{name:'Practice Set 1',pages:[startPage,endPage]}]} : {title,mode,[mode]:[{name:mode==='papers'?'Paper 1':'Chapter 1',pages:[startPage,endPage]}]};
      if (mode === 'scanned-dda' && !isAuthenticated) throw new Error('Scanned DDA conversion is administrator-only.');
      if (mode === 'scanned-dda' && pdf.size > 100 * 1024 * 1024) throw new Error('Scanned DDA PDF must be 100 MiB or smaller.');
      if(!(mode === 'universal' && allPages) && (!Number.isInteger(startPage)||!Number.isInteger(endPage)||startPage<1||endPage<startPage))throw new Error('Enter a valid page range');
      if (mode !== "universal" && !Array.isArray(parsed.papers) && !Array.isArray(parsed.chapters)) throw new Error("Configure papers or chapters with page ranges.");
      const res = await sendPdf(mode === 'universal' ? 'universal/jobs' : 'jobs',parsed);
      if(!res.ok)throw new Error(await readError(res));
      const result: Job = await res.json();
      const id = result.id || result.job_id;
      if (!id) throw new Error("Backend did not return a job ID");
      setJob(result);
      setPhase('Generating interactive mock test');
      let finished=false;
      for (let i=0;i<(mode==='universal'?900:180);i++) {
        await new Promise(r=>setTimeout(r,2000));
        const jobPath = API + (mode === 'universal' ? '/api/universal/jobs/' : '/api/jobs/') + encodeURIComponent(id);
        const poll = await fetch(jobPath, {credentials:"same-origin"});
        if (!poll.ok) throw new Error("Unable to check conversion progress");
        const status: Job = await poll.json(); setJob(status);
        if (typeof status.progress === 'number') setProgress(status.progress);
        if (status.phase) setPhase(status.phase);
        if (status.status === "review_required") { setReviewRequired(true); finished=true; break; }
        if (["done","completed","success"].includes(status.status || "")) {
          if (mode !== "universal" && endPage-startPage>=5 && typeof (status.question_count ?? status.questions) === "number" && (status.question_count ?? status.questions ?? 0)<2) throw new Error("Old converter extracted too few questions; use Universal image-first for this PDF.");
          setHtmlUrl(jobPath + "/html");
          if (mode === "universal") setZipUrl(jobPath + "/zip");
          finished=true; break;
        }
        if (["error","failed","failed_review_required"].includes(status.status || "")) throw new Error(status.error || status.message || status.detail || "Conversion failed. Check converter job logs.");
      }
      if(!finished)throw new Error('Conversion is taking too long. Check the server job status.');
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false);setPhase(''); }
  }
  async function openResult(download: boolean) {
    if (!htmlUrl) return;
    try {
      if (zipUrl) {
        if (download) { const a=document.createElement('a'); a.href=zipUrl; a.download='ArcaneBook-image-mock.zip';document.body.appendChild(a);a.click();a.remove(); }
        else window.open(htmlUrl,'_blank','noopener,noreferrer');
        return;
      }
      const response = await fetch(htmlUrl, {credentials:"same-origin"});
      if (!response.ok) throw new Error("Unable to retrieve generated HTML");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (download) { const a = document.createElement("a"); a.href = url; a.download = "arcane-mock-test.html"; a.click(); }
      else window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  async function analyzePdf() {
    if (!pdf || !isAuthenticated) return;
    setBusy(true);setError('');setAnalysis(null);
    try {
      const res=await sendPdf('analyze');
      if(!res.ok)throw new Error(await readError(res));
      const report:SmartAnalysis=await res.json();
      setAnalysis(report);
      setMode('universal');
      setStartPage(1);setEndPage(report.pages);setAllPages(true);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);setPhase('');}
  }
  async function probe() {
    if (!pdf || (!isAuthenticated && !publicEnabled)) return;
    setBusy(true); setError("");
    try {
      const res = await sendPdf('probe');
      const result = await res.text();
      if (!res.ok) throw new Error(result);
      setPreview(result);
      setNoAnswers(/answer lines found on 0 pages|total 0/i.test(result));
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false);setPhase(''); }
  }
  return <main className={embedded ? "rounded-xl bg-slate-50 text-slate-900" : "min-h-screen bg-slate-50 text-slate-900"}>
    {!embedded && <header className="bg-gradient-to-r from-slate-950 to-indigo-900 text-white p-6">
      <div className="max-w-4xl mx-auto"><Link to="/mock-tests" className="inline-flex items-center gap-2 text-indigo-200"><ArrowLeft size={18}/> Mock Test Library</Link>
      <h1 className="text-3xl font-bold mt-5">PDF to Mock Test</h1><p className="text-indigo-100 mt-2">Automatically detect PDF layouts and preserve original question, option and solution images.</p></div>
    </header>}
    <section className="max-w-4xl mx-auto p-5 space-y-5">
      {isAuthenticated && <div className="rounded-xl border bg-white p-4 flex flex-wrap justify-between items-center gap-3"><div><strong>Public PDF converter</strong><p className="text-xs text-slate-500">Off by default. Only admin can convert when off.</p></div><label className="flex items-center gap-2"><input type="checkbox" checked={publicEnabled} onChange={e=>updatePublic(e.target.checked)} />{publicEnabled?"Public enabled":"Admin only"}</label>{settingsError && <p role="alert" className="text-red-700">{settingsError}</p>}</div>}
      {!isAuthenticated && !publicEnabled && <p role="alert" className="rounded-lg bg-amber-50 p-4">Converter is currently admin-only. Please sign in as administrator.</p>}

      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <label className="font-semibold block" htmlFor="pdf-upload">1. Upload any question-bank or solved-paper PDF</label>
        <input id="pdf-upload" type="file" accept=".pdf,application/pdf" className="block w-full" onChange={e=>setPdf(e.target.files?.[0] || null)}/>
        <p className="text-sm text-slate-500">Universal image-first mode (administrator only) preserves questions, drawings, options and explanations as original PDF images. It creates unscored page-review cards where boundaries cannot be detected. Legacy text modes remain available to permitted users.</p>
        {isAuthenticated && <button disabled={!pdf || busy} onClick={analyzePdf} className="mr-3 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Smart analyze PDF</button>}
        <button disabled={!pdf || busy || mode === 'scanned-dda' || (!isAuthenticated && !publicEnabled)} onClick={probe} className="rounded-lg border px-4 py-2 disabled:opacity-50">Inspect PDF layout</button>
        {noAnswers && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No answer key was detected. Universal image-first can still create unscored image-based practice cards, but cannot safely assign correct options.</p>}
        {preview && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">{preview}</pre>}
      </div>
      {analysis && <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm space-y-3" role="status"><h3 className="font-bold text-lg">Smart PDF analysis</h3><div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Document:</strong> {analysis.pdf_type}</p><p><strong>Detected structure:</strong> {analysis.classification}</p><p><strong>Confidence:</strong> {analysis.confidence}</p><p><strong>Suggested engine:</strong> {analysis.recommended_strategy}</p><p><strong>Total pages:</strong> {analysis.pages}</p><p><strong>Pages inspected:</strong> {analysis.sampled_pages.join(", ")}</p></div><p className="text-sm text-slate-600">Sampled question pages: {analysis.question_pages_sampled.join(", ") || "not identified"}. Sampled answer pages: {analysis.answer_pages_sampled.join(", ") || "not identified"}.</p>{analysis.warnings.map((w,i)=><p key={i} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{w}</p>)}<p className="text-xs text-slate-500">Analysis is a recommendation, not a verified extraction. Confirm paper boundaries and answer keys before generating or publishing.</p></div>}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
        {mode === "scanned-dda" && <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Experimental DDA-style OCR</strong><p className="mt-1">Supports one 120-question DDA-style practice set per job, with an answer table on the next PDF page. This is not general scanned-PDF support. Extracted answers may be wrong; results require review and cannot be downloaded through the normal completed-test endpoint.</p></div>}
        <label htmlFor="pdf-config" className="font-semibold block">2. Configure paper or chapter ranges</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Test title<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="text-sm font-medium">Group by<select value={mode} onChange={e=>setMode(e.target.value as 'universal'|'papers'|'chapters'|'scanned-dda')} className="mt-1 w-full rounded-lg border p-3"><option value="universal" disabled={!isAuthenticated}>Auto — image-first (admin only)</option><option value="papers">Papers (legacy text)</option><option value="chapters">Chapters (text PDF)</option>{isAuthenticated && <option value="scanned-dda">Scanned DDA practice set (OCR · beta)</option>}</select></label>
          {mode === 'universal' && <label className="col-span-full flex items-center gap-2 rounded-lg bg-teal-50 p-3 text-sm font-medium text-teal-950"><input type="checkbox" checked={allPages} onChange={e=>setAllPages(e.target.checked)} /> Automatically convert the entire PDF (recommended)</label>}
          {(mode !== 'universal' || !allPages) && <>
          <label className="text-sm font-medium">Start page<input type="number" min={1} value={startPage} onChange={e=>setStartPage(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="text-sm font-medium">End page<input type="number" min={1} value={endPage} onChange={e=>setEndPage(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-3" /></label>
          </>}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={mode === "scanned-dda" || mode === "universal"} checked={advanced && mode !== "scanned-dda" && mode !== "universal"} onChange={e=>setAdvanced(e.target.checked)} /> Advanced (legacy engines): edit JSON for multiple papers/chapters</label>
        {advanced && mode !== "scanned-dda" && mode !== "universal" && <textarea id="pdf-config" value={config} onChange={e=>setConfig(e.target.value)} spellCheck={false} rows={9} className="w-full rounded-lg border p-3 font-mono text-sm" />}
        <p className="text-sm text-slate-500">PDF page numbers are used. Universal mode automatically processes all PDF pages unless you choose a custom range. Question/answer images retain their original appearance, and uncertain keys remain unscored. Scanned DDA mode still needs the answer table on the next page.</p>
        <button onClick={upload} disabled={!pdf || busy || (!isAuthenticated && !publicEnabled) || (mode === "universal" && !isAuthenticated)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={18}/> : <FileUp size={18}/>} {busy ? "Processing…" : "Generate mock test"}</button>
      </div>
      {busy && <div role="status" className="rounded-xl border bg-white p-4"><p className="font-medium">{phase || 'Working…'} {progress>0?progress+'%':''}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600 transition-all" style={{width:progress+'%'}} /></div><p className="mt-2 text-xs text-slate-500">Large files upload in 1 MB chunks with automatic retries. Keep this tab open.</p></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {job && <div role="status" className="rounded-lg bg-indigo-50 p-4 text-sm">Job status: {job.status || "queued"}{typeof job.progress==='number' ? ` · ${job.progress}%` : ''}{job.message ? ` · ${job.message}` : ''}{job.quality && <p className="mt-2">{job.quality.questions} question images · {job.quality.scored} safely scored · {job.quality.unscored} unscored · {job.quality.review_pages} page-review cards</p>}</div>}
      {reviewRequired && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>OCR finished — review required</strong><p className="mt-2">{job?.questions ?? "Questions"} questions extracted. Unverified answers: {Array.isArray((job as Job & {unverified_answers?: number[]})?.unverified_answers) ? (job as Job & {unverified_answers?: number[]}).unverified_answers?.join(", ") || "none flagged" : "see audit"}. Scoring is provisional. Publishing and HTML downloads are blocked until a separate review/approval workflow is implemented.</p></div>}
      {htmlUrl && noAnswers && <p className="rounded-lg bg-amber-50 p-4 text-amber-900">Conversion completed, but the earlier inspection detected no answers. Open the result and verify that questions were extracted before using the test.</p>}
      {htmlUrl && <div className="flex flex-wrap gap-3 rounded-xl bg-white p-5 border"><button onClick={() => openResult(false)} className="inline-flex gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-white"><Play size={18}/> Open test</button><button onClick={() => openResult(true)} className="inline-flex gap-2 rounded-lg border px-4 py-2"><Download size={18}/> {zipUrl ? 'Download offline ZIP' : 'Save HTML'}</button></div>}
    </section>
  </main>;
}
