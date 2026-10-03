import {useEffect,useState,useSyncExternalStore} from 'react';
import {Text,View} from 'react-native';
import {Button,Input} from '../ui/Primitives';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import {newWriteKey} from '../study/dates';
import {useNavigationProtection} from '../navigation/InputProtection';
import {useSceneFocus} from '../navigation/TabScene';
import {CampusActionsController,type CampusTarget} from './action-controller';
import type {Language} from '../strings';
export type {CampusTarget} from './action-controller';
type Props={target:CampusTarget;language:Language;dark:boolean;onLogin:()=>void;onChanged?:()=>void};
export function TargetActions(props:Props){
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 if(!profile)return <Button variant="secondary" onPress={props.onLogin}>{props.language==='zh'?'登录以收藏或提交纠错':'Sign in to save or suggest a correction'}</Button>;
 return <PersonalActions key={`${profile.id}:${props.target.target_kind}:${props.target.target_id}`} {...props}/>;
}
function PersonalActions({target,language,dark,onChanged}:Props){
 const zh=language==='zh',c=palette[dark?'dark':'light'],active=useSceneFocus();
 const [controller]=useState(()=>new CampusActionsController(target,(path,options)=>session.request(path,options),newWriteKey));
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 useNavigationProtection(controller.protection(),zh);
 useEffect(()=>()=>controller.invalidate(),[controller]);
 useEffect(()=>{if(active)void controller.refresh();},[controller,active]);
 const frozen=state.writing||Boolean(state.pending);
 async function bookmark(){if(await controller.toggleBookmark())onChanged?.();}
 async function retry(){const kind=controller.snapshot().pending?.kind;if(await controller.retry()&&kind==='bookmark')onChanged?.();}
 return <View style={styles.stack}>
  {state.notice?<Text accessibilityRole="alert" style={[styles.body,{color:c.accent}]}>{state.notice==='correction-saved'?(zh?'纠错记录已确认，处理状态见下方。':'Correction confirmed. Its review status appears below.'):(zh?'收藏状态已保存。':'Saved preference updated.')}</Text>:null}
  {state.pending&&!state.error?<Text accessibilityRole="alert" style={[styles.body,{color:c.muted}]}>{zh?'原操作尚未确认。刷新记录不会再次提交，仍可重试同一笔操作。':'The original action is unconfirmed. Refresh only reads records; you can still retry the same request.'}</Text>:null}
  {state.error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{state.pending?(zh?'操作结果尚未确认。原输入已保留，请重试同一笔操作。':'Result unconfirmed. Your original input is kept; retry the same request.'):state.notice?(zh?'保存已确认，但最新个人记录未能刷新。请刷新核对，无需再次提交。':'Save confirmed, but personal records could not refresh. Refresh to check; do not submit again.'):(zh?'未能完成，请检查输入或联网后重试。已有记录可能过时。':'Could not complete. Check your input or connection and retry. Retained records may be outdated.')}</Text>:null}
  {state.stale?<Text style={[styles.caption,{color:c.muted}]}>{zh?'以下个人记录尚未完成最新核对。':'Personal records below have not been checked against the latest state.'}</Text>:null}
  <Button variant="ghost" isDisabled={state.busy} onPress={()=>controller.refresh()}>{state.busy?(zh?'处理中…':'Working…'):(zh?'刷新个人记录':'Refresh my records')}</Button>
  {state.pending?<Button isDisabled={state.busy} onPress={retry}>{zh?'重试确认原操作':'Retry to confirm original action'}</Button>:null}
  <Button variant={state.saved?'primary':'secondary'} isDisabled={state.busy||frozen||!state.loaded||state.stale} onPress={bookmark}>{state.saved?(zh?'✓ 已收藏 · 取消收藏':'✓ Saved · remove'):(zh?'收藏':'Save')}</Button>
  <Text style={[styles.heading,{color:c.text}]}>{zh?'信息有误？':'Suggest a correction'}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'请描述问题及参考依据。提交后等待维护者核对，不会立即改动公开内容。':'Describe the problem and supporting source. A maintainer must review it before public information changes.'}</Text>
  <Input accessibilityLabel={zh?'纠错说明':'Correction details'} multiline value={state.draft} editable={!frozen} maxLength={2000} onChangeText={value=>controller.edit(value)} style={[styles.input,{color:c.text,borderColor:c.border,minHeight:90}]}/>
  <Button isDisabled={state.busy||frozen||state.draft.trim().length<5} onPress={()=>controller.submitCorrection()}>{zh?'提交纠错':'Submit correction'}</Button>
  {state.requests.map(r=><View key={r.id}><Text style={[styles.caption,{color:c.muted}]}>{r.status==='pending'?(zh?'待核对':'Pending review'):r.status==='resolved'?(zh?'已处理':'Resolved'):(zh?'未采纳':'Not accepted')}</Text><Text style={[styles.body,{color:c.text}]}>{r.message}</Text>{r.resolution?<Text style={[styles.body,{color:c.muted}]}>{r.resolution}</Text>:null}</View>)}
 </View>;
}
