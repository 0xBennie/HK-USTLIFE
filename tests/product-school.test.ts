import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductApp } from '../src/product/app.js';
import { openDatabase } from '../src/product/database.js';
import { createSchoolStore } from '../src/product/school/store.js';

import {StudyActionController} from '../apps/mobile/src/study/action-controller.js';
import {ApiFailure} from '../apps/mobile/src/api.js';

const clock=()=>Date.parse('2026-10-03T00:00:00Z');
const fixtureContracts={sis:{approval_reference:'TEST ONLY',consent_version:'v1',scopes:[{id:'fall',collection:'timetable',missing:'remove'}]}} as const;

describe('authenticated school source API without a public approval bypass', () => {
  let dir:string,app:ReturnType<typeof createProductApp>,alice:string,bob:string,owner:string;
  beforeEach(async()=>{
    dir=mkdtempSync(join(tmpdir(),'campus-school-http-'));app=createProductApp({dataDir:dir,now:clock});
    const login=async(email:string)=>{
      const c=(await app.inject({method:'POST',url:'/api/v1/auth/email/challenges',payload:{email}})).json().data.challenge_id;
      const {code}=JSON.parse(readFileSync(join(dir,'mail',`${c}.json`),'utf8'));
      return (await app.inject({method:'POST',url:'/api/v1/auth/email/verify',payload:{challenge_id:c,code}})).json().data.access_token;
    };
    alice=await login('alice@example.test');bob=await login('bob@example.test');
    owner=(await call('GET','/me')).json().data.id;
  });
  afterEach(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
  const call=(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,payload?:object,token = alice)=>app.inject({method,url:'/api/v1'+path,headers:{authorization:`Bearer ${token}`},payload});
  function seedFixture() {
    const db=openDatabase(dir),store=createSchoolStore(db,clock,fixtureContracts);
    store.grant(owner,'sis',{subject:'fixture-alice',consent_version:'v1'});
    store.commit(store.begin(owner,'sis','fall'),[{key:'private',state:'active',source_updated_at:null,payload:{kind:'event',title:'Alice private class',starts_at:'2026-10-05T01:00:00Z'}}]);
    const row=store.list(owner,{limit:1}).items[0];db.close();return row;
  }
  it('confirms native private settings and cache-preserving revocation through real authenticated routes',async()=>{
    const row=seedFixture();let current:any,reads=0;
    const controller=new StudyActionController(async(path,options)=>{
      const response=await call(options.method as 'PATCH'|'DELETE',path,options.body as object);
      const json=response.json();if(response.statusCode>=400)throw new ApiFailure(response.statusCode,json.error.code,json.error.message);return json.data;
    },async()=>{reads++;current=(await call('GET','/school/records')).json().data;return true;});
    expect(await controller.submit({path:`/school/records/${row.id}/personal`,method:'PATCH',body:{version:0,notes:'Prepare questions',remind_minutes:15},label:'Private settings'})).toBe(true);
    expect(current.items[0]).toMatchObject({personal:{notes:'Prepare questions',remind_minutes:15,version:1},payload:{title:'Alice private class'}});
    expect(await controller.submit({path:`/school/records/${row.id}/personal`,method:'PATCH',body:{version:1,remind_minutes:null},label:'Disable reminder'})).toBe(true);
    expect(current.items[0].personal.remind_minutes).toBeNull();
    expect(await controller.submit({path:'/school/connections/sis',method:'DELETE',body:{version:1,delete_cached_data:false},label:'Revoke SIS'})).toBe(true);
    expect(current.connections[0].state).toBe('revoked');expect(current.items[0].personal.notes).toBe('Prepare questions');expect(reads).toBe(3);
    expect(await controller.submit({path:'/school/connections/sis',method:'DELETE',body:{version:current.connections[0].version,delete_cached_data:true},label:'Delete retained cache'})).toBe(true);
    expect(current.items).toEqual([]);expect(current.connections[0].state).toBe('revoked');
    expect((await call('GET','/me/export')).json().data.school.records).toEqual([]);
    expect((await call('GET','/school/records',undefined,bob)).json().data.items).toEqual([]);
  });
  it('requires authentication, exposes missing school approval and has no client grant/sync endpoint',async()=>{
    expect((await app.inject({url:'/api/v1/school/connections'})).statusCode).toBe(401);
    const response=await call('GET','/school/connections');expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().data.map((x:any)=>x.state)).toEqual(['approval_required','approval_required']);
    expect((await call('GET','/me')).json().data.connections.sis).toBe('approval_required');
    for(const path of ['/school/connections/sis/grant','/school/connections/sis/sync']) {
      expect((await call('POST',path,{subject:'forged',approved:true})).statusCode).toBe(404);
    }
    expect((await call('GET','/school/records?owner_id=someone-else')).statusCode).toBe(400);
  });
  it('reads only owned source rows, validates personal edits and keeps source payload immutable',async()=>{
    const row=seedFixture();
    const response=await call('GET','/school/records');expect(response.statusCode,response.body).toBe(200);
    expect(response.json().data.items[0].payload.title).toBe('Alice private class');
    expect((await call('GET','/school/records',undefined,bob)).json().data.items).toEqual([]);
    expect((await call('GET',`/school/records/${row.id}`,undefined,bob)).statusCode).toBe(404);
    expect((await call('PATCH',`/school/records/${row.id}/personal`,{version:0,notes:'Intrude'},bob)).statusCode).toBe(404);
    expect((await call('PATCH',`/school/records/${row.id}/personal`,{version:0,title:'Overwrite official'})).statusCode).toBe(400);
    const updated=await call('PATCH',`/school/records/${row.id}/personal`,{version:0,notes:'My note',completed:true});
    expect(updated.statusCode,updated.body).toBe(200);
    expect(updated.json().data).toMatchObject({payload:{title:'Alice private class'},personal:{notes:'My note',completed:true,version:1}});
    expect((await call('PATCH',`/school/records/${row.id}/personal`,{version:0,notes:'Stale'})).statusCode).toBe(409);
  });
  it('exports retained data after restart, requires an explicit cache choice and cascades account deletion',async()=>{
    const row=seedFixture();
    await call('PATCH',`/school/records/${row.id}/personal`,{version:0,notes:'Private note'});
    expect((await call('DELETE','/school/connections/sis',{version:1})).statusCode).toBe(400);
    const revoked=await call('DELETE','/school/connections/sis',{version:1,delete_cached_data:false});
    expect(revoked.statusCode,revoked.body).toBe(200);
    expect(revoked.json().data).toMatchObject({cache:'retained',upstream_revocation:'not_attempted'});
    expect((await call('DELETE','/school/connections/sis',{version:1,delete_cached_data:true})).statusCode).toBe(409);
    await app.close();app=createProductApp({dataDir:dir,now:clock});
    expect((await call('GET','/me/export')).json().data.school.records[0].personal.notes).toBe('Private note');
    expect((await call('GET','/me/export',undefined,bob)).json().data.school.records).toEqual([]);
    expect((await call('DELETE','/me',{confirmation:'DELETE'})).statusCode).toBe(200);
    const db=openDatabase(dir);
    expect(db.prepare('SELECT count(*) n FROM school_records WHERE owner_id=?').get(owner)?.n).toBe(0);db.close();
  });
  it('feeds calendar and reminder routes from one source record and removes both after revocation',async()=>{
    await app.close();app=createProductApp({dataDir:dir,now:clock,schoolContracts:fixtureContracts});
    const row=seedFixture();
    await call('PATCH',`/school/records/${row.id}/personal`,{version:0,remind_minutes:15});
    const day=await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06');
    expect(day.statusCode,day.body).toBe(200);expect(day.json().data.days[0].events[0]).toMatchObject({id:row.id,school_origin:{provider:'sis'}});
    expect(day.json().data.school_connections[0].state).toBe('connected');
    const reminders=(await call('GET','/me/reminders')).json().data;
    expect(reminders.items[0]).toMatchObject({id:row.id,target:{kind:'school',id:row.id},fires_at:'2026-10-05T00:45:00.000Z'});
    expect((await call('GET','/me/reminders',undefined,bob)).json().data.items).toEqual([]);
    await call('DELETE','/school/connections/sis',{version:1,delete_cached_data:false});
    expect((await call('GET','/me/calendar?from=2026-10-05&to=2026-10-06')).json().data.days[0].events).toEqual([]);
    expect((await call('GET','/me/reminders')).json().data.items).toEqual([]);
    expect((await call('GET','/school/records')).json().data.items).toHaveLength(1);
  });

});
