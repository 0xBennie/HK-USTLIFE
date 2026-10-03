import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { providerSchema, schoolListSchema } from './schemas.js';
import type { createSchoolStore } from './store.js';

export function registerSchoolRoutes(app:FastifyInstance,store:ReturnType<typeof createSchoolStore>,owner:(request:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown) {
  app.get('/api/v1/school/connections',async request=>ok(store.status(owner(request)),request.id));
  app.get('/api/v1/school/records',async request=>{
    const user=owner(request),query=schoolListSchema.parse(request.query);
    return ok({...store.list(user,query),connections:store.status(user)},request.id);
  });
  const id=(request:FastifyRequest)=>z.object({id:z.string().uuid()}).parse(request.params).id;
  app.get('/api/v1/school/records/:id',async request=>ok(store.get(owner(request),id(request)),request.id));
  app.patch('/api/v1/school/records/:id/personal',async request=>ok(store.annotate(owner(request),id(request),request.body),request.id));
  app.delete('/api/v1/school/connections/:provider',async request=>{
    const user=owner(request),{provider}=z.object({provider:providerSchema}).parse(request.params);
    const body=z.object({version:z.number().int().positive(),delete_cached_data:z.boolean()}).strict().parse(request.body);
    return ok(store.revoke(user,provider,body.version,body.delete_cached_data),request.id);
  });
}
