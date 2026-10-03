import {randomBytes,timingSafeEqual} from 'node:crypto';
export type WebConfig={enabled:boolean;origin:string;apiBase:string};
export class WebFailure extends Error{constructor(public status:number,public code:string,message:string){super(message);}}
const SESSION='campus_admin_session',CSRF='campus_csrf';
const local=(url:URL)=>url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&!url.search&&!url.hash;
export function validateWebConfig(config:WebConfig){const origin=new URL(config.origin),api=new URL(config.apiBase);if(!local(origin)||origin.pathname!=='/'||!local(api)||api.pathname!=='/api/v1')throw new Error('Product web must use an explicit loopback origin and API base.');return {origin:origin.origin,host:origin.host,apiBase:api.href};}
export function environmentWebConfig():WebConfig{return {enabled:process.env.CAMPUS_WEB_MODE==='local-development',origin:process.env.CAMPUS_WEB_ORIGIN??'http://127.0.0.1:3000',apiBase:process.env.CAMPUS_API_URL??'http://127.0.0.1:4318/api/v1'};}
export async function boundedJson(message:Request|Response,limit:number){
 if(Number(message.headers.get('content-length')??0)>limit)throw new WebFailure(413,'BODY_TOO_LARGE','Request is too large.');
 if(!message.body)throw new WebFailure(400,'INVALID_JSON','Expected JSON.');
 const reader=message.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw new WebFailure(413,'BODY_TOO_LARGE','Request is too large.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new WebFailure(400,'INVALID_JSON','Expected valid JSON.');}
}
export async function upstream(config:WebConfig,path:string,options:{method?:string;body?:unknown;credential?:string}={}){
 const checked=validateWebConfig(config);if(!config.enabled)throw new WebFailure(503,'WEB_DISABLED','Local product web is not enabled.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(checked.apiBase+path,{method:options.method??'GET',cache:'no-store',redirect:'error',signal:controller.signal,headers:{accept:'application/json',...(options.body===undefined?{}:{'content-type':'application/json'}),...(options.credential?{authorization:'Bearer '+options.credential}:{})},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const payload=await boundedJson(response,512*1024);return {status:response.status,payload,retryAfter:response.headers.get('retry-after')};
 }catch{throw new WebFailure(503,'BACKEND_UNAVAILABLE','The local backend is unavailable. Start it and retry.');}finally{clearTimeout(timer);}
}
function readCookie(request:Request,name:string){const values=(request.headers.get('cookie')??'').split(';').map(p=>p.trim()).filter(p=>p.startsWith(name+'='));if(values.length!==1)return '';const value=values[0].slice(name.length+1);return /^[A-Za-z0-9_-]{20,512}$/.test(value)?value:'';}
function cookie(headers:Headers,name:string,value:string,age:number){headers.append('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`);}
const same=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length>0&&left.length===right.length&&timingSafeEqual(left,right);};
export function createProductWeb(config:WebConfig){
 const checked=validateWebConfig(config);
 return async(request:Request):Promise<Response>=>{
  const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
  try{
   if(!config.enabled)throw new WebFailure(503,'WEB_DISABLED','Local product web is not enabled.');
   if(request.headers.get('host')!==checked.host||request.headers.get('sec-fetch-site')==='cross-site')throw new WebFailure(403,'ORIGIN_FORBIDDEN','This endpoint is local and same-origin only.');
   const url=new URL(request.url),path=url.pathname.replace(/^\/api\/campus/,'');
   const isGet=request.method==='GET',isPost=request.method==='POST';
   const allowed=isGet&&(/^\/admin\/activities(?:\/[0-9a-f-]{36}(?:\/history)?)?$/.test(path)||['/session','/admin/reports','/admin/status','/admin/campus/shuttle','/admin/campus/places','/admin/campus/corrections','/admin/campus/history'].includes(path))||isPost&&(['/challenge','/verify','/logout'].includes(path)||(/^\/admin\/activities\/[0-9a-f-]{36}\/maintain$/.test(path)||/^\/admin\/reports\/[0-9a-f-]{36}\/resolve$/.test(path)||path==='/admin/campus/source-checks'||path==='/admin/campus/shuttle/holidays'||/^\/admin\/campus\/shuttle\/routes\/[a-z0-9-]{1,100}(?:\/preview)?$/.test(path)||/^\/admin\/campus\/places\/[a-z0-9-]{1,100}$/.test(path)||/^\/admin\/campus\/corrections\/[0-9a-f-]{36}\/resolve$/.test(path)));
   if(!allowed)throw new WebFailure(404,'NOT_FOUND','Endpoint unavailable.');
   if(url.search&&!['/admin/activities','/admin/reports','/admin/campus/corrections','/admin/campus/history'].includes(path))throw new WebFailure(400,'INVALID_INPUT','Query parameters are not supported.');
   if(isPost){
    if(request.headers.get('origin')!==checked.origin||!same(readCookie(request,CSRF),request.headers.get('x-csrf-token')??''))throw new WebFailure(403,'CSRF_REQUIRED','Refresh your session before submitting this action.');
    if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new WebFailure(415,'JSON_REQUIRED','Send JSON.');
   }
   const credential=readCookie(request,SESSION);
   const rotate=()=>{const value=randomBytes(32).toString('hex');cookie(headers,CSRF,value,3600);return value;};
   const clear=()=>cookie(headers,SESSION,'',0);
   const identity=async(value:string)=>{
    const result=await upstream(config,'/me',{credential:value});
    if(result.status!==200)return result;
    const user=result.payload.data;
    if(user.role!=='admin')return {status:403,payload:{error:{code:'ADMIN_REQUIRED',message:'This account is not an administrator.'}},retryAfter:null};
    return {status:200,payload:{data:{id:user.id,display_name:user.display_name,role:user.role}},retryAfter:null};
   };
   if(path==='/session'){
    let user=null;
    if(credential){const result=await identity(credential);if(result.status===200)user=result.payload.data;else if([401,403].includes(result.status))clear();else return json(result.payload,result.status);}
    return json({data:{user,csrf:rotate(),mode:'local-development'}});
   }
   const body=isPost?await boundedJson(request,32768):undefined;
   if(path==='/challenge'){
    const result=await upstream(config,'/auth/email/challenges',{method:'POST',body});if(result.retryAfter)headers.set('Retry-After',result.retryAfter);return json(result.payload,result.status);
   }
   if(path==='/verify'){
    const result=await upstream(config,'/auth/email/verify',{method:'POST',body});if(result.status!==200)return json(result.payload,result.status);
    const value=result.payload.data.access_token;if(typeof value!=='string')throw new WebFailure(503,'BACKEND_UNAVAILABLE','Unexpected login response.');
    const me=await identity(value);
    if(me.status!==200){await upstream(config,'/auth/logout',{method:'POST',body:{},credential:value});clear();return json(me.payload,me.status);}
    // Retire this browser's previous session after a successful account change.
    if(credential&&credential!==value)await upstream(config,'/auth/logout',{method:'POST',body:{},credential});
    cookie(headers,SESSION,value,12*3600);return json({data:{user:me.payload.data,csrf:rotate(),mode:'local-development'}});
   }
   if(path==='/logout'){
    // Expiry may already have cleared the cookie. Explicit sign-out must still
    // release locked local drafts, while retaining Origin and CSRF checks above.
    if(credential){const result=await upstream(config,'/auth/logout',{method:'POST',body:{},credential});
     if(result.status!==200&&result.status!==401)return json(result.payload,result.status);}
    clear();return json({data:{signed_out:true,csrf:rotate()}});
   }
   if(!credential)throw new WebFailure(401,'AUTH_REQUIRED','Sign in with a local administrator account.');
   // Bind retained browser editors to the identity they were opened with. The
   // captured cookie is also used for the upstream request, avoiding a tab-switch race.
   const editorIdentity=request.headers.get('x-campus-admin-id');
   if(editorIdentity){
    const current=await identity(credential);
    if(current.status!==200){if([401,403].includes(current.status))clear();return json(current.payload,current.status);}
    if(current.payload.data.id!==editorIdentity)throw new WebFailure(403,'ACCOUNT_CHANGED','Sign in with the administrator who opened this editor.');
   }
   // Only fixed admin routes reach this point. The API validates the role on every request.
   const result=await upstream(config,path+url.search,{method:request.method,body,credential});
   if([401,403].includes(result.status))clear();return json(result.payload,result.status);
  }catch(error){const e=error instanceof WebFailure?error:new WebFailure(503,'WEB_UNAVAILABLE','The local web service is unavailable.');return json({error:{code:e.code,message:e.message}},e.status);}
 };
}
