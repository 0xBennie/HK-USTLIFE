// Local HTTP smoke with real SQLite and explicitly local test authentication.
import {createProductApp} from '../dist/product/app.js';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const dir=mkdtempSync(join(tmpdir(),'hkust-social-smoke-'));
let app=createProductApp({dataDir:dir}),base;
const report={observed_at:new Date().toISOString(),mode:'local-development',real_http:true,external_messages_sent:false,checks:[]};
try{
 base=await app.listen({host:'127.0.0.1',port:0});
 async function request(method,path,body,authorization,key=randomUUID()){
  const r=await fetch(base+'/api/v1'+path,{method,headers:{...(authorization?{authorization:'Bearer '+authorization}:{}),...(body?{'content-type':'application/json'}:{}),'idempotency-key':key},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  const response=await r.json();assert.ok(r.ok,`${method} ${path}: ${r.status} ${response.error?.code}`);return response.data;
 }
 async function login(email){const challenge=await request('POST','/auth/email/challenges',{email});const {code}=JSON.parse(readFileSync(join(dir,'mail',challenge.challenge_id+'.json'),'utf8'));return(await request('POST','/auth/email/verify',{challenge_id:challenge.challenge_id,code})).access_token;}
 const organizer=await login('organizer@example.test'),first=await login('first@example.test'),second=await login('second@example.test');
 const start=Date.now()+3*86400000,startIso=new Date(start).toISOString(),endIso=new Date(start+3600000).toISOString();
 const event=await request('POST','/activities',{kind:'study',title:'Local smoke study group',location:'Demo library table',starts_at:startIso,ends_at:endIso,capacity:1,languages:['en'],visibility:'public',interaction:'quiet'},organizer);
 const users=[first,second];const results=await Promise.all(users.map(credential=>request('POST',`/activities/${event.id}/join`,{activity_version:1,save_calendar:true},credential)));
 assert.deepEqual(results.map(r=>r.mine.participation.status).sort(),['confirmed','waitlisted']);report.checks.push('Concurrent HTTP joins: one confirmed, one waitlisted');
 const winner=results.findIndex(r=>r.mine.participation.status==='confirmed'),waiting=1-winner;
 await app.close();app=createProductApp({dataDir:dir});base=await app.listen({host:'127.0.0.1',port:0});
 assert.equal((await request('GET',`/activities/${event.id}`,undefined,users[waiting])).mine.participation.status,'waitlisted');report.checks.push('Participation and sessions persisted across server restart');
 await request('POST',`/activities/${event.id}/withdraw`,{participation_version:1},users[winner]);assert.equal((await request('GET',`/activities/${event.id}`,undefined,users[waiting])).mine.participation.status,'confirmed');report.checks.push('Withdrawal promoted the waiting account');
 const newStart=start+86400000;await request('PATCH',`/activities/${event.id}`,{version:1,starts_at:new Date(newStart).toISOString(),ends_at:new Date(newStart+3600000).toISOString()},organizer);
 const from=new Date(start-86400000).toISOString().slice(0,10),to=new Date(newStart+2*86400000).toISOString().slice(0,10),calendarPath=`/me/calendar?from=${from}&to=${to}&timezone=UTC`;
 const calendar=await request('GET',calendarPath,undefined,users[waiting]);assert.ok(calendar.days.flatMap(d=>d.events).some(e=>e.activity_origin?.id===event.id&&e.starts_at===new Date(newStart).toISOString()));report.checks.push('Organizer reschedule changed the saved private calendar');
 await request('POST',`/activities/${event.id}/comments`,{body:'Local test reply'},users[waiting]);assert.equal((await request('GET',`/activities/${event.id}/comments`)).items.length,1);
 const message=(await request('GET','/me/notifications',undefined,users[waiting])).items[0];await request('PATCH',`/me/notifications/${message.id}/read`,{},users[waiting]);assert.ok((await request('GET','/me/notifications',undefined,users[waiting])).items.find(m=>m.id===message.id).read_at);report.checks.push('Comment persisted and notification read state saved');
 await request('POST',`/activities/${event.id}/cancel`,{version:2},organizer);
 assert.equal((await request('GET',calendarPath,undefined,users[waiting])).days.flatMap(d=>d.events).length,0);assert.equal((await request('GET',`/activities/${event.id}`,undefined,users[waiting])).mine.participation.status,'cancelled');report.checks.push('Cancellation removed saved calendar and updated participation');
 report.passed=true;console.log(JSON.stringify(report,null,2));
}catch(e){report.passed=false;report.failure=String(e);process.exitCode=1;console.error(report.failure);}
finally{await app.close();rmSync(dir,{recursive:true,force:true});if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2));}
