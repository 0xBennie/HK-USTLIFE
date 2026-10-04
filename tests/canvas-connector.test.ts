import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductApp} from '../src/product/app.js';
import {openDatabase} from '../src/product/database.js';
const TOKEN='9~AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'; // release-check:allow (fake test token for a fake Canvas server)
let dir:string,app:ReturnType<typeof createProductApp>,a:string,valid=true,calls:string[]=[];
const due=new Date(Date.now()+2*864e5).toISOString();
const fakeCanvas:typeof fetch=async(input,init)=>{
 const url=String(input);calls.push(url);
 const auth=(init?.headers as Record<string,string>)?.authorization;
 if(!valid||auth!=='Bearer '+TOKEN)return new Response(JSON.stringify({errors:[{message:'Invalid access token.'}]}),{status:401});
 if(url.endsWith('/api/v1/users/self'))return Response.json({id:42,name:'Student A'});
 if(url.includes('/api/v1/planner/items')&&!url.includes('page=2'))return new Response(JSON.stringify([
  {plannable_id:1,plannable_type:'assignment',plannable_date:due,context_name:'COMP 2011 Programming',html_url:'/courses/1/assignments/1',plannable:{title:'Lab 6',due_at:due,updated_at:due}},
  {plannable_id:9,plannable_type:'announcement',plannable_date:due,plannable:{title:'Welcome'}},
 ]),{status:200,headers:{link:'<https://canvas.ust.hk/api/v1/planner/items?page=2>; rel="next"'}});
 if(url.includes('page=2'))return Response.json([{plannable_id:2,plannable_type:'quiz',plannable_date:due,context_name:'MATH 2411',plannable:{title:'Quiz 2',due_at:due}}]);
 return new Response('nope',{status:404});
};
beforeEach(async()=>{
 valid=true;calls=[];
 dir=mkdtempSync(join(tmpdir(),'canvas-'));app=createProductApp({dataDir:dir,canvasFetch:fakeCanvas});
 async function login(email:string){const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data;const mail=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:challenge.challenge_id,code:mail.code}})).json().data.access_token;}
 a=await login('canvas-a@example.test');
});
afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
const call=(method:'GET'|'POST'|'DELETE',path:string,body?:object)=>app.inject({method,url:'/api/v1'+path,payload:body,headers:{authorization:'Bearer '+a}});

it('connects with a personal token, stores it encrypted and syncs real planner items into deadlines',async()=>{
 const r=await call('POST','/school/canvas/connect',{token:TOKEN});expect(r.statusCode,r.body).toBe(200);
 expect(r.json().data).toMatchObject({connected:true,canvas_name:'Student A'});
 const rows=openDatabase(dir).prepare('SELECT token FROM canvas_tokens').all() as {token:string}[];
 expect(rows).toHaveLength(1);expect(rows[0].token).not.toContain(TOKEN);
 const records=(await call('GET','/school/records?provider=canvas')).json().data;
 expect(records.items.map((x:{payload:{title:string}})=>x.payload.title).sort()).toEqual(['COMP 2011 · Lab 6','MATH 2411 · Quiz 2']);
 expect(records.connections.find((c:{provider:string})=>c.provider==='canvas').state).toBe('connected');
 const day=due.slice(0,10),next=new Date(Date.parse(due)+864e5).toISOString().slice(0,10);
 const res=await call('GET',`/me/calendar?from=${day}&to=${next}&timezone=UTC`);expect(res.statusCode,res.body).toBe(200);const cal=res.json().data;
 expect(JSON.stringify(cal)).toContain('Lab 6');
 expect(calls.every(u=>u.startsWith('https://canvas.ust.hk/api/v1/'))).toBe(true);
});

it('rejects bad tokens and marks reauthorization when Canvas revokes access',async()=>{
 expect((await call('POST','/school/canvas/connect',{token:'short'})).statusCode).toBe(400);
 valid=false;expect((await call('POST','/school/canvas/connect',{token:TOKEN})).statusCode).toBe(401);
 valid=true;expect((await call('POST','/school/canvas/connect',{token:TOKEN})).statusCode).toBe(200);
 valid=false;const s=(await call('POST','/school/canvas/sync')).json().data;expect(s.state).toBe('reauth_required');
});

it('forgets the token when the student disconnects Canvas',async()=>{
 await call('POST','/school/canvas/connect',{token:TOKEN});
 const version=(await call('GET','/school/connections')).json().data.find((c:{provider:string})=>c.provider==='canvas').version;
 expect((await call('DELETE','/school/connections/canvas',{version,delete_cached_data:true})).statusCode).toBe(200);
 expect(openDatabase(dir).prepare('SELECT COUNT(*) AS n FROM canvas_tokens').get()).toMatchObject({n:0});
 expect((await call('POST','/school/canvas/sync')).statusCode).toBe(409);
});
