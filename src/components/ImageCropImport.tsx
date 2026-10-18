import React,{useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Question} from './QuizBuilder';

type PdfDoc={numPages:number;getPage:(n:number)=>Promise<{getViewport:(o:{scale:number})=>{width:number;height:number};render:(o:{canvasContext:CanvasRenderingContext2D;viewport:{width:number;height:number}})=>{promise:Promise<void>}}>} ;
type Rect={x:number;y:number;w:number;h:number};
type Crop={image:string;answer:number|null;page:number;rect:Rect};
export function ImageCropImport({onImport,positive,negative}:{onImport:(q:Question[])=>void;positive:number;negative:number}){
 const canvas=useRef<HTMLCanvasElement>(null),base=useRef<HTMLCanvasElement|null>(null),origin=useRef<{x:number;y:number}|null>(null);
 const [doc,setDoc]=useState<PdfDoc|null>(null),[page,setPage]=useState(1),[rect,setRect]=useState<Rect|null>(null);
 const [crops,setCrops]=useState<Crop[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<number|null>(null);
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
    c.width=b.width;c.height=b.height;draw(null);setPage(n);setMessage('Tap Auto-detect crops, then adjust any inaccurate boundaries by dragging a new rectangle.');
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
 const makeImage=(b:HTMLCanvasElement,r:Rect)=>{const out=document.createElement('canvas');const factor=Math.min(1,1300/r.w);out.width=Math.max(1,Math.round(r.w*factor));out.height=Math.max(1,Math.round(r.h*factor));const ctx=out.getContext('2d');if(!ctx)return '';ctx.fillStyle='white';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(b,r.x,r.y,r.w,r.h,0,0,out.width,out.height);return out.toDataURL('image/jpeg',0.83)};
 const add=()=>{
   const b=base.current,r=rect;if(!b||!r||r.w<15||r.h<15)return;
   const image=makeImage(b,r);
   if(editing!==null){setCrops(prev=>prev.map((c,i)=>i===editing?{...c,image,rect:r}:c));setEditing(null)}
   else setCrops(prev=>[...prev,{image,answer:null,page,rect:r}]);
   setRect(null);draw(null);setMessage('Crop saved. Select another question or switch page.');
 };


 const detect=async()=>{
  const b=base.current;if(!b)return;
  setBusy(true);setMessage('Reading question-number positions (images stay unchanged)…');
  try{
   const w=b.width,h=b.height;
   // Detect the center divider independently of the title/header.
   const scan=document.createElement('canvas');const ratio=Math.min(1,900/w);
   scan.width=Math.round(w*ratio);scan.height=Math.round(h*ratio);
   const ctx=scan.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable');
   ctx.drawImage(b,0,0,scan.width,scan.height);
   const pixels=ctx.getImageData(0,0,scan.width,scan.height).data;
   const ink=(x:number,y:number)=>{const k=(y*scan.width+x)*4;return pixels[k]<145&&pixels[k+1]<145&&pixels[k+2]<145};
   const columnInk=(x0:number,x1:number)=>{
    let n=0;for(let y=Math.floor(scan.height*.20);y<scan.height*.88;y+=4)for(let x=x0;x<x1;x+=3)if(ink(x,y))n++;return n;
   };
   const sw=scan.width,mid=Math.floor(sw/2),strip=Math.max(4,Math.round(sw*.018));
   const center=columnInk(mid-strip,mid+strip),left=columnInk(Math.floor(sw*.35),Math.floor(sw*.35)+strip*2);
   const right=columnInk(Math.floor(sw*.63),Math.floor(sw*.63)+strip*2);
   const twoColumns=center<Math.max(left,right)*.62;
   const regions=twoColumns?[[.13,.505],[.51,.90]]:[[.11,.91]];
   if(!(window as any).Tesseract){
    await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=()=>resolve();script.onerror=()=>reject(new Error('Question locator could not load'));document.head.appendChild(script)});
   }
   const worker=await (window as any).Tesseract.createWorker('eng');
   const candidates:Rect[]=[];
   try{
    for(let col=0;col<regions.length;col++){
     const [fractionStart,fractionEnd]=regions[col];
     const x0=Math.floor(w*fractionStart),x1=Math.floor(w*fractionEnd);
     const top=Math.floor(h*.095),bottom=Math.floor(h*.935);
     const section=document.createElement('canvas');section.width=x1-x0;section.height=bottom-top;
     const sectionCtx=section.getContext('2d');if(!sectionCtx)continue;
     sectionCtx.drawImage(b,x0,top,section.width,section.height,0,0,section.width,section.height);
     setMessage('Locating question numbers in column '+(col+1)+' of '+regions.length+'…');
     const recognized=await worker.recognize(section);
     const lines=(recognized.data.lines||[]) as {text:string;bbox:{x0:number;y0:number;x1:number;y1:number}}[];
     const starts:number[]=[];
     for(const line of lines){
      const t=line.text.trim();
      // Number must be at the left edge, followed by a period or closing bracket.
      // This avoids mistaking option labels and numbers inside equations for questions.
      if(line.bbox.x0>section.width*.15)continue;
      const match=t.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3}|[Il])\s*[.)]\s+\S/i);
      if(match&&line.bbox.y0>section.height*.015){
       const y=top+line.bbox.y0;
       if(!starts.some(v=>Math.abs(v-y)<15))starts.push(y);
      }
     }
     starts.sort((x,y)=>x-y);
     if(starts.length<2){setMessage('Could not reliably locate multiple numbered questions in column '+(col+1)+'. No whole-page crop will be created.');continue;}
     for(let i=0;i<starts.length;i++){
      const y=Math.max(top,starts[i]-8);
      const end=i+1<starts.length?Math.max(y+30,starts[i+1]-10):bottom;
      if(end-y<24)continue;
      candidates.push({x:x0,y,w:x1-x0,h:Math.min(bottom,end)-y});
     }
    }
   }finally{await worker.terminate()}
   if(!candidates.length){setMessage('No reliable question boundaries detected. Try a clearer scan or draw a crop manually.');return;}
   const added=candidates.slice(0,45).map(rect=>({image:makeImage(b,rect),answer:null as number|null,page,rect}));
   setCrops(prev=>[...prev,...added]);
   setMessage('Found '+added.length+' numbered question crops on page '+page+'. Review boundaries and adjust any mistakes before importing.');
  }catch(e){setMessage(e instanceof Error?e.message:'Question detection failed. You can still crop manually.')}
  finally{setBusy(false)}
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
   <h3 className="font-semibold">Image-based PDF import — original images preserved</h3>
   <p className="text-sm text-muted-foreground">Upload a PDF and tap Auto-detect crops. Review the suggested question blocks; adjust inaccurate crops by dragging a replacement rectangle, then choose verified answers. Question-number recognition helps locate boundaries; the original Hindi text, maths and diagrams remain images. Crops are stored in the generated test.</p>
   <input type="file" accept="application/pdf" aria-label="Choose PDF for image cropping" onChange={e=>{const f=e.target.files?.[0];if(f)void open(f)}}/>
   {doc&&<div className="flex flex-wrap items-center gap-2">
    <Button variant="outline" disabled={busy||page<=1} onClick={()=>void render(doc,page-1)}>Previous page</Button>
    <span className="text-sm">Page {page} / {doc.numPages}</span>
    <Button variant="outline" disabled={busy||page>=doc.numPages} onClick={()=>void render(doc,page+1)}>Next page</Button>
    <Button disabled={busy} onClick={detect}>Auto-detect crops on this page</Button>
    <Button disabled={busy||!rect||rect.w<15||rect.h<15} onClick={add}>{editing===null?'Save selected question crop':'Save adjusted crop'}</Button>
   </div>}
   <canvas ref={canvas} style={{display:doc?'block':'none',width:'100%',height:'auto',touchAction:'none',cursor:'crosshair',border:'1px solid #cbd5e1'}}
    onPointerDown={e=>{if(!base.current)return;e.currentTarget.setPointerCapture(e.pointerId);origin.current=point(e);setRect(null)}}
    onPointerMove={e=>{if(!origin.current)return;const p=point(e),o=origin.current,r={x:Math.min(o.x,p.x),y:Math.min(o.y,p.y),w:Math.abs(p.x-o.x),h:Math.abs(p.y-o.y)};setRect(r);draw(r)}}
    onPointerUp={e=>{if(!origin.current)return;const p=point(e),o=origin.current,r={x:Math.min(o.x,p.x),y:Math.min(o.y,p.y),w:Math.abs(p.x-o.x),h:Math.abs(p.y-o.y)};origin.current=null;setRect(r);draw(r)}}
    onPointerCancel={()=>{origin.current=null}}/>
   <p role="status" className="text-sm">{message}</p>
   {crops.length>0&&<div className="space-y-3"><h4 className="font-semibold">{crops.length} saved question crops</h4>
    {crops.map((c,i)=><div key={i} className="border rounded-lg p-3 space-y-2">
     <div className="flex items-center justify-between"><strong>Question {i+1} · page {c.page}</strong><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>{if(!doc)return;setEditing(i);if(page!==c.page)void render(doc,c.page);else{setRect(c.rect);draw(c.rect)}setMessage('Drag a new rectangle over the question, then Save adjusted crop.')}}>Adjust crop</Button><Button variant="outline" size="sm" onClick={()=>setCrops(old=>old.filter((_,j)=>i!==j))}>Remove</Button></div></div>
     <img src={c.image} alt={'Question '+(i+1)+' crop'} style={{maxWidth:'100%',maxHeight:420,objectFit:'contain'}}/>
     <label className="block text-sm">Verified correct answer: <select className="border rounded p-2" value={c.answer??''} onChange={e=>setCrops(old=>old.map((item,j)=>i===j?{...item,answer:e.target.value===''?null:Number(e.target.value)}:item))}>
      <option value="">Not verified</option>{['A','B','C','D'].map((x,j)=><option value={j} key={x}>{x}</option>)}
     </select></label>
    </div>)}
    <Button onClick={importCrops} disabled={!crops.some(c=>c.answer!==null)}>Import {crops.filter(c=>c.answer!==null).length} verified image questions</Button>
   </div>}
 </section>;
}
