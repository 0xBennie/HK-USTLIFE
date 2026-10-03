import {useEffect,useState,useSyncExternalStore} from 'react';
import {Alert,Linking,Pressable,Text,View} from 'react-native';
import {Button,Input,Card} from '../ui/Primitives';
import {api,session} from '../runtime';
import {palette,styles} from '../theme';
import type {Language} from '../strings';
import type {Template} from '../../../../src/product/affairs/schemas';
import {useNavigationProtection,useSceneNavigation} from '../navigation/InputProtection';
import {newWriteKey,dateTimeInZone} from '../study/dates';
import {AffairController,type AffairDetail} from './controller';
import {CreateAffairController} from './create-controller';
type Props={language:Language;dark:boolean;onBack:()=>void;onLogin:()=>void};
async function openOfficial(url:string){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='hkust.edu.hk'||u.hostname.endsWith('.hkust.edu.hk')))throw Error('Unsupported source');await Linking.openURL(url);}
export function AffairsScreen(props:Props){
 const owner=useSyncExternalStore(session.subscribe,session.snapshot).profile?.id;
 return <AffairsDirectory key={owner??'visitor'} {...props} owner={owner}/>;
}
function AffairsDirectory({language,dark,onBack,onLogin,owner}:Props&{owner?:string}){
 const zh=language==='zh',c=palette[dark?'dark':'light'];
 const [templates,setTemplates]=useState<Template[]>([]),[mine,setMine]=useState<AffairDetail[]>([]),[selected,setSelected]=useState<Template|null>(null),[instance,setInstance]=useState<string|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0),[archived,setArchived]=useState(false),[next,setNext]=useState<string|null>(null);
 useEffect(()=>{let active=true;setBusy(true);setError(false);void(async()=>{try{
  const all:Template[]=[];let cursor:string|null=null;do{const page:{items:Template[];next_cursor:string|null}=await api.request<{items:Template[];next_cursor:string|null}>('/affairs/templates?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));all.push(...page.items);cursor=page.next_cursor;}while(cursor&&all.length<500);
  const own=owner?await session.request<{items:AffairDetail[];next_cursor:string|null}>('/me/affairs?limit=50&state='+(archived?'archived':'active')):{items:[],next_cursor:null};
  if(active){setTemplates(all);setMine(own.items);setNext(own.next_cursor);}
 }catch{if(active)setError(true);}finally{if(active)setBusy(false);}})();return()=>{active=false;};},[owner,revision,archived]);
 async function more(){if(!next||busy)return;setBusy(true);try{const page=await session.request<{items:AffairDetail[];next_cursor:string|null}>('/me/affairs?limit=50&state='+(archived?'archived':'active')+'&cursor='+encodeURIComponent(next));setMine(old=>[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]);setNext(page.next_cursor);}catch{setError(true);}finally{setBusy(false);}}
 if(instance&&owner)return <AffairEditor key={owner+instance} id={instance} language={language} dark={dark} onBack={()=>{setInstance(null);setRevision(v=>v+1);}}/>;
 if(selected)return <TemplateDetail key={selected.template_id+selected.revision} template={selected} owner={owner} {...{language,dark,onLogin}} onBack={()=>setSelected(null)} onCreated={id=>{setSelected(null);setInstance(id);}}/>;
 return <View style={styles.stack}>
  <Button variant="ghost" onPress={onBack}>{zh?'返回校园':'Back to campus'}</Button>
  <Text style={[styles.title,{color:c.text}]}>{zh?'重要事务':'Important affairs'}</Text>
  <Text style={[styles.body,{color:c.muted}]}>{zh?'找到步骤，留好自己的进度。':'Find the steps. Keep your own progress.'}</Text>
  {busy?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'正在读取…':'Loading…'}</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'读取失败；以下可能是上次结果。请刷新后再操作。':'Could not refresh; results may be old. Refresh before continuing.'}</Text>:null}
  <Button variant="secondary" isDisabled={busy} onPress={()=>setRevision(v=>v+1)}>{zh?'刷新事务':'Refresh affairs'}</Button>
  <Text style={[styles.heading,{color:c.text}]}>{zh?'办事说明':'Guides'}</Text>
  {!busy&&!error&&!templates.length?<Text style={[styles.body,{color:c.muted}]}>{zh?'办事说明正在核验，暂未发布。不会用示例内容代替官方资料。':'Guides are under review. No verified guides are published yet.'}</Text>:null}
  {!error&&templates.map(t=><Button key={t.template_id} variant="secondary" onPress={()=>setSelected(t)}>{t.title[language]}</Button>)}
  <Text style={[styles.heading,{color:c.text}]}>{zh?'我的事务 · 仅自己可见':'My affairs · private'}</Text>
  {!owner?<Button onPress={onLogin}>{zh?'登录以保存进度':'Sign in to save progress'}</Button>:<>
  <Button variant="ghost" isDisabled={busy} onPress={()=>setArchived(v=>!v)}>{archived?(zh?'查看进行中':'Show active'):(zh?'查看已归档':'Show archived')}</Button>
  {!busy&&!error&&!mine.length?<Text style={{color:c.muted}}>{zh?'这里还没有私人清单。':'No private checklists here yet.'}</Text>:null}
  {!error&&mine.map(item=><Button variant="secondary" key={item.id} onPress={()=>setInstance(item.id)}>{item.label||item.template.title[language]}</Button>)}
  {next?<Button isDisabled={busy} onPress={()=>void more()}>{zh?'加载更多':'Load more'}</Button>:null}</>}
 </View>;
}
function TemplateDetail({template:t,language,dark,owner,onLogin,onBack,onCreated}:{template:Template;language:Language;dark:boolean;owner?:string;onLogin:()=>void;onBack:()=>void;onCreated:(id:string)=>void}){
 const [controller]=useState(()=>new CreateAffairController(t.template_id,t.revision,newWriteKey(),(p,o)=>session.request(p,o)));
 const s=useSyncExternalStore(controller.subscribe,controller.snapshot),zh=language==='zh',c=palette[dark?'dark':'light'],protect=useSceneNavigation(zh);
 useEffect(()=>()=>controller.dispose(),[controller]);useNavigationProtection(s.phase==='saving'?'busy':s.phase==='uncertain'?'uncertain':'clear',zh);
 const available=t.source_health==='verified'&&Date.parse(t.review_due_at)>Date.now();
 async function create(){if(await controller.save()){const id=controller.snapshot().id;if(id)onCreated(id);}}
 return <View style={styles.stack}><Button variant="ghost" onPress={()=>protect(onBack)}>{zh?'返回事务目录':'Back to guides'}</Button><Text style={[styles.title,{color:c.text}]}>{t.title[language]}</Text><Text style={[styles.body,{color:c.muted}]}>{t.summary[language]}</Text>
 {[...t.conditions,...t.materials,...t.steps].map((step,i)=><Text key={i} style={[styles.body,{color:c.text}]}>{i+1}. {step.text[language]}</Text>)}
 <Text style={[styles.caption,{color:c.muted}]}>{zh?'来源核对日期':'Source checked'} · {t.reviewed_at.slice(0,10)}</Text>
 {t.sources.map(source=><Button key={source.id} variant="ghost" onPress={()=>void openOfficial(source.url).catch(()=>Alert.alert(zh?'无法打开来源':'Unable to open source'))}>{source.id} ↗</Button>)}
 {!available?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'说明待核对，暂不能建立新清单。':'This guide needs review before new checklists can be created.'}</Text>:null}
 {s.phase==='uncertain'?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'创建结果待核对。重试将核对同一笔操作，不建立第二份。':'Creation is unconfirmed. Retry checks the same action without creating a second copy.'}</Text>:null}
 {s.phase==='error'?<Text accessibilityRole="alert" style={{color:c.danger}}>{zh?'创建未成功。返回目录刷新版本或重新登录。':'Could not create. Refresh the guide or sign in again.'}</Text>:null}
 <Button isDisabled={!!owner&&(!available||s.phase==='saving'||s.phase==='error')} onPress={()=>owner?void create():onLogin()}>{!owner?(zh?'登录以建立私人清单':'Sign in to create checklist'):s.phase==='uncertain'?(zh?'核对同一笔创建':'Check original creation'):(zh?'建立私人清单':'Create private checklist')}</Button>
 <Text style={[styles.caption,{color:c.muted}]}>{zh?'打开官方网页不会改变进度，也不代表办理成功。':'Opening an official page does not update progress or confirm success.'}</Text></View>;
}
function AffairEditor({id,language,dark,onBack}:{id:string;language:Language;dark:boolean;onBack:()=>void}){
 const [saved,setSaved]=useState(false);
 const [controller]=useState(()=>new AffairController(id,(p,o)=>session.request(p,o)));const s=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const zh=language==='zh',c=palette[dark?'dark':'light'],protect=useSceneNavigation(zh),editable=['ready','dirty'].includes(s.phase),v=s.value;
 useNavigationProtection(controller.protection(),zh);useEffect(()=>{void controller.refresh();return()=>controller.dispose();},[controller]);
 const draft={...v,...s.draft,step_checks:{...v?.step_checks,...s.draft.step_checks}};
 const confirmSave=()=>Alert.alert(zh?'保存私人记录？':'Save private record?',zh?'这些是你本人的记录，不代表学校已受理或确认。':'These are your own records, not confirmation from the university.',[{text:zh?'继续编辑':'Keep editing',style:'cancel'},{text:zh?'保存':'Save',onPress:()=>{setSaved(false);void controller.save().then(setSaved);}}]);
 return <View style={styles.stack}><Button variant="ghost" onPress={()=>protect(onBack)}>{zh?'返回我的事务':'Back to my affairs'}</Button>
 <Text style={[styles.title,{color:c.text}]}>{v?.template.title[language]??(zh?'我的事务':'My affair')}</Text>
 <Text style={[styles.body,{color:c.muted}]}>{zh?'私人进度 · 官方结果未连接':'Private progress · Official result not connected'}</Text>
 <Button variant="secondary" isDisabled={s.phase==='loading'||s.phase==='saving'} onPress={()=>void controller.refresh()}>{zh?'读取最新记录':'Read latest record'}</Button>
 {s.phase==='loading'||s.phase==='saving'?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'正在处理…':'Working…'}</Text>:null}
 {s.error?<Text accessibilityRole="alert" style={{color:c.danger}}>{s.phase==='uncertain'?(zh?'保存结果待核对，草稿仍在。请先读取最新记录。':'Save unconfirmed; draft retained. Read the latest record first.'):(zh?'无法确认记录，请检查连接或登录状态。':'Cannot verify the record. Check connection or sign-in.')}</Text>:null}
 {s.phase==='review'?<Card><Text style={[styles.heading,{color:c.text}]}>{zh?'核对服务器记录与草稿':'Review saved record and draft'}</Text><Text selectable style={{color:c.text}}>{zh?'服务器备注：':'Saved note: '}{v?.note}</Text><Text selectable style={{color:c.text}}>{zh?'你的草稿：':'Your draft: '}{s.draft.note??v?.note}</Text><Button onPress={()=>controller.resolve('keep-draft')}>{zh?'保留草稿，继续核对':'Keep draft and review'}</Button><Button variant="secondary" onPress={()=>Alert.alert(zh?'放弃本页修改？':'Discard this draft?',undefined,[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'采用服务器记录':'Use saved record',onPress:()=>controller.resolve('use-server')}])}>{zh?'采用服务器记录':'Use saved record'}</Button></Card>:null}
 {saved&&s.phase==='ready'?<Text accessibilityLiveRegion="polite" style={{color:c.accent}}>{zh?'私人修改已保存。':'Private changes saved.'}</Text>:null}
 {v?<><Text style={[styles.caption,{color:c.muted}]}>{zh?'本人清单，不代表学校办理状态':'Personal checklist, not official processing status'}</Text>
 {v.template.steps.map(step=><Pressable key={step.id} disabled={!editable} accessibilityRole="checkbox" accessibilityState={{checked:!!draft.step_checks[step.id],disabled:!editable}} accessibilityLabel={step.text[language]} onPress={()=>controller.edit({step_checks:{[step.id]:!draft.step_checks[step.id]}})} style={{minHeight:44,paddingVertical:12,flexDirection:'row',gap:12}}><Text style={{color:c.accent}}>{draft.step_checks[step.id]?'✓':'○'}</Text><Text style={[styles.body,{color:c.text,flex:1}]}>{step.text[language]}</Text></Pressable>)}
 <Text style={[styles.heading,{color:c.text}]}>{zh?'我的备注':'My note'}</Text><Input accessibilityLabel={zh?'私人事务备注':'Private affair note'} multiline maxLength={2000} editable={editable} value={draft.note??''} onChangeText={note=>controller.edit({note})} style={{minHeight:110,textAlignVertical:'top'}}/>
 <Button variant="secondary" isDisabled={!editable} onPress={()=>controller.edit({submission:draft.submission==='self_reported'?'not_reported':'self_reported'})}>{draft.submission==='self_reported'?(zh?'✓ 本人记录已尝试办理 · 点击撤回':'✓ I recorded an attempt · Undo'):(zh?'记录我已尝试办理':'Record my processing attempt')}</Button>
 <Text style={[styles.caption,{color:c.muted}]}>{zh?'记录时间':'Recorded at'}: {v.reported_at?dateTimeInZone(v.reported_at,'Asia/Hong_Kong')+' HKT':(zh?'未知／未记录':'Unknown / not recorded')}</Text>
 <Button isDisabled={s.phase!=='dirty'} onPress={confirmSave}>{zh?'预览并保存个人修改':'Review and save changes'}</Button>
 <Text style={[styles.caption,{color:c.muted}]}>{v.requires_review?(zh?'官方说明有新版本；你的旧清单仍保留。版本接受功能待接入。':'A newer guide exists; your accepted checklist is retained. Revision acceptance is not available here yet.'):(zh?'当前清单按已接受版本展示。':'Showing your accepted guide version.')}</Text>
 {v.template.sources.map(source=><Button key={source.id} variant="ghost" onPress={()=>void openOfficial(source.url).catch(()=>Alert.alert(zh?'无法打开来源':'Unable to open source'))}>{source.id} ↗</Button>)}
 </>:null}</View>;
}
