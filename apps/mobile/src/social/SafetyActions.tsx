import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ReportTarget} from '../../../../src/product/social/wall-types';
import type {ReportReason,ContentReport} from '../../../../src/product/social/governance-types';
import {newWriteKey} from '../study/dates';
import {wallError} from './wall-shared';
export const reportReasonLabel=(reason:ReportReason,zh:boolean)=>({spam:zh?'垃圾信息':'Spam',harassment:zh?'骚扰／攻击':'Harassment',privacy:zh?'个人隐私':'Privacy',misinformation:zh?'错误或误导信息':'Misleading information',other:zh?'其他问题':'Other concern'}[reason]);
export function SafetyActions({target,author,language,dark,onChanged,disabled=false}:{target:ReportTarget;author:{id:string;display_name:string};language:Language;dark:boolean;onChanged:()=>void;disabled?:boolean}){
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile,zh=language==='zh',c=palette[dark?'dark':'light'];
 const [open,setOpen]=useState(false),[reason,setReason]=useState<ReportReason>('other'),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const pending=useRef<{path:string;method:string;body:unknown;key:string}|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(!profile||profile.id===author.id)return null;
 const frozen=busy||pending.current!==null||disabled;
 async function run(){if(lock.current||!pending.current)return;lock.current=true;setBusy(true);setError('');const request=pending.current;
  try{await session.request<ContentReport|{blocked:true}>(request.path,{method:request.method,body:request.body,idempotencyKey:request.key});if(alive.current){pending.current=null;if(request.method==='PUT')onChanged();else{setSent(true);setOpen(false);setDetails('');}}}
  catch(e){if(alive.current){if(e instanceof ApiFailure&&e.status>0&&e.status<500)pending.current=null;setError(e instanceof ApiFailure&&e.status===400?(zh?'请检查举报原因与说明。':'Check the reason and details.'):wallError(e,language));}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function report(){if(frozen)return;pending.current={path:'/reports',method:'POST',body:{target,reason,details},key:newWriteKey()};void run();}
 function block(){Alert.alert(zh?'屏蔽这位用户？':'Block this user?',zh?'双方登录后不再看到彼此发布的内容。如果你们是活动组织者与参与者，将退出对应报名／候补并移除收藏及日程；解封不会自动恢复。共同参加别人组织的活动仍可能相遇。公开内容仍可由访客查看。':'Signed-in views hide content between you. Organizer–participant relationships are withdrawn and saved activities/calendars removed; unblocking does not restore them. You may still attend another person’s activity together. Public content remains visible to visitors.',[{text:zh?'返回':'Go back',style:'cancel'},{text:zh?'确认屏蔽':'Block',style:'destructive',onPress:()=>{if(lock.current||pending.current)return;pending.current={path:`/me/blocks/${author.id}`,method:'PUT',body:{},key:newWriteKey()};void run();}}]);}
 return <View style={styles.smallStack}>
  <Button variant="ghost" isDisabled={frozen} onPress={()=>setOpen(!open)}>{open?(zh?'收起':'Close'):(zh?'举报／屏蔽':'Report / block')}</Button>
  {sent?<Text accessibilityRole="alert" style={[styles.caption,{color:c.muted}]}>{zh?'举报已保存，可在“我的”查看处理进度。':'Report saved. Track it in My account.'}</Text>:null}
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {pending.current?<Button isDisabled={busy||disabled} onPress={()=>void run()}>{zh?'重试确认操作':'Retry to confirm'}</Button>:null}
  {open?<>
   <Text style={[styles.body,{color:c.text}]}>{zh?'举报这条内容，或屏蔽作者':'Report this content or block its author'}: {author.display_name}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'举报仅本人和管理员可见。提交不会自动删除内容。':'Only you and administrators see the report. Submission does not automatically remove content.'}</Text>
   {(['spam','harassment','privacy','misinformation','other'] as const).map(r=><Button key={r} variant={reason===r?'primary':'secondary'} isDisabled={frozen} onPress={()=>setReason(r)}>{reportReasonLabel(r,zh)}</Button>)}
   <Input accessibilityLabel={zh?'举报说明':'Report details'} value={details} onChangeText={setDetails} maxLength={2000} editable={!frozen} multiline placeholder={zh?'可选：说明具体问题':'Optional: describe the concern'} style={[styles.input,{color:c.text,borderColor:c.border,minHeight:90,textAlignVertical:'top'}]}/>
   <Button isDisabled={frozen} onPress={report}>{zh?'提交举报':'Submit report'}</Button>
   <Button variant="secondary" isDisabled={frozen} onPress={block}>{zh?'屏蔽作者':'Block author'}</Button>
  </>:null}
 </View>;
}
