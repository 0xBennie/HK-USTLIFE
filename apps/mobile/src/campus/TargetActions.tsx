import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Input} from 'heroui-native/input';
import {session} from '../runtime';
import {palette,styles} from '../theme';
import {newWriteKey} from '../study/dates';
import type {Language} from '../strings';
export type CampusTarget={target_kind:'place'|'shuttle';target_id:string};
export function TargetActions({target,language,dark,onLogin,onChanged}:{target:CampusTarget;language:Language;dark:boolean;onLogin:()=>void;onChanged?:()=>void}) {
 const profile=useSyncExternalStore(session.subscribe,session.snapshot).profile;
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
 const [requests,setRequests]=useState<{id:string;message:string;status:string;resolution:string}[]>([]);
 const key=useRef(newWriteKey()),alive=useRef(true),lock=useRef(false);
 async function load(){if(!profile)return;const [marks,history]=await Promise.all([session.request<CampusTarget[]>('/me/campus/bookmarks'),session.request<(CampusTarget&{id:string;message:string;status:string;resolution:string})[]>('/me/campus/corrections')]);if(alive.current){setSaved(marks.some(m=>m.target_kind===target.target_kind&&m.target_id===target.target_id));setRequests(history.filter(m=>m.target_kind===target.target_kind&&m.target_id===target.target_id));setReady(true);}}
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch{if(alive.current)setError(zh?'未能完成，请重试。':'Could not complete. Retry.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;setReady(false);void run(load);return()=>{alive.current=false;};},[profile?.id,target.target_kind,target.target_id]);
 if(!profile)return <Button variant="secondary" onPress={onLogin}>{zh?'登录以收藏或提交纠错':'Sign in to save or suggest a correction'}</Button>;
 return <View style={styles.stack}>
   {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
   <Button variant="ghost" isDisabled={busy} onPress={()=>run(load)}>{zh?'刷新个人记录':'Refresh my records'}</Button>
   <Button variant={saved?'primary':'secondary'} isDisabled={busy||!ready} onPress={()=>run(async()=>{await session.request('/me/campus/bookmarks',{method:saved?'DELETE':'PUT',body:target});await load();onChanged?.();})}>{saved?(zh?'✓ 已收藏 · 取消收藏':'✓ Saved · remove'):(zh?'收藏':'Save')}</Button>
   <Text style={[styles.heading,{color:c.text}]}>{zh?'信息有误？':'Suggest a correction'}</Text>
   <Text style={[styles.caption,{color:c.muted}]}>{zh?'请描述问题及参考依据。提交后等待维护者核对，不会立即改动公开内容。':'Describe the problem and supporting source. A maintainer must review it before public information changes.'}</Text>
   <Input accessibilityLabel={zh?'纠错说明':'Correction details'} multiline value={message} editable={!busy} onChangeText={v=>{setMessage(v);key.current=newWriteKey();}} style={[styles.input,{color:c.text,borderColor:c.border,minHeight:90}]}/>
   <Button isDisabled={busy||message.trim().length<5} onPress={()=>run(async()=>{await session.request('/campus/corrections',{method:'POST',body:{...target,message},idempotencyKey:key.current});if(alive.current){setMessage('');key.current=newWriteKey();}await load();})}>{zh?'提交纠错':'Submit correction'}</Button>
   {requests.map(r=><View key={r.id}><Text style={[styles.caption,{color:c.muted}]}>{r.status==='pending'?(zh?'待核对':'Pending review'):r.status==='resolved'?(zh?'已处理':'Resolved'):(zh?'未采纳':'Not accepted')}</Text><Text style={[styles.body,{color:c.text}]}>{r.message}</Text>{r.resolution?<Text style={[styles.body,{color:c.muted}]}>{r.resolution}</Text>:null}</View>)}
 </View>;
}
