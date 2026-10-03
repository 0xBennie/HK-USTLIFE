import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createSocialStore} from './store.js';
import {activityQuery} from './schemas.js';
export function registerSocialRoutes(app:FastifyInstance,store:ReturnType<typeof createSocialStore>,owner:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const viewer=(r:FastifyRequest)=>r.headers.authorization?owner(r):null;
 const id=(r:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(r.params).id;
 const before=(r:FastifyRequest)=>z.object({cursor:z.coerce.number().int().positive().optional()}).strict().parse(r.query).cursor;
 app.get('/api/v1/activities',async r=>ok(store.list(viewer(r),activityQuery.parse(r.query)),r.id));
 app.post('/api/v1/activities',async(r,reply)=>reply.code(201).send(ok(store.create(owner(r),r.body,r.headers['idempotency-key']),r.id)));
 app.get('/api/v1/activities/:id',async r=>ok(store.get(id(r),viewer(r)),r.id));
 app.patch('/api/v1/activities/:id',async r=>ok(store.update(owner(r),id(r),r.body),r.id));
 app.delete('/api/v1/activities/:id',async r=>ok(store.remove(owner(r),id(r),r.body),r.id));
 app.post('/api/v1/activities/:id/join',async r=>ok(store.join(owner(r),id(r),r.body,r.headers['idempotency-key']),r.id));
 app.post('/api/v1/activities/:id/withdraw',async r=>ok(store.withdraw(owner(r),id(r),r.body,r.headers['idempotency-key']),r.id));
 app.post('/api/v1/activities/:id/cancel',async r=>ok(store.cancel(owner(r),id(r),r.body),r.id));
 app.put('/api/v1/activities/:id/preferences',async r=>ok(store.setPreferences(owner(r),id(r),r.body),r.id));
 app.get('/api/v1/activities/:id/participants',async r=>ok(store.roster(owner(r),id(r)),r.id));
 app.get('/api/v1/activities/:id/comments',async r=>ok(store.comments(viewer(r),id(r),before(r)),r.id));
 app.post('/api/v1/activities/:id/comments',async(r,reply)=>reply.code(201).send(ok(store.addComment(owner(r),id(r),r.body,r.headers['idempotency-key']),r.id)));
 app.delete('/api/v1/activities/:id/comments/:cid',async r=>ok(store.deleteComment(owner(r),id(r),z.object({cid:z.coerce.number().int().positive()}).parse(r.params).cid,r.body),r.id));
 app.get('/api/v1/me/notifications',async r=>ok(store.notifications(owner(r),before(r)),r.id));
 app.post('/api/v1/me/notifications/read-all',async r=>{z.object({}).strict().parse(r.body??{});return ok(store.markAllRead(owner(r)),r.id);});
 app.patch('/api/v1/me/notifications/:nid/read',async r=>{z.object({}).strict().parse(r.body);return ok(store.markRead(owner(r),z.object({nid:z.coerce.number().int().positive()}).parse(r.params).nid),r.id);});
}
