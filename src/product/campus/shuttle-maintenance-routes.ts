import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createShuttleStore} from './shuttle-store.js';
export function registerShuttleMaintenanceRoutes(app:FastifyInstance,store:ReturnType<typeof createShuttleStore>,admin:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const id=(r:FastifyRequest)=>z.object({id:z.string().min(1).max(100)}).parse(r.params).id;
 app.get('/api/v1/admin/campus/shuttle',async r=>{admin(r);return ok(store.read(),r.id);});
 app.post('/api/v1/admin/campus/shuttle/routes/:id',async r=>ok(store.editRoute(admin(r),id(r),r.body),r.id));
 app.post('/api/v1/admin/campus/shuttle/routes/:id/preview',async r=>{admin(r);return ok(store.preview(id(r),r.body),r.id);});
 app.post('/api/v1/admin/campus/shuttle/holidays',async r=>ok(store.editHolidays(admin(r),r.body),r.id));
}
