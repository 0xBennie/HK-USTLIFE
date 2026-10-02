import {useEffect,useRef,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import {Button} from 'heroui-native/button';
import {Input} from 'heroui-native/input';
import {session} from '../runtime';
import {ApiFailure} from '../api';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {WallPost} from '../../../../src/product/social/wall-types';
import {newWriteKey} from '../study/dates';
import {wallError} from './wall-shared';
export function WallForm({initial,language,dark,onBack,onSaved}:{initial?:WallPost;language:Language;dark:boolean;onBack:()=>void;onSaved:(id:string)=>void}){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [title,setTitle]=useState(initial?.title??''),[body,setBody]=useState(initial?.body??'');
 const [kind,setKind]=useState<WallPost['kind']>(initial?.kind??'help'),[visibility,setVisibility]=useState<WallPost['visibility']>(initial?.visibility??'members');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef<{body:unknown;key:string}|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const frozen=busy||pending.current!==null;
 async function save(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  pending.current??={body:initial?{title,body,version:initial.version}:{title,body,kind,visibility},key:newWriteKey()};
  const result=await session.request<WallPost>(initial?`/posts/${initial.id}`:'/posts',{method:initial?'PATCH':'POST',body:pending.current.body,idempotencyKey:pending.current.key});
  if(alive.current){pending.current=null;onSaved(result.id);}
 }catch(e){if(alive.current){if(e instanceof ApiFailure&&e.status>0&&e.status<500)pending.current=null;setError(wallError(e,language));}}finally{lock.current=false;if(alive.current)setBusy(false);}}
 function back(){if(pending.current)Alert.alert(zh?'发布结果尚未确认':'Result not confirmed',zh?'内容可能已经保存。离开后请先查看“我发布的”，避免重复发帖。':'It may already be saved. Check My posts before creating another.',[{text:zh?'留下重试':'Stay',style:'cancel'},{text:zh?'离开':'Leave',onPress:onBack}]);else onBack();}
 return <View style={styles.stack}>
  <Button variant="ghost" isDisabled={busy} onPress={back}>{zh?'返回':'Back'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{initial?(zh?'编辑帖子':'Edit post'):(zh?'分享一点，或问个问题':'Share something or ask a question')}</Text>
  <Text style={[styles.caption,{color:c.muted}]}>{zh?'本地开发演示内容。你的私人课表不会附在帖子中。':'Local development demo content. Your private timetable is not attached.'}</Text>
  {!initial?<>
   {(['help','wall'] as const).map(k=><Button key={k} variant={kind===k?'primary':'secondary'} isDisabled={frozen} onPress={()=>setKind(k)}>{k==='help'?(zh?'求助／问答':'Ask for help'):(zh?'校园分享／讨论':'Share / discuss')}</Button>)}
   <Text style={[styles.body,{color:c.text}]}>{zh?'谁能看到帖子与回复？发布后可见范围固定。':'Who can see the post and replies? Visibility is fixed after publishing.'}</Text>
   {(['members','public'] as const).map(v=><Button key={v} variant={visibility===v?'primary':'secondary'} isDisabled={frozen} onPress={()=>setVisibility(v)}>{v==='members'?(zh?'登录用户（不等于在籍认证）':'Signed-in users (not school verified)'):(zh?'公开，访客可见':'Public, visible to visitors')}</Button>)}
  </>:null}
  <Text style={[styles.body,{color:c.text}]}>{zh?'标题':'Title'} · {title.length}/160</Text>
  <Input accessibilityLabel={zh?'帖子标题':'Post title'} value={title} onChangeText={setTitle} maxLength={160} editable={!frozen} style={[styles.input,{color:c.text,borderColor:c.border}]}/>
  <Text style={[styles.body,{color:c.text}]}>{zh?'正文':'Body'} · {body.length}/5000</Text>
  <Input accessibilityLabel={zh?'帖子正文':'Post body'} value={body} onChangeText={setBody} maxLength={5000} editable={!frozen} multiline style={[styles.input,{color:c.text,borderColor:c.border,minHeight:180,textAlignVertical:'top'}]}/>
  {error?<Text accessibilityRole="alert" style={[styles.body,{color:c.danger}]}>{error}</Text>:null}
  <Button isDisabled={busy||!title.trim()||!body.trim()} onPress={()=>void save()}>{busy?(zh?'保存中…':'Saving…'):pending.current?(zh?'重试确认结果':'Retry to confirm'):initial?(zh?'保存修改':'Save changes'):(zh?'发布演示帖子':'Publish demo post')}</Button>
 </View>;
}
