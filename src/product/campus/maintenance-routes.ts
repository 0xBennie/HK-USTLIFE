import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createMaintenanceStore} from './maintenance.js';
import type {createDirectoryStore} from './directory.js';
export function registerMaintenanceRoutes(app:FastifyInstance,store:ReturnType<typeof createMaintenanceStore>,directory:ReturnType<typeof createDirectoryStore>,admin:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown){
 const id=(r:FastifyRequest)=>z.object({id:z.string().min(1).max(100)}).parse(r.params).id;
 app.get('/api/v1/admin/campus/places',async r=>{admin(r);return ok(directory.list({}),r.id);});
 app.get('/api/v1/admin/campus/corrections',async r=>{admin(r);return ok(store.listCorrections(r.query),r.id);});
 app.get('/api/v1/admin/campus/history',async r=>{admin(r);return ok(store.history(r.query),r.id);});
 app.post('/api/v1/admin/campus/source-checks',async r=>ok(await store.checkSource(admin(r),r.body),r.id));
 app.post('/api/v1/admin/campus/places/:id',async r=>ok(store.editPlace(admin(r),id(r),r.body),r.id));
 app.post('/api/v1/admin/campus/corrections/:id/resolve',async r=>ok(store.resolve(admin(r),id(r),r.body),r.id));
}
