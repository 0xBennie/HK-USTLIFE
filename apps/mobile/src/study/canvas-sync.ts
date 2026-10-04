// Keeps Canvas deadlines fresh: re-sync at most every 30 minutes while the app is in use.
import {session} from '../runtime';
import type {Profile} from '../session';
let last=0;
export async function syncCanvasIfDue(profile:Profile){
 if(profile.connections?.canvas!=='connected'&&profile.connections?.canvas!=='partial')return;
 if(Date.now()-last<30*60_000)return;last=Date.now();
 try{await session.request('/school/canvas/sync',{method:'POST',body:{}});}catch{/* shown on the school page */}
}
