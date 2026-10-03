import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createAffairsStore} from './store.js';
const listSchema=z.object({limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(256).optional(),state:z.enum(['active','archived']).default('active')}).strict();
export function registerAffairsRoutes(app:FastifyInstance,store:ReturnType<typeof createAffairsStore>,owner:(r:FastifyRequest)=>string,ok:(d:unknown,id:string)=>unknown){
 const id=(r:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(r.params).id;
 app.get('/api/v1/affairs/templates',async r=>ok(store.catalog(z.object({limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(120).optional()}).strict().parse(r.query)),r.id));
 app.get('/api/v1/affairs/templates/:id',async r=>ok(store.template(z.object({id:z.string().min(1).max(120)}).parse(r.params).id),r.id));
 app.get('/api/v1/me/affairs',async r=>ok(store.list(owner(r),listSchema.parse(r.query)),r.id));
 app.post('/api/v1/me/affairs',async(r,reply)=>reply.code(201).send(ok(store.create(owner(r),r.body,r.headers['idempotency-key']),r.id)));
 app.get('/api/v1/me/affairs/:id',async r=>ok(store.get(owner(r),id(r)),r.id));
 app.patch('/api/v1/me/affairs/:id',async r=>ok(store.update(owner(r),id(r),r.body),r.id));
 app.post('/api/v1/me/affairs/:id/accept-revision',async r=>ok(store.acceptRevision(owner(r),id(r),r.body,r.headers['idempotency-key']),r.id));
 app.delete('/api/v1/me/affairs/:id',async r=>{const user=owner(r);return ok(store.remove(user,id(r),z.object({version:z.number().int().positive()}).strict().parse(r.body).version),r.id);});
}
