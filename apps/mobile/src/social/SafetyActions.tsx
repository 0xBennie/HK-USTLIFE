// Pen "V6 / 举报或屏蔽（面板）" (dsJS2): a quiet grey "举报或屏蔽" link opens one sheet with the reason,
// optional details, submit, and a separate destructive block row. States: submitted, unconfirmed (retry
// replays the same write key), failed (real reason, form kept), and no reportable card (block only).
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import type {Language} from '../strings';
import type {ReportTarget} from '../../../../src/product/social/wall-types';
import type {ReportReason,ContentReport} from '../../../../src/product/social/governance-types';
import {useNavigationProtection} from '../navigation/InputProtection';
import {validSafetyReceipt,type SafetyWrite} from './safety-receipt';
import {newWriteKey} from '../study/dates';
import {wallError} from './wall-shared';
import {BottomSheet} from '../ui/BottomSheet';
import {Notice,PenIcon,PrimaryButton,usePenColors,type PenIconName} from '../ui/Pen';
import {feel} from '../ui/feel';
export const reportReasonLabel=(reason:ReportReason,zh:boolean)=>({spam:zh?'垃圾信息':'Spam',harassment:zh?'骚扰／攻击':'Harassment',privacy:zh?'个人隐私':'Privacy',misinformation:zh?'错误或误导信息':'Misleading information',other:zh?'其他问题':'Other concern'}[reason]);
const REASONS:ReportReason[]=['spam','harassment','privacy','misinformation','other'];
export const kindLabel=(kind:ReportTarget['kind'],zh:boolean)=>({post:zh?'帖子':'post',reply:zh?'回复':'reply',activity:zh?'活动':'activity',activity_comment:zh?'评论':'comment',contact_card:zh?'联系卡片':'contact card'}[kind]);

/** `quiet`: 'footer' = centred grey link under a page; 'inline' = small grey link under a comment or reply. */
export function SafetyActions({target,author,language,onChanged,disabled=false,onPendingChange,quiet='footer'}:{quiet?:'footer'|'inline'|boolean;target:ReportTarget|null;author:{id:string;display_name:string};language:Language;dark?:boolean;onChanged:()=>void;disabled?:boolean;onPendingChange?:(pending:boolean)=>void}){
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile,zh=language==='zh',c=usePenColors();
 const [open,setOpen]=useState(false),[reason,setReason]=useState<ReportReason>('other'),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const pending=useRef<SafetyWrite|null>(null),lock=useRef(false),alive=useRef(true),scroll=useRef<ScrollView>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const unresolved=busy||pending.current!==null;
 useNavigationProtection(busy?'busy':pending.current?'uncertain':open&&(details.length>0||reason!=='other')?'draft':'clear',zh);
 useEffect(()=>{onPendingChange?.(unresolved);},[unresolved,onPendingChange]);
 if(!profile||profile.id===author.id)return null;
 const frozen=busy||pending.current!==null||disabled;
 async function run(){if(lock.current||!pending.current)return;lock.current=true;setBusy(true);setError('');const request=pending.current;
  try{const result=await session.request<ContentReport|{blocked:true}>(request.path,{method:request.method,body:request.body,idempotencyKey:request.key});if(!validSafetyReceipt(request,result))throw Error('Unconfirmed safety action');if(alive.current){pending.current=null;if(request.method==='PUT'){setOpen(false);onChanged();}else{feel.success();setSent(true);setDetails('');setReason('other');}}}
  catch(e){if(alive.current){if(e instanceof ApiFailure&&e.status>0&&e.status<500)pending.current=null;setError(e instanceof ApiFailure&&e.status===400?(zh?'请检查举报原因与说明。':'Check the reason and details.'):wallError(e,language));}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function report(){if(frozen||!target)return;pending.current={path:'/reports',method:'POST',body:{target,reason,details},key:newWriteKey()};void run();}
 function block(){if(frozen)return;Alert.alert(zh?`屏蔽 ${author.display_name}？`:`Block ${author.display_name}?`,zh?'双方不再看到彼此发布的内容；你们之间的报名、收藏和联系卡片会移除，解除屏蔽也不会恢复。':'You won’t see each other’s posts. Sign-ups, saves and contact cards between you are removed and won’t come back if you unblock.',[{text:zh?'返回':'Go back',style:'cancel'},{text:zh?'屏蔽':'Block',style:'destructive',onPress:()=>{if(lock.current||pending.current)return;pending.current={path:`/me/blocks/${author.id}`,method:'PUT',body:{},key:newWriteKey()};void run();}}]);}
 const close=()=>{setOpen(false);if(sent)setSent(false);setError('');};
 const inline=quiet==='inline',name=author.display_name;
 const uncertain=pending.current!==null&&!busy;
 return <>
  <Pressable accessibilityRole="button" disabled={disabled} hitSlop={inline?12:8} onPress={()=>{feel.select();setOpen(true);}} style={{alignSelf:inline?'flex-start':'center',paddingVertical:inline?0:6,opacity:disabled?0.5:1}}>
   <Text style={{fontSize:inline?12:13,fontWeight:'500',color:c.muted}}>{zh?'举报或屏蔽':'Report or block'}</Text>
  </Pressable>
  <BottomSheet visible={open} onClose={close} closeLabel={zh?'关闭':'Close'} header={<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,height:44}}>
    <Pressable accessibilityRole="button" hitSlop={10} onPress={close}><Text style={{fontSize:17,color:c.accent}}>{sent?(zh?'关闭':'Close'):(zh?'取消':'Cancel')}</Text></Pressable>
    <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'举报或屏蔽':'Report or block'}</Text>
    <Text style={{fontSize:17,color:'transparent'}}>{zh?'取消':'Cancel'}</Text>
   </View>}>
   <ScrollView ref={scroll} style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{paddingHorizontal:16,paddingTop:4,paddingBottom:16,gap:14}} keyboardShouldPersistTaps="handled">
    {sent?<Status icon="circle-check" color={c.green} title={zh?'举报已提交':'Report submitted'} sub={zh?'可在「我的 → 隐私与安全」查看处理进度':'Track it in Me → Privacy & safety'} action={<Soft label={zh?'完成':'Done'} onPress={close}/>}/>
    :uncertain?<Status icon="loader" color={c.accent} title={zh?'提交结果还没确认':'Result not confirmed yet'} sub={pending.current?.method==='PUT'?(zh?'重试只会核对同一次屏蔽，不会重复提交':'Retrying checks the same block; nothing is sent twice'):(zh?'重试只会核对同一次举报，不会重复提交':'Retrying checks the same report; nothing is sent twice')} action={<View style={{flexDirection:'row'}}><PrimaryButton label={zh?'再试一次':'Try again'} onPress={()=>void run()}/></View>}/>
    :<>
     <View style={{paddingHorizontal:4,gap:2}}>
      <Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{target?(zh?`举报 ${name} 的${kindLabel(target.kind,zh)}`:`Report ${name}’s ${kindLabel(target.kind,zh)}`):(zh?'对方没有分享卡片':'No card shared')}</Text>
      <Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{!target?(zh?'没有可举报的内容；你仍可以屏蔽对方':'Nothing to report; you can still block this person'):target.kind==='contact_card'?(zh?'卡片更新或清空后无法审核旧内容；不用在说明里重复联系方式':'A changed or cleared card cannot be reviewed in its old form; don’t repeat contact details'):(zh?'只有你和管理员能看到举报；提交后不会自动删除内容。':'Only you and administrators see reports; submitting does not remove content.')}</Text>
     </View>
     {target?<>
      <Text style={{paddingHorizontal:4,paddingTop:4,fontSize:13,fontWeight:'600',color:c.muted}}>{zh?'原因':'Reason'}</Text>
      <View accessibilityRole="radiogroup" style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>
       {REASONS.map((r,i)=>{const on=reason===r;return <Pressable key={r} accessibilityRole="radio" accessibilityState={{checked:on,disabled:frozen}} disabled={frozen} onPress={()=>{feel.select();setReason(r);}} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border,backgroundColor:pressed?c.fill:'transparent'})}>
        <Text style={{flex:1,fontSize:16,fontWeight:on?'600':'400',color:c.text}}>{reportReasonLabel(r,zh)}</Text>
        <PenIcon name={on?'circle-check':'circle'} size={20} color={on?c.accent:c.tertiary}/>
       </Pressable>;})}
      </View>
      <Text style={{paddingHorizontal:4,paddingTop:4,fontSize:13,fontWeight:'600',color:c.muted}}>{zh?'补充说明（选填）':'Details (optional)'}</Text>
      <TextInput accessibilityLabel={zh?'补充说明':'Details'} value={details} onChangeText={setDetails} maxLength={2000} editable={!frozen} multiline placeholder={zh?'说明具体问题，帮助管理员核查':'Describe the problem to help the review'} placeholderTextColor={c.muted} onFocus={()=>setTimeout(()=>scroll.current?.scrollToEnd({animated:true}),350)} style={{minHeight:84,maxHeight:160,borderRadius:16,backgroundColor:c.surface,paddingHorizontal:14,paddingTop:12,paddingBottom:12,fontSize:15,lineHeight:21,color:c.text,textAlignVertical:'top'}}/>
      {error?<Notice tone="error" text={error}/>:null}
      <View style={{flexDirection:'row'}}><PrimaryButton label={busy&&pending.current?.method==='POST'?(zh?'正在提交…':'Submitting…'):(zh?'提交举报':'Submit report')} disabled={frozen} onPress={report}/></View>
     </>:error?<Notice tone="error" text={error}/>:null}
     <Pressable accessibilityRole="button" disabled={frozen} onPress={block} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderRadius:20,backgroundColor:pressed?c.fill:c.surface,opacity:frozen?0.5:1})}>
      <View style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:c.danger+'1A'}}><PenIcon name="user-x" size={18} color={c.danger}/></View>
      <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:c.danger}}>{zh?`屏蔽 ${name}`:`Block ${name}`}</Text><Text style={{fontSize:13,color:c.muted}}>{zh?'双方不再看到彼此发布的内容':'You stop seeing each other’s posts'}</Text></View>
     </Pressable>
    </>}
   </ScrollView>
  </BottomSheet>
 </>;
}
function Status({icon,color,title,sub,action}:{icon:PenIconName;color:string;title:string;sub:string;action:ReactNode}){
 const c=usePenColors();
 return <View style={{gap:14,padding:16,borderRadius:20,backgroundColor:c.surface}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:color+'1F'}}><PenIcon name={icon} size={20} color={color}/></View>
   <View style={{flex:1,gap:2}}><Text accessibilityRole="alert" style={{fontSize:17,fontWeight:'700',color:c.text}}>{title}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{sub}</Text></View>
  </View>
  {action}
 </View>;
}
function Soft({label,onPress}:{label:string;onPress:()=>void}){const c=usePenColors();return <Pressable accessibilityRole="button" onPress={()=>{feel.tap();onPress();}} style={({pressed})=>({height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:c.fill,opacity:pressed?0.7:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{label}</Text></Pressable>;}
