import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import { Button } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {ReportTarget} from '../../../../src/product/social/wall-types';
import type {ReportReason,ContentReport} from '../../../../src/product/social/governance-types';
import {useNavigationProtection} from '../navigation/InputProtection';
import {validSafetyReceipt,type SafetyWrite} from './safety-receipt';
import {newWriteKey} from '../study/dates';
import {wallError} from './wall-shared';
export const reportReasonLabel=(reason:ReportReason,zh:boolean)=>({spam:zh?'垃圾信息':'Spam',harassment:zh?'骚扰／攻击':'Harassment',privacy:zh?'个人隐私':'Privacy',misinformation:zh?'错误或误导信息':'Misleading information',other:zh?'其他问题':'Other concern'}[reason]);
export function SafetyActions({target,author,language,dark,onChanged,disabled=false,onPendingChange,quiet=false}:{quiet?:boolean|'inline';target:ReportTarget|null;author:{id:string;display_name:string};language:Language;dark:boolean;onChanged:()=>void;disabled?:boolean;onPendingChange?:(pending:boolean)=>void}){
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile,zh=language==='zh',c=palette[dark?'dark':'light'];
 const [open,setOpen]=useState(false),[reason,setReason]=useState<ReportReason>('other'),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const pending=useRef<SafetyWrite|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const unresolved=busy||pending.current!==null;
 useNavigationProtection(busy?'busy':pending.current?'uncertain':open&&(details.length>0||reason!=='other')?'draft':'clear',zh);
 useEffect(()=>{onPendingChange?.(unresolved);},[unresolved,onPendingChange]);
 if(!profile||profile.id===author.id)return null;
 const frozen=busy||pending.current!==null||disabled;
 async function run(){if(lock.current||!pending.current)return;lock.current=true;setBusy(true);setError('');const request=pending.current;
  try{const result=await session.request<ContentReport|{blocked:true}>(request.path,{method:request.method,body:request.body,idempotencyKey:request.key});if(!validSafetyReceipt(request,result))throw Error('Unconfirmed safety action');if(alive.current){pending.current=null;if(request.method==='PUT')onChanged();else{setSent(true);setOpen(false);setDetails('');}}}
  catch(e){if(alive.current){if(e instanceof ApiFailure&&e.status>0&&e.status<500)pending.current=null;setError(e instanceof ApiFailure&&e.status===400?(zh?'请检查举报原因与说明。':'Check the reason and details.'):wallError(e,language));}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function report(){if(frozen||!target)return;pending.current={path:'/reports',method:'POST',body:{target,reason,details},key:newWriteKey()};void run();}
 function block(){Alert.alert(zh?'屏蔽这位用户？':'Block this user?',zh?'这会撤回双方再次同行意愿并清空分享的联系方式；解除屏蔽不会恢复。双方登录后不再看到彼此发布的内容。如果你们是活动组织者与参与者，将退出对应报名／候补并移除收藏及日程；解封不会自动恢复。共同参加别人组织的活动仍可能相遇。公开内容仍可由访客查看。':'This withdraws mutual reconnection consent and clears shared contact cards; unblocking does not restore them. Signed-in views hide content between you. Organizer–participant relationships are withdrawn and saved activities/calendars removed; unblocking does not restore them. You may still attend another person’s activity together. Public content remains visible to visitors.',[{text:zh?'返回':'Go back',style:'cancel'},{text:zh?'确认屏蔽':'Block',style:'destructive',onPress:()=>{if(lock.current||pending.current)return;pending.current={path:`/me/blocks/${author.id}`,method:'PUT',body:{},key:newWriteKey()};void run();}}]);}
 return <View style={styles.smallStack}>
  {/* quiet: Pen V6 small grey text — centred page footer, or 'inline' under a comment (V6 / 活动讨论); otherwise the original ghost button. */}
  {quiet?<Pressable accessibilityRole="button" disabled={frozen} hitSlop={quiet==='inline'?12:8} onPress={()=>setOpen(!open)} style={{alignSelf:quiet==='inline'?'flex-start':'center',paddingVertical:quiet==='inline'?0:6}}><Text style={{fontSize:quiet==='inline'?12:13,fontWeight:'500',color:c.muted}}>{open?(zh?'收起':'Close'):(zh?'举报或屏蔽':'Report or block')}</Text></Pressable>
  :<Button variant="ghost" isDisabled={frozen} onPress={()=>setOpen(!open)}>{open?(zh?'收起':'Close'):(zh?'举报／屏蔽':'Report / block')}</Button>}
  {sent?<Text accessibilityRole="alert" style={[styles.caption,{color:c.muted}]}>{zh?'举报已保存，可在“我的”查看处理进度。':'Report saved. Track it in My account.'}</Text>:null}
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  {pending.current?<Button isDisabled={busy||disabled} onPress={()=>void run()}>{zh?'重试确认操作':'Retry to confirm'}</Button>:null}
  {open?<>
   <Text style={[styles.body,{color:c.text}]}>{zh?'举报可查看的内容，或屏蔽对方':'Report available content or block this person'}: {author.display_name}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'举报仅本人和管理员可见。提交不会自动删除内容。':'Only you and administrators see the report. Submission does not automatically remove content.'}</Text>
   {target?.kind==='contact_card'?<Text style={[styles.caption,{color:c.muted}]}>{zh?'原卡片更新或清空后，无法审核旧正文。无需在说明中重复粘贴联系方式。':'A changed or cleared card cannot be reviewed in its old form. Do not repeat contact details in your description.'}</Text>:null}
   {target?<>{(['spam','harassment','privacy','misinformation','other'] as const).map(r=><Button key={r} variant={reason===r?'primary':'secondary'} isDisabled={frozen} onPress={()=>setReason(r)}>{reportReasonLabel(r,zh)}</Button>)}
   <Input accessibilityLabel={zh?'举报说明':'Report details'} value={details} onChangeText={setDetails} maxLength={2000} editable={!frozen} multiline placeholder={zh?'可选：说明具体问题':'Optional: describe the concern'} style={[styles.input,{color:c.text,borderColor:c.border,minHeight:90,textAlignVertical:'top'}]}/>
   <Button isDisabled={frozen} onPress={report}>{zh?'提交举报':'Submit report'}</Button></>:<Text style={{color:c.muted}}>{zh?'没有可举报的卡片；你仍可以屏蔽对方。':'No card is available to report; you can still block this person.'}</Text>}
   <Button variant="secondary" isDisabled={frozen} onPress={block}>{zh?'屏蔽作者':'Block author'}</Button>
  </>:null}
 </View>;
}
