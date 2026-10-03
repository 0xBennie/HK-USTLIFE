import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {transaction} from '../database.js';
import {ApiError} from '../errors.js';
import {blocked} from './access.js';
type Intent={owner_id:string;target_id:string;activity_id:string;willing:number;version:number;updated_at:number;expires_at:number};
const input=z.object({version:z.number().int().min(0),willing:z.boolean(),participated:z.boolean()}).strict();
/** Private declarations only. Confirmed booking does not itself attest attendance. */
export function createReconnections(db:DatabaseSync,now:()=>number){
 const row=(owner:string,activity:string,target:string)=>db.prepare('SELECT * FROM reconnection_intents WHERE owner_id=? AND activity_id=? AND target_id=?').get(owner,activity,target) as Intent|undefined;
 function eligible(owner:string,activity:string,target:string){
  if(owner===target||blocked(db,owner,target))return null;
  const event=db.prepare("SELECT a.organizer_id,a.ends_at FROM activities a JOIN users u ON u.id=a.organizer_id WHERE a.id=? AND a.status!='cancelled' AND a.moderation_state='visible' AND u.banned_at IS NULL").get(activity);
  if(!event||Number(event.ends_at)>now()||Number(event.ends_at)+7*86400000<=now())return null;
  for(const id of [owner,target]){
   if(!db.prepare('SELECT 1 FROM users WHERE id=? AND banned_at IS NULL').get(id)||blocked(db,id,String(event.organizer_id)))return null;
   if(id!==event.organizer_id&&!db.prepare("SELECT 1 FROM activity_participations WHERE activity_id=? AND user_id=? AND status='confirmed'").get(activity,id))return null;
  }
  return Number(event.ends_at)+7*86400000;
 }
 function get(owner:string,activity:string,target:string){
  const own=row(owner,activity,target),other=row(target,activity,owner);
  const expired=!!own&&own.expires_at<=now();
  // Never return incoming intent, its timestamp/version, refusal, or a reason for no match.
  return {activity_id:activity,target_id:target,willing:!!own?.willing,version:own?.version??0,expired,
   expires_at:own?new Date(own.expires_at).toISOString():null,
   mutual:!!(own?.willing&&other?.willing&&!expired&&other.expires_at>now()&&eligible(owner,activity,target))};
 }
 function set(owner:string,activity:string,target:string,raw:unknown){
  const body=input.parse(raw);
  return transaction(db,()=>{
   const old=row(owner,activity,target);
   if((old?.version??0)!==body.version)throw new ApiError(409,'VERSION_CONFLICT','Read your current choice before changing it.');
   const expiry=eligible(owner,activity,target);
   if(body.willing&&(!body.participated||!expiry))throw new ApiError(404,'RECONNECTION_UNAVAILABLE','This reconnection is unavailable.');
   if(!old&&!body.willing)return get(owner,activity,target);
   if(!old&&Number(db.prepare('SELECT COUNT(*) AS n FROM reconnection_intents WHERE owner_id=?').get(owner)!.n)>=500)throw new ApiError(409,'INTENT_LIMIT','Private intent limit reached.');
   db.prepare(`INSERT INTO reconnection_intents VALUES(?,?,?,?,1,?,?) ON CONFLICT(owner_id,target_id,activity_id) DO UPDATE SET willing=excluded.willing,version=version+1,updated_at=excluded.updated_at,expires_at=excluded.expires_at`).run(owner,target,activity,body.willing?1:0,now(),expiry??old!.expires_at);
   return get(owner,activity,target);
  });
 }
 function list(owner:string){return (db.prepare('SELECT activity_id,target_id FROM reconnection_intents WHERE owner_id=? ORDER BY updated_at DESC,activity_id,target_id LIMIT 500').all(owner) as {activity_id:string;target_id:string}[]).map(r=>get(owner,r.activity_id,r.target_id));}
 type Card={text:string;version:number;own_consent:number;peer_consent:number};
 function purgeExpiredCards(){
  const at=now();
  return db.prepare(`UPDATE reconnection_cards SET text='',version=version+1 WHERE text!='' AND (
   NOT EXISTS(SELECT 1 FROM reconnection_intents i WHERE i.owner_id=reconnection_cards.owner_id AND i.target_id=reconnection_cards.target_id AND i.activity_id=reconnection_cards.activity_id AND i.willing=1 AND i.expires_at>? AND i.version=reconnection_cards.own_consent)
   OR NOT EXISTS(SELECT 1 FROM reconnection_intents i WHERE i.owner_id=reconnection_cards.target_id AND i.target_id=reconnection_cards.owner_id AND i.activity_id=reconnection_cards.activity_id AND i.willing=1 AND i.expires_at>? AND i.version=reconnection_cards.peer_consent)
  )`).run(at,at).changes;
 }
 const card=(owner:string,activity:string,target:string)=>db.prepare('SELECT text,version,own_consent,peer_consent FROM reconnection_cards WHERE owner_id=? AND activity_id=? AND target_id=?').get(owner,activity,target) as Card|undefined;
 function cards(owner:string,activity:string,target:string){
  purgeExpiredCards();
  const mine=card(owner,activity,target),peer=card(target,activity,owner),own=row(owner,activity,target),other=row(target,activity,owner);
  const visible=get(owner,activity,target).mutual&&peer?.text&&peer.own_consent===other?.version&&peer.peer_consent===own?.version;
  return {activity_id:activity,target_id:target,mine:{text:mine?.text??'',version:mine?.version??0},peer:visible?{text:peer!.text}:null};
 }
 function saveCard(owner:string,activity:string,target:string,raw:unknown){
  const body=z.object({version:z.number().int().min(0),text:z.string().trim().max(300)}).strict().parse(raw);
  purgeExpiredCards();
  return transaction(db,()=>{
   const old=card(owner,activity,target);
   if((old?.version??0)!==body.version)throw new ApiError(409,'VERSION_CONFLICT','Read the current contact card before editing.');
   if(body.text&&!get(owner,activity,target).mutual)throw new ApiError(404,'RECONNECTION_UNAVAILABLE','Contact sharing is unavailable.');
   if(!old&&!body.text)return cards(owner,activity,target);
   db.prepare(`INSERT INTO reconnection_cards VALUES(?,?,?,?,1,?,?) ON CONFLICT(owner_id,target_id,activity_id) DO UPDATE SET text=excluded.text,version=version+1,own_consent=excluded.own_consent,peer_consent=excluded.peer_consent`).run(owner,target,activity,body.text,row(owner,activity,target)?.version??0,row(target,activity,owner)?.version??0);
   return cards(owner,activity,target);
  });
 }
 function exportCards(owner:string){purgeExpiredCards();return db.prepare('SELECT activity_id,target_id,text,version FROM reconnection_cards WHERE owner_id=? ORDER BY activity_id,target_id').all(owner);}
 purgeExpiredCards();
 return {get,set,list,cards,saveCard,exportCards,purgeExpiredCards};
}
