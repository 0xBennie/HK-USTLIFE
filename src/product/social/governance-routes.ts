import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {reportQuery,type createGovernanceStore} from './governance.js';
export function registerGovernanceRoutes(app:FastifyInstance,store:ReturnType<typeof createGovernanceStore>,owner:(r:FastifyRequest)=>string,admin:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const id=(r:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(r.params).id;
 app.get('/api/v1/me/blocks',async r=>ok(store.blocks(owner(r)),r.id));
 app.put('/api/v1/me/blocks/:id',async r=>{z.object({}).strict().parse(r.body);return ok(store.block(owner(r),id(r)),r.id);});
 app.delete('/api/v1/me/blocks/:id',async r=>{z.object({}).strict().parse(r.body);return ok(store.unblock(owner(r),id(r)),r.id);});
 app.post('/api/v1/reports',async(r,reply)=>reply.code(201).send(ok(store.report(owner(r),r.body,r.headers['idempotency-key']),r.id)));
 app.get('/api/v1/me/reports',async r=>ok(store.reports(owner(r),reportQuery.parse(r.query)),r.id));
 app.get('/api/v1/admin/reports',async r=>{admin(r);return ok(store.reports(null,reportQuery.parse(r.query)),r.id);});
 app.post('/api/v1/admin/reports/:id/resolve',async r=>ok(store.resolve(admin(r),id(r),r.body),r.id));
}
