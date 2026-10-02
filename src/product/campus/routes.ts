import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {departureQuery,plannedDepartures,shuttleRoutes} from './shuttle.js';
export function registerCampusRoutes(app:FastifyInstance,ok:(data:unknown,id:string)=>unknown,now:()=>number) {
  app.get('/api/v1/transport/routes',async request=>ok(shuttleRoutes(now()),request.id));
  app.get('/api/v1/transport/routes/:id/departures',async request=>{
    const {id}=z.object({id:z.string().max(100)}).parse(request.params),query=departureQuery.parse(request.query);
    return ok(plannedDepartures(id,query.at??new Date(now()).toISOString(),now()),request.id);
  });
}
