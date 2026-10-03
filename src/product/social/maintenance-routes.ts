import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createSocialStore} from './store.js';
export function registerActivityMaintenanceRoutes(app:FastifyInstance,store:ReturnType<typeof createSocialStore>,admin:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const id=(r:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(r.params).id;
 app.get('/api/v1/admin/activities',async r=>ok(store.adminList(admin(r),r.query),r.id));
 app.get('/api/v1/admin/activities/:id',async r=>ok(store.adminGet(admin(r),id(r)),r.id));
 app.get('/api/v1/admin/activities/:id/history',async r=>ok(store.adminHistory(admin(r),id(r)),r.id));
 app.post('/api/v1/admin/activities/:id/maintain',async r=>ok(store.adminChange(admin(r),id(r),r.body),r.id));
}
