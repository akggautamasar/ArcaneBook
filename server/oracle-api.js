import http from 'node:http';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
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
  if(path.startsWith('/api/jobs')||path==='/api/probe'){
    if(!['GET','POST','HEAD'].includes(req.method))return reply(res,405,{error:'Method not allowed'});
    const admin=auth(req);
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
    try {
      const uploadLimit=(admin?500:20)*1024*1024;
      let uploadStream;
      let uploadSize=0;
      if(create){
        tempDirectory=await mkdtemp(join(tmpdir(),'arcane-upload-'));
        const uploadPath=join(tempDirectory,'multipart.bin');
        let received=0;
        const bounded=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>uploadLimit){callback(new Error('Upload exceeds allowed size'));return;}callback(null,chunk);}});
        await pipeline(req,bounded,createWriteStream(uploadPath,{mode:0o600}));
        uploadSize=(await stat(uploadPath)).size;
        uploadStream=createReadStream(uploadPath);
      }
      const headers=new Headers();
      for(const [k,v] of Object.entries(req.headers)){
        if(['host','cookie','x-api-key','connection','transfer-encoding'].includes(k))continue;
        if(typeof v==='string')headers.set(k,v);
      }
      headers.set('x-api-key',process.env.PDF2MOCK_API_KEY||'');
      if(create)headers.set('content-length',String(uploadSize));
      const upstream=await fetch(converter+path+url.search,{method:req.method,headers,body:uploadStream,duplex:create?'half':undefined,signal:AbortSignal.timeout(600000)});
      const responseHeaders={};
      for(const [k,v] of upstream.headers)if(!['transfer-encoding','connection','set-cookie','access-control-allow-origin'].includes(k))responseHeaders[k]=v;
      responseHeaders['cache-control']='no-store';
      res.writeHead(upstream.status,responseHeaders);
      if(upstream.body)await new Promise((resolve,reject)=>{const s=Readable.fromWeb(upstream.body);s.on('error',reject);res.on('close',resolve);s.on('end',resolve);s.pipe(res);});else res.end();
    }catch(e){if(!res.headersSent)reply(res,String(e?.message||'').includes('Upload exceeds')?413:502,{error:String(e?.message||'').includes('Upload exceeds')?'Upload exceeds allowed size':'Converter unavailable or timed out'});else res.destroy();}
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
http.createServer((req,res)=>{handler(req,res).catch(e=>{console.error(e);if(!res.headersSent)reply(res,500,{error:'Internal server error'});else res.destroy();});}).listen(port,host,()=>console.log('ArcaneBook API listening on '+host+':'+port));
