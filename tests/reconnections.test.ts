import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/product/database.js';
import {createReconnections} from '../src/product/social/reconnections.js';
let dir:string,db:ReturnType<typeof openDatabase>,store:ReturnType<typeof createReconnections>,clock:number;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'reconnect-'));db=openDatabase(dir);clock=1000000;for(const id of ['a','b','c'])db.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?)').run(id,id+'@test.invalid',0);db.prepare("INSERT INTO activities(id,organizer_id,payload,visibility,starts_at,ends_at,created_at,updated_at) VALUES('event','a','{}','public',0,900000,0,0)").run();db.prepare("INSERT INTO activity_participations(activity_id,user_id,status,queue_order,joined_at,updated_at) VALUES('event','b','confirmed',1,0,0)").run();store=createReconnections(db,()=>clock);});
afterEach(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
it('keeps unilateral intent invisible and connects only after two explicit participation declarations',()=>{
 const first=store.set('a','event','b',{version:0,willing:true,participated:true});expect(first).toMatchObject({willing:true,mutual:false,version:1});
 expect(store.get('b','event','a')).toMatchObject({willing:false,mutual:false,version:0});expect(store.list('b')).toEqual([]);
 store.set('b','event','a',{version:0,willing:true,participated:true});expect(store.get('a','event','b').mutual).toBe(true);
 expect(()=>store.set('c','event','a',{version:0,willing:true,participated:true})).toThrow();
 store.set('b','event','a',{version:1,willing:false,participated:false});expect(store.get('a','event','b')).toMatchObject({willing:true,mutual:false,version:1});
});
it('requires ended eligible activity and expires both consent windows without exposing the other state',()=>{
 expect(()=>store.set('a','event','b',{version:0,willing:true,participated:false})).toThrow();
 clock=800000;expect(()=>store.set('a','event','b',{version:0,willing:true,participated:true})).toThrow();clock=1000000;
 store.set('a','event','b',{version:0,willing:true,participated:true});store.set('b','event','a',{version:0,willing:true,participated:true});
 clock=900000+7*86400000;expect(store.get('a','event','b')).toMatchObject({mutual:false,expired:true});
 expect(()=>store.set('a','event','b',{version:1,willing:true,participated:true})).toThrow();
});
it('rejects stale writes, hides blocked matches and cascades account deletion',()=>{
 store.set('a','event','b',{version:0,willing:true,participated:true});store.set('b','event','a',{version:0,willing:true,participated:true});
 expect(()=>store.set('a','event','b',{version:0,willing:false,participated:false})).toThrow();
 db.prepare("INSERT INTO user_blocks VALUES('b','a',?)").run(clock);expect(store.get('a','event','b').mutual).toBe(false);
 expect(()=>store.set('a','event','b',{version:1,willing:true,participated:true})).toThrow();
 db.prepare("DELETE FROM user_blocks").run();expect(store.get('a','event','b')).toMatchObject({mutual:false,willing:false});
 db.prepare("DELETE FROM users WHERE id='b'").run();expect(store.list('a')).toEqual([]);
});
