import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {postQuery,type createWallStore} from './wall.js';
export function registerWallRoutes(app:FastifyInstance,store:ReturnType<typeof createWallStore>,owner:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const viewer=(r:FastifyRequest)=>r.headers.authorization?owner(r):null;
 const id=(r:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(r.params).id;
 app.get('/api/v1/posts',async r=>ok(store.list(viewer(r),postQuery.parse(r.query)),r.id));
 app.post('/api/v1/posts',async(r,reply)=>reply.code(201).send(ok(store.create(owner(r),r.body,r.headers['idempotency-key']),r.id)));
 app.get('/api/v1/posts/:id',async r=>ok(store.get(id(r),viewer(r)),r.id));
 app.patch('/api/v1/posts/:id',async r=>ok(store.update(owner(r),id(r),r.body),r.id));
 app.delete('/api/v1/posts/:id',async r=>ok(store.remove(owner(r),id(r),r.body),r.id));
 app.get('/api/v1/posts/:id/replies',async r=>ok(store.replies(viewer(r),id(r),z.object({cursor:z.coerce.number().int().positive().optional()}).strict().parse(r.query).cursor),r.id));
 app.post('/api/v1/posts/:id/replies',async(r,reply)=>reply.code(201).send(ok(store.addReply(owner(r),id(r),r.body,r.headers['idempotency-key']),r.id)));
 app.delete('/api/v1/posts/:id/replies/:cid',async r=>ok(store.removeReply(owner(r),id(r),z.object({cid:z.coerce.number().int().positive()}).parse(r.params).cid,r.body),r.id));
}
