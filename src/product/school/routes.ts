import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { providerSchema, schoolListSchema } from './schemas.js';
import type { createSchoolStore } from './store.js';

export function registerSchoolRoutes(app:FastifyInstance,store:ReturnType<typeof createSchoolStore>,owner:(request:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown,canvas?:{connect:(owner:string,token:string)=>Promise<unknown>;sync:(owner:string)=>Promise<unknown>;forget:(owner:string)=>void}) {
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
    const result=store.revoke(user,provider,body.version,body.delete_cached_data);
    if(provider==='canvas')canvas?.forget(user);
    return ok(result,request.id);
  });
  if(canvas){
    app.post('/api/v1/school/canvas/connect',async request=>ok(await canvas.connect(owner(request),z.object({token:z.string().min(1).max(300)}).strict().parse(request.body).token),request.id));
    app.post('/api/v1/school/canvas/sync',async request=>ok(await canvas.sync(owner(request)),request.id));
  }
}
