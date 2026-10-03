import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/product/database.js';
import {createAffairsStore} from '../src/product/affairs/store.js';
let dir:string,db:ReturnType<typeof openDatabase>,store:ReturnType<typeof createAffairsStore>,clock:number;
const template=(revision=1)=>({template_id:'library-renewal',revision,school_id:'hkust',title:{zh:'续借核对',en:'Renewal check'},summary:{zh:'核对系统回复',en:'Check the response'},conditions:[],materials:[],steps:[{id:'check',text:{zh:revision===1?'核对日期':'核对回复和日期',en:revision===1?'Check date':'Check response and date'},source_id:'library'}],sources:[{id:'library',url:'https://library.hkust.edu.hk/about-us/policies-and-rules/borrowing-policy/requests-renewals-recalls'}],reviewed_at:'2026-10-04T00:00:00Z',review_due_at:'2026-11-04T00:00:00Z',source_health:'verified',deadline:{kind:'per_user'},change_reason:revision===1?'首版':'步骤更明确'});
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'affairs-'));db=openDatabase(dir);clock=Date.parse('2026-10-04T01:00:00Z');for(const id of ['a','b'])db.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?)').run(id,id+'@example.test',clock);store=createAffairsStore(db,()=>clock);store.publish(template(),'reviewer');});
afterEach(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
const create=()=>store.create('a',{template_id:'library-renewal',revision:1},'create-key-1');
it('isolates owners and keeps official status unknown after all personal completion',()=>{
 const a=create();expect(()=>store.get('b',a.id)).toThrow('not found');
 const result=store.update('a',a.id,{version:1,step_checks:{check:true},submission:'self_reported',self_reported_outcome:'completed'});
 expect(result.official_status).toEqual({status:'unknown',reason:'not_connected'});
 expect(()=>store.update('a',a.id,{version:2,official_status:'confirmed'})).toThrow();
 expect(()=>store.update('b',a.id,{version:2,note:'stolen'})).toThrow('not found');
 expect(()=>store.remove('b',a.id,2)).toThrow('not found');
});
it('deduplicates creation, detects key reuse and permits distinct instances',()=>{
 const a=create();expect(create().id).toBe(a.id);
 expect(()=>store.create('a',{template_id:'library-renewal',revision:1,label:'other'},'create-key-1')).toThrow('different content');
 expect(store.create('a',{template_id:'library-renewal',revision:1},'create-key-2').id).not.toBe(a.id);
});
it('preserves old checks until explicit revision acceptance, rejects missing choice and stale versions',()=>{
 const a=create();store.update('a',a.id,{version:1,step_checks:{check:true},note:'private'});store.publish(template(2),'reviewer');
 expect(store.get('a',a.id)).toMatchObject({accepted_revision:1,requires_review:true,step_checks:{check:true},note:'private'});
 expect(()=>store.acceptRevision('a',a.id,{instance_version:2,from_revision:1,to_revision:2,changed_step_choices:{}},'accept-key-1')).toThrow('every changed step');
 const body={instance_version:2,from_revision:1,to_revision:2,changed_step_choices:{check:'reset'}};
 const accepted=store.acceptRevision('a',a.id,body,'accept-key-1');
 expect(accepted).toMatchObject({accepted_revision:2,version:3,step_checks:{check:false},note:'private'});
 expect(store.acceptRevision('a',a.id,body,'accept-key-1').version).toBe(3);
 expect(()=>store.update('a',a.id,{version:2,note:'stale'})).toThrow('changed');
 expect(store.exportAll('a')[0].history).toHaveLength(1);expect(store.exportAll('b')).toEqual([]);
});
it('does not lose old records when content is retired or expires',()=>{
 const a=create();clock=Date.parse('2026-12-01T00:00:00Z');
 expect(store.get('a',a.id).template.source_health).toBe('stale');
 expect(()=>store.create('a',{template_id:'library-renewal',revision:1},'new-expired-key')).toThrow('review');
 store.retire('library-renewal','reviewer');expect(store.get('a',a.id).id).toBe(a.id);
 expect(()=>store.create('a',{template_id:'library-renewal',revision:1},'new-retired-key')).toThrow('retired');
});
it('rejects unknown steps, immutable revision replacement and unreviewed source creation',()=>{
 const a=create();expect(()=>store.update('a',a.id,{version:1,step_checks:{madeup:true}})).toThrow('Unknown step');
 expect(()=>store.publish(template(),'reviewer')).toThrow('exists');
 store.publish({...template(2),source_health:'conflict'},'reviewer');
 expect(()=>store.create('a',{template_id:'library-renewal',revision:2},'conflict-create')).toThrow('review');
});
it('persists on reopen and cascades private data on account deletion',()=>{
 const a=create();db.close();db=openDatabase(dir);store=createAffairsStore(db,()=>clock);expect(store.get('a',a.id).id).toBe(a.id);
 db.prepare("DELETE FROM users WHERE id='a'").run();expect(store.exportAll('a')).toEqual([]);expect(store.catalog({limit:20}).items).toHaveLength(1);
});
it('keeps removed step history and new steps unchecked without changing personal status',()=>{
 const a=create();store.update('a',a.id,{version:1,step_checks:{check:true},submission:'self_reported'});
 store.publish({...template(2),steps:[{id:'new',text:{zh:'新步骤',en:'New step'},source_id:'library'}]},'reviewer');
 const accepted=store.acceptRevision('a',a.id,{instance_version:2,from_revision:1,to_revision:2,changed_step_choices:{}},'accept-new-step');
 expect(accepted).toMatchObject({step_checks:{new:false},submission:'self_reported'});
 expect(store.exportAll('a')[0].history[0].old_checks).toEqual({check:true});
});
it('rolls back revision and acknowledgement together if persistence fails',()=>{
 const a=create();store.publish(template(2),'reviewer');
 db.exec("CREATE TRIGGER simulate_failure BEFORE UPDATE ON affair_instances BEGIN SELECT RAISE(ABORT,'disk failure simulation'); END;");
 expect(()=>store.acceptRevision('a',a.id,{instance_version:1,from_revision:1,to_revision:2,changed_step_choices:{check:'reset'}},'atomic-accept-key')).toThrow('disk failure');
 expect(store.get('a',a.id).accepted_revision).toBe(1);expect(store.exportAll('a')[0].history).toEqual([]);
 db.exec('DROP TRIGGER simulate_failure');
 expect(store.acceptRevision('a',a.id,{instance_version:1,from_revision:1,to_revision:2,changed_step_choices:{check:'reset'}},'atomic-accept-key').accepted_revision).toBe(2);
});
it('requires fresh preview when another template revision arrives and preserves explicit retained checks',()=>{
 const a=create();store.update('a',a.id,{version:1,step_checks:{check:true}});store.publish(template(2),'reviewer');store.publish(template(3),'reviewer');
 expect(()=>store.acceptRevision('a',a.id,{instance_version:2,from_revision:1,to_revision:2,changed_step_choices:{check:'retain'}},'stale-target-key')).toThrow('current new revision');
 const x=store.acceptRevision('a',a.id,{instance_version:2,from_revision:1,to_revision:3,changed_step_choices:{check:'retain'}},'fresh-target-key');expect(x.step_checks.check).toBe(true);
});
it('paginates same-timestamp instances with stable IDs and keeps archive filters isolated',()=>{
 for(let i=0;i<4;i++)store.create('a',{template_id:'library-renewal',revision:1},'page-key-'+i);
 const first=store.list('a',{limit:2,state:'active'});expect(first.items).toHaveLength(2);
 const second=store.list('a',{limit:2,state:'active',cursor:first.next_cursor!});expect(second.items).toHaveLength(2);
 expect(new Set([...first.items,...second.items].map(i=>i.id)).size).toBe(4);expect(second.next_cursor).toBeNull();
 expect(store.list('b',{limit:2,state:'active',cursor:first.next_cursor!}).items).toEqual([]);
});
it('records report time separately from edit time, clears it on withdrawal and never accepts client timestamps',()=>{
 const a=create();expect(a.reported_at).toBeNull();clock+=1000;
 const reported=store.update('a',a.id,{version:1,submission:'self_reported'});expect(reported.reported_at).toBe(new Date(clock).toISOString());
 clock+=1000;const edited=store.update('a',a.id,{version:2,note:'A later note',submission:'self_reported'});expect(edited.reported_at).toBe(reported.reported_at);expect(edited.updated_at).not.toBe(reported.updated_at);
 expect(()=>store.update('a',a.id,{version:3,reported_at:'2020-01-01T00:00:00Z'})).toThrow();
 const cleared=store.update('a',a.id,{version:3,submission:'not_reported'});expect(cleared.reported_at).toBeNull();
 clock+=1000;expect(store.update('a',a.id,{version:4,submission:'self_reported'}).reported_at).toBe(new Date(clock).toISOString());
});
it('timestamps self-reported outcome independently, preserving it across revision acceptance',()=>{
 const a=create();clock+=1000;
 const done=store.update('a',a.id,{version:1,self_reported_outcome:'completed'});expect(done.outcome_recorded_at).toBe(new Date(clock).toISOString());expect(done.reported_at).toBeNull();
 store.publish(template(2),'reviewer');clock+=1000;
 const accepted=store.acceptRevision('a',a.id,{instance_version:2,from_revision:1,to_revision:2,changed_step_choices:{check:'reset'}},'accept-report-time');expect(accepted.outcome_recorded_at).toBe(done.outcome_recorded_at);
 const cleared=store.update('a',a.id,{version:3,self_reported_outcome:'unknown'});expect(cleared.outcome_recorded_at).toBeNull();expect(cleared.official_status.status).toBe('unknown');
});
it('exports complete accepted historical templates, not merely changed-field diffs',()=>{
 const a=create();store.publish(template(2),'reviewer');store.acceptRevision('a',a.id,{instance_version:1,from_revision:1,to_revision:2,changed_step_choices:{check:'reset'}},'export-accept-key');
 store.publish(template(3),'reviewer');
 const exported=store.exportAll('a')[0];expect(exported.accepted_templates.map(t=>t.revision)).toEqual([1,2]);expect(exported.accepted_templates[0]).toEqual(template());
 expect(exported.current_template.revision).toBe(3);expect(store.exportAll('b')).toEqual([]);
});
it('migrates existing progress without inventing historical report times',()=>{
 const a=create();store.update('a',a.id,{version:1,submission:'self_reported',self_reported_outcome:'completed'});
 // Reconstruct the pre17 schema in this disposable database, retaining the persisted v16 payload.
 db.exec('ALTER TABLE affair_instances DROP COLUMN reported_at; ALTER TABLE affair_instances DROP COLUMN outcome_recorded_at; DELETE FROM schema_migrations WHERE version=17;');
 db.close();db=openDatabase(dir);store=createAffairsStore(db,()=>clock);
 expect(store.get('a',a.id)).toMatchObject({submission:'self_reported',self_reported_outcome:'completed',reported_at:null,outcome_recorded_at:null,version:2});
 expect(store.update('a',a.id,{version:2,note:'preserve legacy record'}).reported_at).toBeNull();
});
