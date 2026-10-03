import {afterEach,beforeEach,expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/product/database.js';
import {createSchoolStore} from '../src/product/school/store.js';
import {projectSchoolCalendar} from '../src/product/school/projection.js';
import {projectReminders} from '../src/product/reminders/projection.js';
import {createLearningStore} from '../src/product/learning/store.js';
let dir:string,db:ReturnType<typeof openDatabase>,store:ReturnType<typeof createSchoolStore>;
const now=()=>Date.parse('2026-10-03T00:00:00Z');
const contracts={canvas:{approval_reference:'fixture only',consent_version:'v1',scopes:[{id:'tasks',collection:'assignments',missing:'remove'},{id:'events',collection:'events',missing:'retain'}]}} as const;
const task=(due_at='2026-10-04T01:00:00Z',state='active')=>({key:'task',state,source_updated_at:null,payload:{kind:'task',title:'Essay',due_at}});
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'school-projection-'));db=openDatabase(dir);db.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?)').run('alice','a@example.test',now());store=createSchoolStore(db,now,contracts);store.grant('alice','canvas',{subject:'fixture',consent_version:'v1'});});
afterEach(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
function commit(input:unknown[]){store.commit(store.begin('alice','canvas','tasks'),input);return store.list('alice',{limit:10}).items[0];}
function projected(){return projectSchoolCalendar(store.exportAll('alice'));}
it('uses the same stable source identity for day/week and changed reminder times, preserving personal completion',()=>{
 const row=commit([task()]);store.annotate('alice',row.id,{version:0,notes:'Private',remind_minutes:15});
 let p=projected();expect(p.items[0]).toMatchObject({id:row.id,school_origin:{provider:'canvas',personal_version:1,notes:'Private'},status:'open'});
 expect(projectReminders('alice',p.reminder_items,now()).items[0]).toMatchObject({id:row.id,fires_at:'2026-10-04T00:45:00.000Z',target:{kind:'school',id:row.id}});
 commit([task('2026-10-05T01:00:00Z')]);p=projected();
 const calendar=createLearningStore(db,now).calendar('alice',{from:'2026-10-04',to:'2026-10-06',timezone:'Asia/Hong_Kong'},p.items);
 expect(calendar.days[0].tasks).toEqual([]);expect(calendar.days[1].tasks[0].id).toBe(row.id);
 expect(projectReminders('alice',p.reminder_items,now()).items[0].fires_at).toBe('2026-10-05T00:45:00.000Z');
 store.annotate('alice',row.id,{version:1,completed:true});p=projected();expect(p.items[0]).toMatchObject({status:'done',school_origin:{personal_version:2}});
 expect(projectReminders('alice',p.reminder_items,now()).items).toEqual([]);expect(store.get('alice',row.id).payload).toMatchObject({status:'open'});
});
it('keeps partial cached plans visibly stale but suppresses reminders from that failed scope',()=>{
 const row=commit([task()]);store.annotate('alice',row.id,{version:0,remind_minutes:10});
 store.fail(store.begin('alice','canvas','tasks'),'PARTIAL_FETCH');const p=projected();
 expect(p.items[0]).toMatchObject({school_origin:{scope_state:'partial',stale:true}});expect(p.reminder_items).toEqual([]);expect(p.issues).toEqual(expect.arrayContaining([expect.objectContaining({provider:'canvas',scope:'tasks',state:'partial'})]));
});
it('does not schedule cancelled, missing, revoked or unavailable school data; retains notes in export',()=>{
 const row=commit([task()]);store.annotate('alice',row.id,{version:0,notes:'Keep'});
 commit([task(undefined,'cancelled')]);expect(projected().items).toEqual([]);
 commit([task()]);commit([]);expect(projected().items).toEqual([]);
 commit([task()]);store.revoke('alice','canvas',store.status('alice')[1].version,false);expect(projected().items).toEqual([]);
 expect(store.exportAll('alice').records[0].personal.notes).toBe('Keep');
 store.grant('alice','canvas',{subject:'fixture',consent_version:'v1'});commit([task()]);
 expect(projectSchoolCalendar(createSchoolStore(db,now).exportAll('alice')).items).toEqual([]);
});
