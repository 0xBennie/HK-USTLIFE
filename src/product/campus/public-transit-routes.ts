import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {createPublicTransit} from './public-transit.js';
export function registerPublicTransitRoutes(app:FastifyInstance,transit:ReturnType<typeof createPublicTransit>,ok:(data:unknown,id:string)=>unknown) {
 const params=z.object({id:z.string().min(1).max(100)});
 app.get('/api/v1/transport/public/routes',async request=>ok(await transit.catalog(),request.id));
 app.get('/api/v1/transport/public/routes/:id/stops',async request=>ok(await transit.stops(params.parse(request.params).id),request.id));
 app.get('/api/v1/transport/public/routes/:id/arrivals',async request=>{
  const {stop_sequence}=z.object({stop_sequence:z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(300))}).strict().parse(request.query);
  return ok(await transit.arrivals(params.parse(request.params).id,stop_sequence),request.id);
 });
}
