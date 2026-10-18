import React,{useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Question} from './QuizBuilder';

type PdfDoc={numPages:number;getPage:(n:number)=>Promise<{getViewport:(o:{scale:number})=>{width:number;height:number};render:(o:{canvasContext:CanvasRenderingContext2D;viewport:{width:number;height:number}})=>{promise:Promise<void>}}>} ;
type Rect={x:number;y:number;w:number;h:number};
type Crop={image:string;answer:number|null;page:number};
export function ImageCropImport({onImport,positive,negative}:{onImport:(q:Question[])=>void;positive:number;negative:number}){
 const canvas=useRef<HTMLCanvasElement>(null),base=useRef<HTMLCanvasElement|null>(null),origin=useRef<{x:number;y:number}|null>(null);
 const [doc,setDoc]=useState<PdfDoc|null>(null),[page,setPage]=useState(1),[rect,setRect]=useState<Rect|null>(null);
 const [crops,setCrops]=useState<Crop[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const draw=(selection:Rect|null)=>{
   const c=canvas.current,b=base.current;if(!c||!b)return;
   const ctx=c.getContext('2d');if(!ctx)return;
   ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(b,0,0);
   if(selection){ctx.strokeStyle='#2563eb';ctx.lineWidth=Math.max(3,c.width/300);ctx.strokeRect(selection.x,selection.y,selection.w,selection.h);
    ctx.fillStyle='rgba(37,99,235,.13)';ctx.fillRect(selection.x,selection.y,selection.w,selection.h);}
 };
 const render=async(d:PdfDoc,n:number)=>{
   setBusy(true);setMessage('Rendering page '+n+'…');setRect(null);
   try{
    const p=await d.getPage(n),viewport=p.getViewport({scale:2});
    const b=document.createElement('canvas');b.width=Math.ceil(viewport.width);b.height=Math.ceil(viewport.height);
    const ctx=b.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
    await p.render({canvasContext:ctx,viewport}).promise;
    base.current=b;
    const c=canvas.current;if(!c)throw new Error('Canvas not mounted');
    c.width=b.width;c.height=b.height;draw(null);setPage(n);setMessage('Drag over one complete question, including its four options.');
   }catch(e){setMessage(e instanceof Error?e.message:'Could not render page');}finally{setBusy(false);}
 };
 const open=async(file:File)=>{
   setBusy(true);setMessage('Opening PDF…');
   try{
    if(!(window as any).pdfjsLib){
     await new Promise<void>((resolve,reject)=>{
       const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
       script.onload=()=>resolve();script.onerror=()=>reject(new Error('PDF reader could not load'));document.head.appendChild(script);
     });
    }
    const pdf=await (window as any).pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableWorker:true}).promise as PdfDoc;
    setDoc(pdf);setCrops([]);await render(pdf,1);
   }catch(e){setMessage(e instanceof Error?e.message:'PDF could not open');}finally{setBusy(false);}
 };
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{
   const c=canvas.current!;const bounds=c.getBoundingClientRect();
   return{x:Math.max(0,Math.min(c.width,(e.clientX-bounds.left)*c.width/bounds.width)),y:Math.max(0,Math.min(c.height,(e.clientY-bounds.top)*c.height/bounds.height))};
 };
 const add=()=>{
   const b=base.current,r=rect;if(!b||!r||r.w<15||r.h<15)return;
   const out=document.createElement('canvas');const factor=Math.min(1,1300/r.w);
   out.width=Math.round(r.w*factor);out.height=Math.round(r.h*factor);
   const ctx=out.getContext('2d');if(!ctx)return;
   ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);
   ctx.drawImage(b,r.x,r.y,r.w,r.h,0,0,out.width,out.height);
   setCrops(prev=>[...prev,{image:out.toDataURL('image/jpeg',0.83),answer:null,page}]);
   setRect(null);draw(null);setMessage('Crop saved. Select another question or switch page.');
 };
 const importCrops=()=>{
   const approved=crops.filter(c=>c.answer!==null);
   const questions:Question[]=approved.map((c,i)=>({
    id:crypto.randomUUID(),questionText:'Question '+(i+1),questionImage:c.image,
    options:['Option A','Option B','Option C','Option D'],correctOptionIndex:c.answer!,
    explanation:'',section:'PDF Image Questions',positiveMarks:positive,negativeMarks:negative,compText:''
   }));
   onImport(questions);setMessage('Imported '+questions.length+' image-based questions. Unverified answers were excluded.');
 };
 return <section className="rounded-xl border p-4 space-y-3">
   <h3 className="font-semibold">Image-based PDF import — no OCR required</h3>
   <p className="text-sm text-muted-foreground">Upload a PDF, drag a rectangle around each full question and its options, then choose the verified correct answer. Works with Hindi, maths and diagrams. Crops are stored in the generated test.</p>
   <input type="file" accept="application/pdf" aria-label="Choose PDF for image cropping" onChange={e=>{const f=e.target.files?.[0];if(f)void open(f)}}/>
   {doc&&<div className="flex flex-wrap items-center gap-2">
    <Button variant="outline" disabled={busy||page<=1} onClick={()=>void render(doc,page-1)}>Previous page</Button>
    <span className="text-sm">Page {page} / {doc.numPages}</span>
    <Button variant="outline" disabled={busy||page>=doc.numPages} onClick={()=>void render(doc,page+1)}>Next page</Button>
    <Button disabled={busy||!rect||rect.w<15||rect.h<15} onClick={add}>Save selected question crop</Button>
   </div>}
   <canvas ref={canvas} style={{display:doc?'block':'none',width:'100%',height:'auto',touchAction:'none',cursor:'crosshair',border:'1px solid #cbd5e1'}}
    onPointerDown={e=>{if(!base.current)return;e.currentTarget.setPointerCapture(e.pointerId);origin.current=point(e);setRect(null)}}
    onPointerMove={e=>{if(!origin.current)return;const p=point(e),o=origin.current,r={x:Math.min(o.x,p.x),y:Math.min(o.y,p.y),w:Math.abs(p.x-o.x),h:Math.abs(p.y-o.y)};setRect(r);draw(r)}}
    onPointerUp={e=>{if(!origin.current)return;const p=point(e),o=origin.current,r={x:Math.min(o.x,p.x),y:Math.min(o.y,p.y),w:Math.abs(p.x-o.x),h:Math.abs(p.y-o.y)};origin.current=null;setRect(r);draw(r)}}
    onPointerCancel={()=>{origin.current=null}}/>
   <p role="status" className="text-sm">{message}</p>
   {crops.length>0&&<div className="space-y-3"><h4 className="font-semibold">{crops.length} saved question crops</h4>
    {crops.map((c,i)=><div key={i} className="border rounded-lg p-3 space-y-2">
     <div className="flex items-center justify-between"><strong>Question {i+1} · page {c.page}</strong><Button variant="outline" size="sm" onClick={()=>setCrops(old=>old.filter((_,j)=>i!==j))}>Remove</Button></div>
     <img src={c.image} alt={'Question '+(i+1)+' crop'} style={{maxWidth:'100%',maxHeight:420,objectFit:'contain'}}/>
     <label className="block text-sm">Verified correct answer: <select className="border rounded p-2" value={c.answer??''} onChange={e=>setCrops(old=>old.map((item,j)=>i===j?{...item,answer:e.target.value===''?null:Number(e.target.value)}:item))}>
      <option value="">Not verified</option>{['A','B','C','D'].map((x,j)=><option value={j} key={x}>{x}</option>)}
     </select></label>
    </div>)}
    <Button onClick={importCrops} disabled={!crops.some(c=>c.answer!==null)}>Import {crops.filter(c=>c.answer!==null).length} verified image questions</Button>
   </div>}
 </section>;
}
