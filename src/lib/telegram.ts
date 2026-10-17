export interface QuizMeta {id:string;file_id:string;title:string;description:string;question_count:number;file_size:number;created_at:string;}
async function api<T>(action:string,body?:unknown):Promise<T>{const r=await fetch(`/api?action=${encodeURIComponent(action)}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let result;try{result=JSON.parse(text);}catch{throw Error('Invalid API response');}if(!r.ok)throw Error(result.error||'Request failed');return result as T;}
export const listQuizzes=()=>api<QuizMeta[]>('list');
export const saveQuiz=(title:string,description:string,htmlContent:string,questionCount:number)=>api<QuizMeta>('save',{title,description,htmlContent,questionCount});
export async function getQuizHtml(fileId:string):Promise<string>{const r=await fetch(`/api?action=html&id=${encodeURIComponent(fileId)}`,{credentials:'same-origin'});if(!r.ok)throw Error('Failed to load quiz');return r.text();}
export const deleteQuiz=(id:string)=>api<void>('delete',{id});
export async function validateConfig():Promise<{ok:boolean;error?:string}>{try{return await api('validate');}catch(e){return {ok:false,error:e instanceof Error?e.message:'Configuration error'};}}
