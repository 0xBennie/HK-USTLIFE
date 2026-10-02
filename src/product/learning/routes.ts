import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { calendarQuerySchema, listSchema, versionSchema } from './schemas.js';
import type { createLearningStore } from './store.js';

export function registerLearningRoutes(app:FastifyInstance, store:ReturnType<typeof createLearningStore>, owner:(request:FastifyRequest)=>string, ok:(data:unknown,id:string)=>unknown) {
  for(const collection of ['courses','items'] as const) {
    const path = `/api/v1/study/${collection}`;
    app.post(path,async (request,reply)=>reply.code(201).send(ok(store.create(owner(request),collection,request.body,request.headers['idempotency-key']),request.id)));
    app.get(path,async request=>{
      const user = owner(request);
      const query = (collection === 'courses' ? listSchema.omit({kind:true,course_id:true}) : listSchema).parse(request.query);
      return ok(store.list(user,collection,query),request.id);
    });
    const id = (request:FastifyRequest) => z.object({id:z.string().uuid()}).parse(request.params).id;
    app.get(`${path}/:id`,async request=>ok(store.get(owner(request),collection,id(request)),request.id));
    app.patch(`${path}/:id`,async request=>ok(store.update(owner(request),collection,id(request),request.body),request.id));
    app.delete(`${path}/:id`,async request=>{
      const user = owner(request), recordId = id(request);
      const {version} = z.object({version:versionSchema}).strict().parse(request.body);
      return ok(store.remove(user,collection,recordId,version),request.id);
    });
  }
  app.get('/api/v1/me/calendar',async request=>ok(store.calendar(owner(request),calendarQuerySchema.parse(request.query)),request.id));
}
