import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {createDirectoryStore} from './directory.js';
export function registerDirectoryRoutes(app:FastifyInstance,store:ReturnType<typeof createDirectoryStore>,owner:(r:FastifyRequest)=>string,ok:(data:unknown,id:string)=>unknown) {
  app.get('/api/v1/campus/places',async r=>ok(store.list(r.query),r.id));
  app.get('/api/v1/campus/places/:id',async r=>ok(store.entry(z.object({id:z.string().max(100)}).parse(r.params).id),r.id));
  app.get('/api/v1/me/campus/bookmarks',async r=>ok(store.bookmarks(owner(r)),r.id));
  app.put('/api/v1/me/campus/bookmarks',async r=>ok(store.bookmark(owner(r),r.body,true),r.id));
  app.delete('/api/v1/me/campus/bookmarks',async r=>ok(store.bookmark(owner(r),r.body,false),r.id));
  app.get('/api/v1/me/campus/corrections',async r=>ok(store.corrections(owner(r)),r.id));
  app.post('/api/v1/campus/corrections',async(r,reply)=>reply.code(201).send(ok(store.correction(owner(r),r.body,r.headers['idempotency-key']),r.id)));
}
