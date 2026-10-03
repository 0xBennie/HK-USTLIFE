import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createReconnections} from './reconnections.js';
export function registerReconnectionRoutes(app:FastifyInstance,store:ReturnType<typeof createReconnections>,owner:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const params=(r:FastifyRequest)=>z.object({id:z.string().uuid(),target:z.string().uuid()}).strict().parse(r.params);
 app.get('/api/v1/me/reconnections',async r=>ok({items:store.list(owner(r))},r.id));
 app.get('/api/v1/activities/:id/reconnections/:target',async r=>{const user=owner(r),p=params(r);return ok(store.get(user,p.id,p.target),r.id);});
 app.put('/api/v1/activities/:id/reconnections/:target',async r=>{const user=owner(r),p=params(r);return ok(store.set(user,p.id,p.target,r.body),r.id);});
}
