// Pen "V6 / 隐私与安全（举报与屏蔽）" (ctYQS): people I blocked (unblock) and my reports with their review status.
// Reloads on focus and when the app returns to the foreground; no manual refresh button.
import {useSceneFocus} from '../navigation/TabScene';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Pressable,Text,View} from 'react-native';
import {session} from '../runtime';
import type {Language} from '../strings';
import type {BlockedUser,ContentReport} from '../../../../src/product/social/governance-types';
import {kindLabel,reportReasonLabel} from './SafetyActions';
import {wallError} from './wall-shared';
import {GradientAvatar} from './wall-ui';
import {LifeTop} from '../life/kit';
import {Notice,PenIcon,Skeleton,usePenColors} from '../ui/Pen';
import {feel} from '../ui/feel';
import {hk,hhmm} from './activity-time';

const monthDay=(iso:string,zh:boolean)=>{const d=hk(iso);return zh?`${d.getUTCMonth()+1} 月 ${d.getUTCDate()} 日`:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});};
const statusChip=(status:ContentReport['status'],zh:boolean,muted:string):[string,string,string]=>status==='pending'?[zh?'待处理':'Pending','#D98A1C1F','#B8741A']:status==='action_taken'?[zh?'已处理':'Action taken','#2E9E5B1F','#2E9E5B']:[zh?'已审阅':'Reviewed','#7676801A',muted];

export function GovernanceScreen({language,onBack}:{language:Language;dark?:boolean;onBack:()=>void}){
 const sceneActive=useSceneFocus();
 const zh=language==='zh',c=usePenColors();
 const [blocks,setBlocks]=useState<BlockedUser[]|null>(null),[reports,setReports]=useState<ContentReport[]|null>(null),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 const load=useCallback(async(next?:string)=>{const generation=++epoch.current;setBusy(true);setError('');try{
  const [users,page]=await Promise.all([session.request<BlockedUser[]>('/me/blocks'),session.request<{items:ContentReport[];next_cursor:string|null}>('/me/reports'+(next?'?cursor='+next:''))]);
  if(alive.current&&generation===epoch.current){setBlocks(users);setReports(old=>next?[...(old??[]),...page.items.filter(x=>!(old??[]).some(y=>y.id===x.id))]:page.items);setCursor(page.next_cursor);}
 }catch(e){if(alive.current&&generation===epoch.current)setError(wallError(e,language));}finally{if(alive.current&&generation===epoch.current)setBusy(false);}},[language]);
 useEffect(()=>{if(!sceneActive)return;void load();const listener=AppState.addEventListener('change',s=>{if(s==='active'&&!lock.current)void load();});return()=>{epoch.current++;listener.remove();};},[load,sceneActive]);
 async function unblock(id:string){if(lock.current)return;lock.current=true;epoch.current++;setBusy(true);setError('');try{await session.request(`/me/blocks/${id}`,{method:'DELETE',body:{}});if(alive.current){feel.success();await load();}}catch(e){if(alive.current)setError(wallError(e,language));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const confirmUnblock=(u:BlockedUser)=>Alert.alert(zh?`解除屏蔽 ${u.display_name}？`:`Unblock ${u.display_name}?`,zh?'不会恢复之前退出的报名、收藏或日程。如果对方仍屏蔽你，内容依旧不可见。':'Previous signups, bookmarks and calendars are not restored. If they still block you, their content remains hidden.',[{text:zh?'返回':'Go back',style:'cancel'},{text:zh?'解除屏蔽':'Unblock',onPress:()=>void unblock(u.id)}]);
 const label=(t:string)=><Text style={{paddingHorizontal:4,paddingTop:8,fontSize:13,fontWeight:'600',color:c.muted}}>{t}</Text>;
 const card={borderRadius:20,overflow:'hidden' as const,backgroundColor:c.surface};
 const emptyRow=(t:string)=><View style={{paddingVertical:14,paddingHorizontal:16}}><Text style={{fontSize:15,color:c.muted}}>{t}</Text></View>;
 return <View style={{gap:12}}>
  <LifeTop zh={zh} title={zh?'隐私与安全':'Privacy & safety'} onBack={onBack}/>
  <Text style={{paddingHorizontal:4,fontSize:13,lineHeight:18,color:c.muted}}>{zh?'你的课表、任务和笔记默认只有自己可见。举报只有你和管理员能看到。':'Your timetable, tasks and notes are private by default. Only you and administrators see your reports.'}</Text>
  {error?<Notice tone="error" text={error} action={zh?'重试':'Retry'} onAction={()=>void load()}/>:null}
  {label(zh?'我屏蔽的人':'People I blocked')}
  {blocks===null?<Skeleton height={64} radius={20}/>:<View style={card}>
   {blocks.length?blocks.map((u,i)=><View key={u.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
    <GradientAvatar name={u.display_name} size={34}/>
    <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{u.display_name}</Text><Text style={{fontSize:13,color:c.muted}}>{zh?`${monthDay(u.created_at,zh)}屏蔽`:`Blocked ${monthDay(u.created_at,zh)}`}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={zh?`解除屏蔽 ${u.display_name}`:`Unblock ${u.display_name}`} disabled={busy} hitSlop={8} onPress={()=>confirmUnblock(u)} style={({pressed})=>({opacity:busy?0.4:pressed?0.6:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{zh?'解除屏蔽':'Unblock'}</Text></Pressable>
   </View>):emptyRow(zh?'没有屏蔽任何人':'You haven’t blocked anyone')}
  </View>}
  {label(zh?'我的举报':'My reports')}
  {reports===null?<Skeleton height={84} radius={20}/>:<View style={card}>
   {reports.length?reports.map((r,i)=>{const [st,bg,fg]=statusChip(r.status,zh,c.text);return <View key={r.id} style={{flexDirection:'row',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
    <View style={{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:c.fill}}><PenIcon name="flag" size={16} color={c.muted}/></View>
    <View style={{flex:1,gap:2}}>
     <Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{kindLabel(r.target.kind,zh)} · {reportReasonLabel(r.reason,zh)}</Text>
     <Text style={{fontSize:13,color:c.muted}}>{monthDay(r.created_at,zh)} {hhmm(r.created_at)}</Text>
     {r.details?<Text selectable style={{fontSize:13,lineHeight:18,color:c.text}}>{zh?'说明：':'Details: '}{r.details}</Text>:null}
     {r.resolution?<Text selectable style={{fontSize:13,lineHeight:18,color:c.text}}>{zh?'处理说明：':'Review note: '}{r.resolution}</Text>:null}
    </View>
    <View style={{alignSelf:'flex-start',paddingVertical:3,paddingHorizontal:8,borderRadius:99,backgroundColor:bg}}><Text style={{fontSize:12,fontWeight:'600',color:fg}}>{st}</Text></View>
   </View>;}):emptyRow(zh?'还没有举报记录':'No reports yet')}
   {cursor?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void load(cursor)} style={({pressed})=>({paddingVertical:14,alignItems:'center',borderTopWidth:0.5,borderTopColor:c.border,opacity:pressed?0.6:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.accent}}>{zh?'加载较早的举报':'Load earlier reports'}</Text></Pressable>:null}
  </View>}
 </View>;
}
