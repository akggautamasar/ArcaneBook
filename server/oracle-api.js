import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { auth, default as apiHandler } from '../api/index.js';

const host = '127.0.0.1';
const port = Number(process.env.ARCANE_PORT || 8787);
const converter = 'http://127.0.0.1:8765';
const stateFile = process.env.ARCANE_SETTINGS_FILE || '/var/lib/arcanebook/settings.json';
let publicEnabled = false;
let activeJobs = 0;
const buckets = new Map();
const uploads = new Map();
const CHUNK_MAX = 2 * 1024 * 1024;
const UPLOAD_TTL = 2 * 60 * 60 * 1000;
async function discardUpload(id) { const u=uploads.get(id); if(!u)return;uploads.delete(id);await rm(u.dir,{recursive:true,force:true}).catch(()=>{}); }
function cleanUploads(){for(const [id,u] of uploads)if(Date.now()-u.touched>UPLOAD_TTL&&!u.busy)void discardUpload(id);}
async function forwardMultipart(req,res,sourcePath,size,contentType,route){
  const headers={'content-type':contentType,'content-length':String(size),'x-api-key':process.env.PDF2MOCK_API_KEY||''};
  await new Promise((resolve,reject)=>{
    const upstream=http.request({hostname:'127.0.0.1',port:8765,path:route,method:'POST',headers,timeout:600000},response=>{
      const out={};for(const [k,v] of Object.entries(response.headers))if(!['connection','transfer-encoding','set-cookie'].includes(k)&&v!==undefined)out[k]=v;
      out['cache-control']='no-store';
      console.info('[chunk:converter]',route,'status='+response.statusCode,'bytes='+size);
      res.writeHead(response.statusCode||502,out);
      response.on('error',reject);response.pipe(res);response.on('end',resolve);
    });
    upstream.on('timeout',()=>upstream.destroy(new Error('Converter timeout')));
    upstream.on('error',reject);
    const stream=createReadStream(sourcePath);stream.on('error',e=>upstream.destroy(e));stream.pipe(upstream);
  });
}

try { publicEnabled = JSON.parse(await readFile(stateFile, 'utf8')).publicConverter === true; } catch {}
const reply = (res, code, obj) => { res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(obj)); };
const sameOrigin = req => { const o=req.headers.origin; return !o || o === 'https://arcanebook.duckdns.org'; };
function limit(req) {
  const ip = req.socket.remoteAddress || '';
  const now = Date.now();
  const a = (buckets.get(ip)||[]).filter(t=>now-t<3600000);
  if(a.length>=5)return false;
  a.push(now);buckets.set(ip,a);
  if(buckets.size>2000)for(const [k,v] of buckets)if(v.every(t=>now-t>3600000))buckets.delete(k);
  return true;
}
async function handler(req,res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname;
  if(path === '/api/converter-settings') {
    if(req.method==='GET') return reply(res,200,{publicEnabled,admin:auth(req)});
    if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'});
    if(!auth(req)||!sameOrigin(req))return reply(res,403,{error:'Admin session required'});
    let raw='';
    for await(const chunk of req){raw+=chunk;if(raw.length>1024)return reply(res,413,{error:'Payload too large'});}
    let val;try{val=JSON.parse(raw);}catch{return reply(res,400,{error:'Invalid JSON'});}
    if(typeof val.publicEnabled!=='boolean')return reply(res,400,{error:'Invalid setting'});
    const old=publicEnabled;
    publicEnabled=val.publicEnabled;
    try { const tmp=stateFile+'.tmp'; await writeFile(tmp,JSON.stringify({publicConverter:publicEnabled}),{mode:0o600});await rename(tmp,stateFile); }
    catch(e){publicEnabled=old;return reply(res,500,{error:'Unable to persist settings; check server directory permissions'});}
    return reply(res,200,{publicEnabled,admin:true});
  }
  if(path==='/api/upload/init'&&req.method==='POST'){
    const admin=auth(req);
    if(!admin&&!publicEnabled)return reply(res,403,{error:'Converter is admin-only'});
    if(!sameOrigin(req))return reply(res,403,{error:'Invalid origin'});
    const max=(admin?500:20)*1024*1024;
    let raw='';for await(const c of req){raw+=c;if(raw.length>2048)return reply(res,413,{error:'Request too large'});}
    let data;try{data=JSON.parse(raw);}catch{return reply(res,400,{error:'Invalid JSON'});}
    const size=Number(data.size);
    if(!Number.isSafeInteger(size)||size<1||size>max)return reply(res,413,{error:'Invalid PDF size or upload limit exceeded'});
    if(!admin&&!limit(req))return reply(res,429,{error:'Public upload limit reached'});
    cleanUploads();
    if(uploads.size>=10)return reply(res,429,{error:'Too many pending uploads'});
    const dir=await mkdtemp(join(tmpdir(),'arcane-chunks-'));
    const id=randomUUID();
    uploads.set(id,{dir,file:join(dir,'upload.bin'),size,received:0,touched:Date.now(),busy:false,admin});
    return reply(res,200,{id,chunkSize:1024*1024,received:0});
  }
  if(path.startsWith('/api/upload/')){
    const parts=path.split('/'),id=parts[3],action=parts[4];
    const u=uploads.get(id);
    if(!u)return reply(res,404,{error:'Upload expired; start again'});
    if(!auth(req)&&(!publicEnabled||u.admin))return reply(res,403,{error:'Admin session required'});
    if(!sameOrigin(req))return reply(res,403,{error:'Invalid origin'});
    u.touched=Date.now();
    if(action==='status'&&req.method==='GET')return reply(res,200,{received:u.received,size:u.size});
    if(action==='cancel'&&req.method==='POST'){if(u.busy)return reply(res,409,{error:'Upload busy'});await discardUpload(id);return reply(res,200,{ok:true});}
    if(action==='chunk'&&req.method==='PUT'){
      if(u.busy)return reply(res,409,{error:'Upload busy'});
      const offset=Number(req.headers['x-upload-offset']);
      if(!Number.isSafeInteger(offset)||offset!==u.received)return reply(res,409,{error:'Offset mismatch',received:u.received});
      const length=Number(req.headers['content-length']);
      if(!Number.isSafeInteger(length)||length<1||length>CHUNK_MAX||offset+length>u.size)return reply(res,413,{error:'Invalid chunk size'});
      u.busy=true;let fh;
      try{
        fh=await open(u.file,'a',0o600);
        let bytes=0;
        for await(const chunk of req){
          bytes+=chunk.length;
          if(bytes>length)throw new Error('Chunk exceeds declared size');
          await fh.write(chunk);
        }
        if(bytes!==length||req.aborted)throw new Error('Incomplete chunk');
        u.received+=bytes;u.touched=Date.now();
        return reply(res,200,{received:u.received,size:u.size});
      }catch(e){
        if(fh){await fh.close().catch(()=>{});fh=null;}
        const reset=await open(u.file,'r+').catch(()=>null);
        if(reset){await reset.truncate(u.received);await reset.close();}
        console.warn('[chunk:error]',id,e.message);
        if(!res.destroyed)return reply(res,400,{error:'Chunk interrupted; retry'});
      }finally{if(fh)await fh.close().catch(()=>{});u.busy=false;}
      return;
    }
    if(action==='finish'&&req.method==='POST'){
      if(u.busy)return reply(res,409,{error:'Upload busy'});
      if(u.received!==u.size)return reply(res,409,{error:'Upload incomplete',received:u.received});
      let raw='';for await(const c of req){raw+=c;if(raw.length>12000)return reply(res,413,{error:'Configuration too large'});}
      let data;try{data=JSON.parse(raw);}catch{return reply(res,400,{error:'Invalid configuration'});}
      if(!['probe','jobs','analyze','universal/jobs'].includes(data.action))return reply(res,400,{error:'Invalid action'});
      if(['analyze','universal/jobs'].includes(data.action)&&!auth(req))return reply(res,403,{error:'Smart analysis and universal image conversion are administrator-only'});
      const boundary='----arcane-'+randomUUID().replaceAll('-','');
      const pdfName='upload.pdf';
      const prefix=Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="'+pdfName+'"\r\nContent-Type: application/pdf\r\n\r\n');
      const suffix=Buffer.from(data.action==='jobs'?'\r\n--'+boundary+'\r\nContent-Disposition: form-data; name="config"\r\n\r\n'+JSON.stringify(data.config||{})+'\r\n--'+boundary+'--\r\n':'\r\n--'+boundary+'--\r\n');
      const multipart=join(u.dir,'multipart.bin');
      u.busy=true;
      try{
        const output=createWriteStream(multipart,{mode:0o600});
        await new Promise((resolve,reject)=>{output.on('error',reject);output.on('finish',resolve);output.write(prefix);const input=createReadStream(u.file);input.on('error',reject);input.on('end',()=>output.end(suffix));input.pipe(output,{end:false});});
        const info=await stat(multipart);
        await forwardMultipart(req,res,multipart,info.size,'multipart/form-data; boundary='+boundary,'/api/'+data.action);
      }catch(e){console.error('[chunk:finish:error]',e);if(!res.headersSent&&!res.destroyed)reply(res,502,{error:'Converter failed: '+e.message});}
      finally{u.busy=false;await discardUpload(id);}
      return;
    }
    return reply(res,405,{error:'Unsupported upload action'});
  }
  if(path.startsWith('/api/jobs')||path==='/api/probe'||path==='/api/analyze'||path.startsWith('/api/universal/')){
    if(!['GET','POST','HEAD'].includes(req.method))return reply(res,405,{error:'Method not allowed'});
    const admin=auth(req);
    if((path==='/api/analyze'||path.startsWith('/api/universal/'))&&!admin)return reply(res,403,{error:'This conversion mode is administrator-only'});
    if(!admin&&!publicEnabled)return reply(res,403,{error:'Converter is admin-only'});
    if(!sameOrigin(req)&&req.method==='POST')return reply(res,403,{error:'Invalid origin'});
    const create=req.method==='POST';
    if(create){
      const max=(admin?500:20)*1024*1024;
      if(Number(req.headers['content-length']||0)>max)return reply(res,413,{error:'Maximum upload is '+(admin?500:20)+' MB'});
      if(!admin&&!limit(req))return reply(res,429,{error:'Public limit: 5 requests per hour'});
      if(activeJobs>=2)return reply(res,429,{error:'Converter is busy; retry shortly'});
      activeJobs++;
    }
    let tempDirectory;
    let receivedBytes=0;
    try {
      const uploadLimit=(admin?500:20)*1024*1024;
      let uploadStream;
      let uploadSize=0;
      if(create){
        console.info('[upload:start]',path,'declared='+String(req.headers['content-length']||'unknown'),'remote='+String(req.socket.remoteAddress||''));
        req.on('aborted',()=>console.warn('[upload:aborted]',path,'received='+String(receivedBytes),'expected='+String(req.headers['content-length']||'unknown')));
        tempDirectory=await mkdtemp(join(tmpdir(),'arcane-upload-'));
        const uploadPath=join(tempDirectory,'multipart.bin');
        let received=0;
        const bounded=new Transform({transform(chunk,encoding,callback){received+=chunk.length;receivedBytes=received;if(received>uploadLimit){callback(new Error('Upload exceeds allowed size'));return;}callback(null,chunk);}});
        await pipeline(req,bounded,createWriteStream(uploadPath,{mode:0o600}));
        uploadSize=(await stat(uploadPath)).size;
        console.info('[upload:complete]',path,'bytes='+uploadSize);
        uploadStream=createReadStream(uploadPath);
      }
      const headers={};
      for(const [k,v] of Object.entries(req.headers)){
        if(['host','cookie','x-api-key','connection','transfer-encoding','expect'].includes(k))continue;
        if(typeof v==='string'||Array.isArray(v))headers[k]=v;
      }
      headers['x-api-key']=process.env.PDF2MOCK_API_KEY||'';
      if(create)headers['content-length']=String(uploadSize);
      const start=Date.now();
      await new Promise((resolve,reject)=>{
        const upstreamReq=http.request({
          hostname:'127.0.0.1',port:8765,
          path:path+url.search,method:req.method,headers,
          timeout:600000
        },upstreamRes=>{
          const responseHeaders={};
          for(const [k,v] of Object.entries(upstreamRes.headers)){
            if(['transfer-encoding','connection','set-cookie','access-control-allow-origin'].includes(k)||v===undefined)continue;
            responseHeaders[k]=v;
          }
          responseHeaders['cache-control']='no-store';
          console.info('[converter]',req.method,path,'bytes='+uploadSize,'status='+upstreamRes.statusCode,'ms='+(Date.now()-start));
          res.writeHead(upstreamRes.statusCode||502,responseHeaders);
          upstreamRes.on('error',reject);
          res.on('close',()=>upstreamRes.destroy());
          upstreamRes.pipe(res);
          upstreamRes.on('end',resolve);
        });
        upstreamReq.on('timeout',()=>upstreamReq.destroy(new Error('Converter request timed out')));
        upstreamReq.on('error',reject);
        if(create){
          uploadStream.on('error',e=>upstreamReq.destroy(e));
          uploadStream.pipe(upstreamReq);
        }else upstreamReq.end();
      });
    }catch(e){console.error('[upload:error]',path,'received='+String(receivedBytes),e?.code||'',e?.message||e);if(!res.destroyed&&!res.headersSent)reply(res,String(e?.message||'').includes('Upload exceeds')?413:502,{error:String(e?.message||'').includes('Upload exceeds')?'Upload exceeds allowed size':'Converter unavailable or timed out'});else res.destroy();}
    finally{if(tempDirectory)await rm(tempDirectory,{recursive:true,force:true}).catch(e=>console.error('Temporary upload cleanup failed:',e));if(create)activeJobs--;}
    return;
  }
  if(path!=='/api')return reply(res,404,{error:'Not found'});
  let body='';
  if(['POST','PUT'].includes(req.method)){
    if(!sameOrigin(req))return reply(res,403,{error:'Invalid origin'});
    for await(const chunk of req){body+=chunk;if(body.length>3_000_000)return reply(res,413,{error:'Payload too large'});}
    try{req.body=JSON.parse(body||'{}');}catch{return reply(res,400,{error:'Invalid JSON'});}
  }
  req.query=Object.fromEntries(url.searchParams);
  const adapter={
    setHeader:(...a)=>res.setHeader(...a),
    status(code){res.statusCode=code;return this;},
    json(data){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return this;},
    send(data){res.end(data);return this;}
  };
  await apiHandler(req,adapter);
}
const server=http.createServer((req,res)=>{handler(req,res).catch(e=>{console.error('[handler:error]',req.url,e);if(!res.headersSent)reply(res,500,{error:'Internal server error'});else res.destroy();});});
server.requestTimeout=15*60*1000;
server.headersTimeout=60*1000;
server.keepAliveTimeout=65*1000;
server.listen(port,host,()=>console.log('ArcaneBook API listening on '+host+':'+port));
