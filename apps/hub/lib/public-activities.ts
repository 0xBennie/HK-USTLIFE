import type {Activity} from '../../../src/product/social/types';
import {upstream,WebFailure,type WebConfig} from './product-web';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function publicActivity(config:WebConfig,id:string):Promise<Activity>{
 if(!uuid.test(id))throw new WebFailure(404,'NOT_FOUND','Activity unavailable.');
 const result=await upstream(config,'/activities/'+id);
 if(result.status!==200)throw new WebFailure(result.status===404?404:503,'ACTIVITY_UNAVAILABLE','Activity unavailable.');
 const activity=result.payload.data as Activity;
 if(activity.visibility!=='public'||activity.mine!==null)throw new WebFailure(404,'NOT_FOUND','Activity unavailable.');
 return activity;
}
export async function publicActivities(config:WebConfig,cursor?:string):Promise<{items:Activity[];next_cursor:string|null}>{
 if(cursor&&!uuid.test(cursor))throw new WebFailure(400,'INVALID_CURSOR','Refresh the activity list.');
 const result=await upstream(config,'/activities?limit=20'+(cursor?'&cursor='+cursor:''));
 if(result.status!==200)throw new WebFailure(result.status===404?400:503,'ACTIVITIES_UNAVAILABLE','Refresh the activity list.');
 const page=result.payload.data as {items:Activity[];next_cursor:string|null};
 if(!Array.isArray(page.items)||page.items.some(a=>a.visibility!=='public'||a.mine!==null))throw new WebFailure(503,'INVALID_RESPONSE','Public activities are unavailable.');
 return page;
}
