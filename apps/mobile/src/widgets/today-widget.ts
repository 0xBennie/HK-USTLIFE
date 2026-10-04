// Feeds the home/lock-screen widget from real data each time the app opens (or data changes).
import {session,api} from '../runtime';
import type {Calendar} from '../study/types';
import {dateTimeInZone} from '../study/dates';

const hk=(iso:string)=>dateTimeInZone(iso,'Asia/Hong_Kong');
export async function refreshWidget(){
 try{
  if(!session.snapshot().profile)return;
  const {default:TodayWidget}=await import('./TodayWidget');
  const now=new Date().toISOString(),today=hk(now).slice(0,10),tomorrow=hk(new Date(Date.now()+864e5).toISOString()).slice(0,10);
  const cal=await session.request<Calendar>(`/me/calendar?from=${today}&to=${tomorrow}&timezone=Asia%2FHong_Kong`);
  const tasks=(cal.days.find(d=>d.date===today)?.tasks??[]).filter(t=>t.kind==='task'&&t.status==='open') as Extract<Calendar['days'][number]['tasks'][number],{kind:'task'}>[];
  tasks.sort((a,b)=>(a.due_at??'9').localeCompare(b.due_at??'9'));
  const first=tasks[0];
  let rideLabel='下一班 · 坑口',rideTime='—',liveLabel='';
  try{
   const routes=await api.request<{routes:{id:string;direction:string;name:{zh:string}}[]}>('/transport/routes');
   // Same default as the campus board: the shuttle leaving HKUST for Hang Hau.
   const r=routes.routes.find(x=>/→\s*坑口/.test(x.name.zh));
   if(r){const d=await api.request<{upcoming:{local_time:string}[]}>(`/transport/routes/${r.id}/departures`);rideLabel=`下一班 · ${(r.name.zh.split('→').pop()??'').trim()}`;rideTime=d.upcoming[0]?.local_time??'今天停运';}
  }catch{}
  TodayWidget.updateSnapshot({due:tasks.length,firstDue:first?first.title.split(/[:：]/)[0]:'',firstDueAt:first?.due_at?hk(first.due_at).slice(11):'今天',overdue:'',rideLabel,rideTime,liveLabel,updated:hk(now).slice(11)});
 }catch{/* widget is best-effort; the app works without it */}
}
