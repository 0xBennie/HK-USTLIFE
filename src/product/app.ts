import {projectSchoolCalendar} from './school/projection.js';
import type {Contracts} from './school/schemas.js';
import { createSchoolStore } from './school/store.js';
import { registerSchoolRoutes } from './school/routes.js';
import {registerActivityMaintenanceRoutes} from './social/maintenance-routes.js';
import {createShuttleStore} from './campus/shuttle-store.js';
import {registerShuttleMaintenanceRoutes} from './campus/shuttle-maintenance-routes.js';
import {createMaintenanceStore} from './campus/maintenance.js';
import {registerMaintenanceRoutes} from './campus/maintenance-routes.js';
import {createGovernanceStore} from './social/governance.js';
import {registerGovernanceRoutes} from './social/governance-routes.js';
import {createWallStore} from './social/wall.js';
import {registerWallRoutes} from './social/wall-routes.js';
import {createSocialStore} from './social/store.js';
import {registerSocialRoutes} from './social/routes.js';
import {createPublicTransit} from './campus/public-transit.js';
import {registerPublicTransitRoutes} from './campus/public-transit-routes.js';
import { createDirectoryStore } from './campus/directory.js';
import { registerDirectoryRoutes } from './campus/directory-routes.js';
import { registerCampusRoutes } from './campus/routes.js';
import { calendarQuerySchema } from './learning/schemas.js';
import Fastify from 'fastify';
import { z, ZodError } from 'zod';
import { openDatabase } from './database.js';
import { createAuth } from './auth.js';
import { ApiError } from './errors.js';
import { createLearningStore } from './learning/store.js';
import { createCalendarStore } from './calendar/store.js';
import { registerCalendarRoutes } from './calendar/routes.js';
import { registerLearningRoutes } from './learning/routes.js';
import { projectReminders, REMINDER_DAYS } from './reminders/projection.js';

export function createProductApp(options: { dataDir: string; now?: () => number; transitFetch?: typeof fetch; sourceFetch?:typeof fetch; schoolContracts?:Contracts }) {
  if (process.env.NODE_ENV === 'production') throw new Error('Local development mail is forbidden in production.');
  const now = options.now ?? Date.now;
  const db = openDatabase(options.dataDir);
  // The normal local app supplies no school registry; only server-owned approved adapters may configure it.
  const school = createSchoolStore(db,now,options.schoolContracts);
  const auth = createAuth(db, options.dataDir, now, id=>{
    const connections=school.status(id);
    return {sis:connections[0].state,canvas:connections[1].state};
  });
  const learning = createLearningStore(db,now);
  const calendars = createCalendarStore(db,now);
  const directory = createDirectoryStore(db,now);
  const wall=createWallStore(db,now);
  const social=createSocialStore(db,now);
  const governance=createGovernanceStore(db,now,wall,social);
  const app = Fastify({ logger: false, bodyLimit: 32_768, trustProxy: false });
  app.addHook('onClose', async () => { db.close(); });
  const localHost = (host: string | undefined) => /^((localhost)|(127\.0\.0\.1)|(\[::1\]))(:\d+)?$/.test(host ?? '');
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip) || !localHost(request.headers.host)) throw new ApiError(403, 'LOCAL_ONLY', 'Development API is local only.');
    // Native uses bearer headers. Browser integration will use a same-origin proxy;
    // accepting arbitrary origins here would expose local development mail/accounts.
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) throw new ApiError(403, 'ORIGIN_FORBIDDEN', 'Origin is not allowed.');
  });
  const ok = (data: unknown, requestId: string) => ({ data, meta: { request_id: requestId, generated_at: new Date(now()).toISOString(), mode: 'local-development' } });
  registerGovernanceRoutes(app,governance,request=>auth.requireUser(request.headers.authorization).id,request=>{const user=auth.requireUser(request.headers.authorization);if(user.role!=='admin')throw new ApiError(403,'ADMIN_REQUIRED','Administrator access required.');return user.id;},ok);
  registerWallRoutes(app,wall,request=>auth.requireUser(request.headers.authorization).id,ok);
  registerSocialRoutes(app,social,request=>auth.requireUser(request.headers.authorization).id,ok);
  const requireAdmin=(request:import('fastify').FastifyRequest)=>{const user=auth.requireUser(request.headers.authorization);if(user.role!=='admin')throw new ApiError(403,'ADMIN_REQUIRED','Administrator access required.');return user.id;};
  const maintenance=createMaintenanceStore(db,directory,now,options.sourceFetch);
  const shuttles=createShuttleStore(db,now,maintenance);
  registerCampusRoutes(app,ok,now,()=>shuttles.read().catalog);
  registerActivityMaintenanceRoutes(app,social,requireAdmin,ok);
  registerShuttleMaintenanceRoutes(app,shuttles,requireAdmin,ok);
  registerPublicTransitRoutes(app,createPublicTransit({now,fetch:options.transitFetch}),ok);
  registerMaintenanceRoutes(app,maintenance,directory,requireAdmin,ok);
  registerDirectoryRoutes(app,directory,request=>auth.requireUser(request.headers.authorization).id,ok);
  registerSchoolRoutes(app,school,request=>auth.requireUser(request.headers.authorization).id,ok);
  registerLearningRoutes(app,learning,request=>auth.requireUser(request.headers.authorization).id,ok);
  registerCalendarRoutes(app,calendars,request=>auth.requireUser(request.headers.authorization).id,ok);
  app.get('/api/v1/me/calendar',async request=>{
    const user=auth.requireUser(request.headers.authorization).id,query=calendarQuerySchema.parse(request.query);
    const imported=calendars.occurrences(user,query);
    const projected=projectSchoolCalendar(school.exportAll(user));
    return ok({...learning.calendar(user,query,[...imported.items,...social.calendar(user),...projected.items]),import_issues:imported.issues,school_connections:school.status(user),school_issues:projected.issues},request.id);
  });
  app.get('/api/v1/me/reminders',async request=>{
    const user=auth.requireUser(request.headers.authorization).id,time=now();
    const range={from:new Date(time-86400_000).toISOString().slice(0,10),to:new Date(time+(REMINDER_DAYS+8)*86400_000).toISOString().slice(0,10)};
    const imported=calendars.occurrences(user,range);
    const projected=projectSchoolCalendar(school.exportAll(user));
    return ok({...projectReminders(user,[...learning.exportAll(user).items,...imported.items,...social.calendar(user),...projected.reminder_items],time,imported.issues),school_issues:projected.issues},request.id);
  });
  app.setErrorHandler((error, request, reply) => {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    const e = error instanceof ApiError ? error : error instanceof ZodError
      ? new ApiError(400, 'INVALID_INPUT', 'Check the submitted fields.')
      : new ApiError(status < 500 ? status : 500, 'REQUEST_FAILED', 'The request could not be completed.');
    if (e.retryAfter) reply.header('Retry-After', e.retryAfter);
    return reply.code(e.status).send({ error: { code: e.code, message: e.message, retryable: e.status === 429 || e.status >= 500, request_id: request.id } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found.', retryable: false, request_id: request.id } }));
  app.get('/api/v1/auth/methods', async request => ok({ email: { status: 'local_development_only' }, school_sso: { status: 'approval_required' }, remote_push: { status: 'not_configured' } }, request.id));
  app.post('/api/v1/auth/email/challenges', async (request, reply) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict().parse(request.body);
    return reply.code(202).send(ok(auth.challenge(email, request.ip), request.id));
  });
  app.post('/api/v1/auth/email/verify', async request => {
    const body = z.object({ challenge_id: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict().parse(request.body);
    return ok(auth.verify(body.challenge_id, body.code), request.id);
  });
  app.get('/api/v1/me', async request => ok(auth.profile(auth.requireUser(request.headers.authorization).id), request.id));
  app.patch('/api/v1/me', async request => {
    const user = auth.requireUser(request.headers.authorization);
    const body = z.object({ display_name: z.string().trim().max(80).optional(), language: z.enum(['zh', 'en']).optional() }).strict().refine(v => Object.keys(v).length > 0).parse(request.body);
    if (body.display_name !== undefined) db.prepare('UPDATE users SET display_name=? WHERE id=?').run(body.display_name, user.id);
    if (body.language !== undefined) db.prepare('UPDATE users SET language=? WHERE id=?').run(body.language, user.id);
    return ok(auth.profile(user.id), request.id);
  });
  app.get('/api/v1/me/export', async request => {
    const user = auth.requireUser(request.headers.authorization);
    return ok({ version: 5, school:school.exportAll(user.id), governance:governance.exportAll(user.id), wall:wall.exportAll(user.id), social:social.exportAll(user.id), campus:directory.exportAll(user.id), calendars: calendars.exportAll(user.id), profile: auth.profile(user.id), learning: learning.exportAll(user.id), exported_at: new Date(now()).toISOString() }, request.id);
  });
  app.delete('/api/v1/me', async request => {
    const user = auth.requireUser(request.headers.authorization);
    z.object({ confirmation: z.literal('DELETE') }).strict().parse(request.body);
    auth.deleteAccount(user,()=>social.deleteAccount(user.id));
    return ok({ deleted: true }, request.id);
  });
  app.post('/api/v1/auth/logout', async request => {
    auth.requireUser(request.headers.authorization);
    auth.logout(request.headers.authorization!);
    return ok({ signed_out: true }, request.id);
  });
  app.get('/api/v1/admin/status', async request => {
    if (auth.requireUser(request.headers.authorization).role !== 'admin') throw new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access required.');
    return ok({ development_only: true, database: 'ready' }, request.id);
  });
  return app;
}
