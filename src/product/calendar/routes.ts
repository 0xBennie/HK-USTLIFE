import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createCalendarStore} from './store.js';
export function registerCalendarRoutes(app:FastifyInstance,store:ReturnType<typeof createCalendarStore>,owner:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown) {
  const id=(r:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(r.params).id;
  app.post('/api/v1/calendar/imports/preview',{bodyLimit:550_000},async(r,reply)=>reply.code(201).send(ok(store.preview(owner(r),r.body),r.id)));
  app.post('/api/v1/calendar/imports/:id/confirm',async r=>ok(store.confirm(owner(r),id(r),r.body),r.id));
  app.get('/api/v1/calendar/sources',async r=>ok(store.exportAll(owner(r)).map(({series,...source})=>({...source,series_count:series.length})),r.id));
  app.delete('/api/v1/calendar/sources/:id',async r=>{
    const user=owner(r),sourceId=id(r),{version}=z.object({version:z.number().int().positive()}).strict().parse(r.body);
    return ok(store.remove(user,sourceId,version),r.id);
  });
}
