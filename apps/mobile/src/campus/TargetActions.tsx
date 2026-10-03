import {useEffect,useState,useSyncExternalStore} from 'react';
import {Text,View} from 'react-native';
import {session} from '../runtime';
import {newWriteKey} from '../study/dates';
import {useNavigationProtection} from '../navigation/InputProtection';
import {useSceneFocus} from '../navigation/TabScene';
import {CampusActionsController,type CampusTarget} from './action-controller';
import type {Language} from '../strings';
import {FormField,FormGroup,ListGroup,ListRow,Notice,PrimaryButton,usePenColors} from '../ui/Pen';
export type {CampusTarget} from './action-controller';
type Props={target:CampusTarget;language:Language;dark:boolean;onLogin:()=>void;onChanged?:()=>void};
export function TargetActions(props:Props){
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 if(!profile)return <ListGroup><ListRow icon="bookmark" tile="#D98A1C" title={props.language==='zh'?'登录后收藏或提交纠错':'Sign in to save or suggest a fix'} chevron onPress={props.onLogin}/></ListGroup>;
 return <PersonalActions key={`${profile.id}:${props.target.target_kind}:${props.target.target_id}`} {...props}/>;
}
function PersonalActions({target,language,onChanged}:Props){
 const zh=language==='zh',c=usePenColors(),active=useSceneFocus();
 const [controller]=useState(()=>new CampusActionsController(target,(path,options)=>session.request(path,options),newWriteKey));
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const [correcting,setCorrecting]=useState(false);
 useNavigationProtection(controller.protection(),zh);
 useEffect(()=>()=>controller.invalidate(),[controller]);
 useEffect(()=>{if(active)void controller.refresh();},[controller,active]);
 const frozen=state.writing||Boolean(state.pending);
 async function bookmark(){if(await controller.toggleBookmark())onChanged?.();}
 async function retry(){const kind=controller.snapshot().pending?.kind;if(await controller.retry()&&kind==='bookmark')onChanged?.();}
 return <View style={{gap:12}}>
  {state.notice?<Notice tone="success" text={state.notice==='correction-saved'?(zh?'纠错已提交，等待维护者核对。':'Correction sent for review.'):(zh?'收藏已更新。':'Saved.')}/>:null}
  {state.error?<Notice tone="error" text={state.pending?(zh?'结果尚未确认，内容已保留。':'Result unconfirmed; your input is kept.'):(zh?'未能完成，请联网后重试。':'Could not complete. Retry when online.')} action={state.pending?(zh?'重试':'Retry'):(zh?'刷新':'Refresh')} onAction={()=>state.pending?void retry():void controller.refresh()}/>:null}
  <ListGroup>
   <ListRow icon={state.saved?'bookmark-check':'bookmark'} tile="#D98A1C" title={state.saved?(zh?'已收藏':'Saved'):(zh?'收藏':'Save')} subtitle={state.saved?(zh?'在「校园 · 我的常用」里找到它':'Find it under Campus · Saved'):undefined} value={state.busy?(zh?'处理中…':'…'):state.saved?(zh?'取消收藏':'Remove'):undefined} disabled={state.busy||frozen||!state.loaded||state.stale} onPress={()=>void bookmark()}/>
   <ListRow icon="pencil-line" tile="#8E8E93" title={zh?'信息有误？':'Something wrong?'} subtitle={zh?'提交纠错，核对后更新':'Suggest a fix for review'} chevron onPress={()=>setCorrecting(!correcting)}/>
  </ListGroup>
  {correcting?<View style={{gap:10}}>
   <FormGroup footer={zh?'请描述问题及依据。维护者核对后才会改动公开内容。':'Describe the issue and source. A maintainer reviews before public changes.'}><FormField label={zh?'纠错说明':'Details'} multiline value={state.draft} editable={!frozen} maxLength={2000} onChangeText={value=>controller.edit(value)}/></FormGroup>
   <View style={{flexDirection:'row'}}><PrimaryButton label={zh?'提交纠错':'Submit'} disabled={state.busy||frozen||state.draft.trim().length<5} onPress={()=>void controller.submitCorrection()}/></View>
  </View>:null}
  {state.requests.length?<ListGroup header={zh?'我的纠错':'My corrections'}>{state.requests.map(r=><ListRow key={r.id} title={r.message} subtitle={r.resolution??undefined} value={r.status==='pending'?(zh?'待核对':'Pending'):r.status==='resolved'?(zh?'已处理':'Resolved'):(zh?'未采纳':'Declined')}/>)}</ListGroup>:null}
  {state.pending&&!state.error?<Text style={{paddingHorizontal:16,fontSize:12,color:c.muted}}>{zh?'原操作尚未确认，可重试同一笔操作。':'The original action is unconfirmed.'}</Text>:null}
 </View>;
}
