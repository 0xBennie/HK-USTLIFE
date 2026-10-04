import {it,expect,afterEach} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProductApp} from '../src/product/app.js';
let dir='';afterEach(()=>{if(dir)rmSync(dir,{recursive:true,force:true});});
const hko=(warn:object):typeof fetch=>async input=>String(input).includes('rhrread')
 ?Response.json({icon:[64],updateTime:'2026-10-04T18:02:00+08:00',temperature:{data:[{place:'京士柏',value:30},{place:'西貢',value:26}]},humidity:{data:[{value:95}]}})
 :Response.json(warn);
it('returns Sai Kung conditions and flags class-suspension-level warnings',async()=>{
 dir=mkdtempSync(join(tmpdir(),'wx-'));
 const app=createProductApp({dataDir:dir,weatherFetch:hko({WRAIN:{name:'暴雨警告信號',code:'WRAINB',issueTime:'2026-10-04T17:00:00+08:00'},WTS:{code:'WTS'}})});
 const r=(await app.inject({method:'GET',url:'/api/v1/campus/weather'})).json().data;
 expect(r).toMatchObject({station:'西貢',temperature:26,humidity:95,condition:{zh:'大雨'},classes_may_be_suspended:true});
 expect(r.warnings.map((w:{code:string})=>w.code)).toEqual(['WRAINB','WTS']);
 await app.close();
});
it('reports a clear day without warnings and degrades to 503 when HKO is down',async()=>{
 dir=mkdtempSync(join(tmpdir(),'wx-'));
 const ok=createProductApp({dataDir:dir,weatherFetch:hko({})});
 expect((await ok.inject({method:'GET',url:'/api/v1/campus/weather'})).json().data).toMatchObject({warnings:[],classes_may_be_suspended:false});
 await ok.close();
 const down=createProductApp({dataDir:dir,weatherFetch:async()=>new Response('x',{status:500})});
 expect((await down.inject({method:'GET',url:'/api/v1/campus/weather'})).statusCode).toBe(503);
 await down.close();
});
