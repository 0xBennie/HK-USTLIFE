import {useEffect,useState,useSyncExternalStore} from 'react';
import {Alert,Linking,Pressable,Text,View} from 'react-native';
import {Button,Input,Card} from '../ui/Primitives';
import {CheckCircle,CircleButton,ListGroup,ListRow,Notice,PenIcon,ProgressRing,Section,Skeleton,Surface,ViewAll,usePenColors} from '../ui/Pen';
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
 const zh=language==='zh',pc=usePenColors();
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
 // Pen board "V5 / 办事指南": my progress rings, guides list, refresh in the top bar.
 const guideIcon=(id:string):[string,string]=>/renew|library|book/i.test(id)?['book-open-check','#24467F']:/drop|course|enrol/i.test(id)?['calendar-range','#56647D']:/card|id/i.test(id)?['id-card','#A9824C']:['clipboard-check','#4F6F8C'];
 return <View style={{gap:18}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><CircleButton icon="chevron-left" label={zh?'返回校园':'Back to campus'} onPress={onBack}/><CircleButton icon="refresh-cw" label={zh?'刷新':'Refresh'} disabled={busy} onPress={()=>setRevision(v=>v+1)}/></View>
  <View style={{gap:6,paddingHorizontal:4}}><Text accessibilityRole="header" style={{fontSize:30,lineHeight:37,fontWeight:'700',color:pc.text}}>{zh?'办事指南':'Campus guides'}</Text><Text style={{fontSize:15,lineHeight:22,color:pc.muted}}>{zh?'找到步骤，留好自己的进度。官方说明为准。':'Find the steps and keep your own progress. Official pages prevail.'}</Text></View>
  {error?<Notice tone="error" text={zh?'读取失败，以下可能是上次结果。':'Could not refresh; results may be old.'} action={zh?'重试':'Retry'} onAction={()=>setRevision(v=>v+1)}/>:null}
  {busy&&!templates.length?<><Skeleton height={88} radius={28}/><Skeleton height={180} radius={28}/></>:null}
  {owner?<Section title={archived?(zh?'已归档':'Archived'):(zh?'我的进度':'My progress')} link={archived?(zh?'进行中':'Active'):(zh?'已归档':'Archived')} onLink={()=>setArchived(v=>!v)}>
   {!busy&&!error&&!mine.length?<Surface><Text style={{fontSize:15,color:pc.muted}}>{archived?(zh?'没有归档的清单。':'Nothing archived.'):(zh?'从下面选一个指南，建立你自己的清单。':'Pick a guide below to start your own checklist.')}</Text></Surface>:null}
   {mine.map(item=>{const steps=item.template.steps,done=steps.filter(st=>item.step_checks[st.id]).length,nextStep=steps.find(st=>!item.step_checks[st.id]);return <Surface key={item.id} onPress={()=>setInstance(item.id)} label={item.label||item.template.title[language]}><View style={{flexDirection:'row',alignItems:'center',gap:14}}>
    <ProgressRing done={done} total={steps.length}/>
    <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'600',color:pc.text}}>{item.label||item.template.title[language]}</Text><Text numberOfLines={1} style={{fontSize:13,color:pc.muted}}>{nextStep?`${zh?'下一步：':'Next: '}${nextStep.text[language]}`:(zh?'步骤都完成了':'All steps done')}</Text></View>
    <PenIcon name="chevron-right" size={16} color={pc.tertiary}/>
   </View></Surface>;})}
   {next?<ViewAll label={zh?'加载更多':'Load more'} onPress={()=>void more()}/>:null}
  </Section>:<ListGroup><ListRow icon="lock" tile="#24467F" title={zh?'登录后保存你的进度':'Sign in to save progress'} subtitle={zh?'清单仅自己可见':'Checklists are private'} chevron onPress={onLogin}/></ListGroup>}
  <Section title={zh?'全部指南':'All guides'}>
   {!busy&&!error&&!templates.length?<Surface><Text style={{fontSize:15,color:pc.muted}}>{zh?'指南正在核验，暂未发布。不会用示例内容代替官方资料。':'Guides are under review; nothing verified is published yet.'}</Text></Surface>:null}
   {templates.length?<ListGroup>{templates.map(t=>{const [icon,tile]=guideIcon(t.template_id);return <ListRow key={t.template_id} icon={icon} tile={tile} title={t.title[language]} subtitle={zh?`${t.steps.length} 步 · ${t.summary[language]}`:`${t.steps.length} steps · ${t.summary[language]}`} chevron onPress={()=>setSelected(t)}/>;})}</ListGroup>:null}
  </Section>
  <Text style={{paddingHorizontal:4,fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'说明来自学校公开页面；个人资格或期限请以官方系统为准。':'Guides come from public school pages; check eligibility and deadlines in official systems.'}</Text>
 </View>;
}
function TemplateDetail({template:t,language,dark,owner,onLogin,onBack,onCreated}:{template:Template;language:Language;dark:boolean;owner?:string;onLogin:()=>void;onBack:()=>void;onCreated:(id:string)=>void}){
 const [controller]=useState(()=>new CreateAffairController(t.template_id,t.revision,newWriteKey(),(p,o)=>session.request(p,o)));
 const s=useSyncExternalStore(controller.subscribe,controller.snapshot),zh=language==='zh',c=palette[dark?'dark':'light'],protect=useSceneNavigation(zh);
 useEffect(()=>()=>controller.dispose(),[controller]);useNavigationProtection(s.phase==='saving'?'busy':s.phase==='uncertain'?'uncertain':'clear',zh);
 const available=t.source_health==='verified'&&Date.parse(t.review_due_at)>Date.now();
 async function create(){if(await controller.save()){const id=controller.snapshot().id;if(id)onCreated(id);}}
 return <View style={styles.stack}><View style={{flexDirection:'row'}}><CircleButton icon="chevron-left" label={zh?'返回事务目录':'Back to guides'} onPress={()=>protect(onBack)}/></View><Text style={[styles.title,{color:c.text}]}>{t.title[language]}</Text><Text style={[styles.body,{color:c.muted}]}>{t.summary[language]}</Text>
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
 return <View style={styles.stack}><View style={{flexDirection:'row',justifyContent:'space-between'}}><CircleButton icon="chevron-left" label={zh?'返回我的事务':'Back to my affairs'} onPress={()=>protect(onBack)}/><CircleButton icon="refresh-cw" label={zh?'读取最新记录':'Read latest record'} disabled={s.phase==='loading'||s.phase==='saving'} onPress={()=>void controller.refresh()}/></View>
 <Text style={[styles.title,{color:c.text}]}>{v?.template.title[language]??(zh?'我的事务':'My affair')}</Text>
 <Text style={[styles.body,{color:c.muted}]}>{zh?'私人进度 · 官方结果未连接':'Private progress · Official result not connected'}</Text>
 {s.phase==='loading'||s.phase==='saving'?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{zh?'正在处理…':'Working…'}</Text>:null}
 {s.error?<Text accessibilityRole="alert" style={{color:c.danger}}>{s.phase==='uncertain'?(zh?'保存结果待核对，草稿仍在。请先读取最新记录。':'Save unconfirmed; draft retained. Read the latest record first.'):(zh?'无法确认记录，请检查连接或登录状态。':'Cannot verify the record. Check connection or sign-in.')}</Text>:null}
 {s.phase==='review'?<Card><Text style={[styles.heading,{color:c.text}]}>{zh?'核对服务器记录与草稿':'Review saved record and draft'}</Text><Text selectable style={{color:c.text}}>{zh?'服务器备注：':'Saved note: '}{v?.note}</Text><Text selectable style={{color:c.text}}>{zh?'你的草稿：':'Your draft: '}{s.draft.note??v?.note}</Text><Button onPress={()=>controller.resolve('keep-draft')}>{zh?'保留草稿，继续核对':'Keep draft and review'}</Button><Button variant="secondary" onPress={()=>Alert.alert(zh?'放弃本页修改？':'Discard this draft?',undefined,[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'采用服务器记录':'Use saved record',onPress:()=>controller.resolve('use-server')}])}>{zh?'采用服务器记录':'Use saved record'}</Button></Card>:null}
 {saved&&s.phase==='ready'?<Text accessibilityLiveRegion="polite" style={{color:c.accent}}>{zh?'私人修改已保存。':'Private changes saved.'}</Text>:null}
 {v?<><Text style={[styles.caption,{color:c.muted}]}>{zh?'本人清单，不代表学校办理状态':'Personal checklist, not official processing status'}</Text>
 <View style={{backgroundColor:c.surface,borderRadius:28,borderCurve:'continuous',paddingVertical:6,boxShadow:'0 10px 30px #1B356614'}}>{v.template.steps.map((step,i)=>{const on=!!draft.step_checks[step.id];return <View key={step.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingLeft:14,paddingRight:18,minHeight:56,borderTopWidth:i?0.5:0,borderTopColor:c.border}}><CheckCircle checked={on} disabled={!editable} label={step.text[language]} onPress={()=>controller.edit({step_checks:{[step.id]:!on}})}/><Text style={{flex:1,fontSize:16,lineHeight:22,color:on?c.muted:c.text,textDecorationLine:on?'line-through':'none'}}>{step.text[language]}</Text><Text style={{fontSize:13,fontWeight:'600',color:c.tertiary}}>{i+1}</Text></View>;})}</View>
 <Text style={[styles.heading,{color:c.text}]}>{zh?'我的备注':'My note'}</Text><Input accessibilityLabel={zh?'私人事务备注':'Private affair note'} multiline maxLength={2000} editable={editable} value={draft.note??''} onChangeText={note=>controller.edit({note})} style={{minHeight:110,textAlignVertical:'top'}}/>
 <Button variant="secondary" isDisabled={!editable} onPress={()=>controller.edit({submission:draft.submission==='self_reported'?'not_reported':'self_reported'})}>{draft.submission==='self_reported'?(zh?'✓ 本人记录已尝试办理 · 点击撤回':'✓ I recorded an attempt · Undo'):(zh?'记录我已尝试办理':'Record my processing attempt')}</Button>
 <Text style={[styles.caption,{color:c.muted}]}>{zh?'记录时间':'Recorded at'}: {v.reported_at?dateTimeInZone(v.reported_at,'Asia/Hong_Kong')+' HKT':(zh?'未知／未记录':'Unknown / not recorded')}</Text>
 <Button isDisabled={s.phase!=='dirty'} onPress={confirmSave}>{zh?'预览并保存个人修改':'Review and save changes'}</Button>
 <Text style={[styles.caption,{color:c.muted}]}>{v.requires_review?(zh?'官方说明有新版本；你的旧清单仍保留。版本接受功能待接入。':'A newer guide exists; your accepted checklist is retained. Revision acceptance is not available here yet.'):(zh?'当前清单按已接受版本展示。':'Showing your accepted guide version.')}</Text>
 {v.template.sources.map(source=><Button key={source.id} variant="ghost" onPress={()=>void openOfficial(source.url).catch(()=>Alert.alert(zh?'无法打开来源':'Unable to open source'))}>{source.id} ↗</Button>)}
 </>:null}</View>;
}
