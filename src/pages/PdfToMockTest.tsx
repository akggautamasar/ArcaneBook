import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileUp, Loader2, Download, Play, AlertTriangle } from "lucide-react";

const API = (import.meta.env.VITE_PDF2MOCK_API_URL || "").replace(/\/$/, "");
type Job = { id?: string; job_id?: string; status?: string; error?: string; message?: string };
export default function PdfToMockTest() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [config, setConfig] = useState('{"title":"My Mock Test","mode":"papers","papers":[{"name":"Paper 1","pages":[1,10]}]}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [preview, setPreview] = useState("");
  const [htmlUrl, setHtmlUrl] = useState("");
  async function upload() {
    if (!pdf || !API) return;
    setBusy(true); setError(""); setJob(null); setHtmlUrl("");
    try {
      const parsed = JSON.parse(config);
      if (!Array.isArray(parsed.papers) && !Array.isArray(parsed.chapters)) throw new Error("Configure papers or chapters with page ranges.");
      const data = new FormData(); data.append("file", pdf); data.append("config", JSON.stringify(parsed));
      const res = await fetch(API + "/api/jobs", { method:"POST", body:data });
      const result: Job = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Upload failed");
      const id = result.id || result.job_id;
      if (!id) throw new Error("Backend did not return a job ID");
      setJob(result);
      for (let i=0;i<180;i++) {
        await new Promise(r=>setTimeout(r,2000));
        const poll = await fetch(API + "/api/jobs/" + encodeURIComponent(id));
        if (!poll.ok) throw new Error("Unable to check conversion progress");
        const status: Job = await poll.json(); setJob(status);
        if (["done","completed","success"].includes(status.status || "")) {
          setHtmlUrl(API + "/api/jobs/" + encodeURIComponent(id) + "/html"); break;
        }
        if (["error","failed"].includes(status.status || "")) throw new Error(status.error || status.message || "Conversion failed");
      }
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function probe() {
    if (!pdf || !API) return;
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.append("file",pdf);
      const res = await fetch(API + "/api/probe", {method:"POST",body:data});
      const result = await res.text();
      if (!res.ok) throw new Error(result);
      setPreview(result);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-gradient-to-r from-slate-950 to-indigo-900 text-white p-6">
      <div className="max-w-4xl mx-auto"><Link to="/mock-tests" className="inline-flex items-center gap-2 text-indigo-200"><ArrowLeft size={18}/> Mock Test Library</Link>
      <h1 className="text-3xl font-bold mt-5">PDF to Mock Test</h1><p className="text-indigo-100 mt-2">Convert solved papers and chapterwise PYQs into interactive timed tests.</p></div>
    </header>
    <section className="max-w-4xl mx-auto p-5 space-y-5">
      {!API && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-2"><AlertTriangle/> Conversion backend not configured. Set VITE_PDF2MOCK_API_URL in Vercel and deploy the supplied Python service separately.</div>}
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <label className="font-semibold block" htmlFor="pdf-upload">1. Upload a solved-paper PDF</label>
        <input id="pdf-upload" type="file" accept=".pdf,application/pdf" className="block w-full" onChange={e=>setPdf(e.target.files?.[0] || null)}/>
        <p className="text-sm text-slate-500">Supported: selectable-text PDFs with four-option questions and Ans (a–d) answer keys. Scanned PDFs require OCR first.</p>
        <button disabled={!pdf || busy || !API} onClick={probe} className="rounded-lg border px-4 py-2 disabled:opacity-50">Inspect PDF layout</button>
        {preview && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">{preview}</pre>}
      </div>
      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
        <label htmlFor="pdf-config" className="font-semibold block">2. Configure paper or chapter ranges</label>
        <textarea id="pdf-config" value={config} onChange={e=>setConfig(e.target.value)} spellCheck={false} rows={9} className="w-full rounded-lg border p-3 font-mono text-sm" />
        <p className="text-sm text-slate-500">Page numbers and PDF geometry depend on your book. Use Inspect PDF first and adjust the configuration before conversion.</p>
        <button onClick={upload} disabled={!pdf || busy || !API} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={18}/> : <FileUp size={18}/>} {busy ? "Processing…" : "Generate mock test"}</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {job && <p role="status" className="rounded-lg bg-indigo-50 p-4">Job status: {job.status || "queued"}</p>}
      {htmlUrl && <div className="flex flex-wrap gap-3 rounded-xl bg-white p-5 border"><a href={htmlUrl} target="_blank" rel="noreferrer" className="inline-flex gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-white"><Play size={18}/> Open test</a><a href={htmlUrl} download className="inline-flex gap-2 rounded-lg border px-4 py-2"><Download size={18}/> Save HTML</a></div>}
    </section>
  </main>;
}
