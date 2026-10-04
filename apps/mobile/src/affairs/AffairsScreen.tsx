// Pen boards: "V5 / 办事指南" (list), "V6 / 办事指南 · 详情" (EOy54), "V6 / 我的办事清单" (WZaR0),
// "V6 / 说明有更新（核对）" (NMWlS). Checklists are private progress; they never claim the school accepted anything.
import {useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Alert,Linking,Pressable,ScrollView,Switch,Text,TextInput,View} from 'react-native';
import {BottomBar,CheckCircle,CircleButton,ListGroup,ListRow,Notice,PenIcon,PrimaryButton,ProgressRing,Section,Skeleton,Surface,ViewAll,usePenColors,type PenIconName} from '../ui/Pen';
import {BottomSheet} from '../ui/BottomSheet';
import {PickerSheet} from '../ui/DateTimeField';
import {feel} from '../ui/feel';
import {api,session} from '../runtime';
import type {Language} from '../strings';
import type {Template} from '../../../../src/product/affairs/schemas';
import {useNavigationProtection,useSceneNavigation} from '../navigation/InputProtection';
import {useSceneBottomBar} from '../navigation/SceneOverlay';
import {newWriteKey,dateTimeInZone} from '../study/dates';
import {AcceptRevisionController,AffairController,sameValue,type AffairDetail} from './controller';
import {CreateAffairController} from './create-controller';
type Props={language:Language;dark:boolean;onBack:()=>void;initialInstance?:string};
type Step=Template['steps'][number];

async function openOfficial(url:string){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='hkust.edu.hk'||u.hostname.endsWith('.hkust.edu.hk')))throw Error('Unsupported source');await Linking.openURL(url);}
const host=(url:string)=>/^https:\/\/([^/]+)/.exec(url)?.[1]??url;
// Titles of the official pages the guides cite (official-templates.ts), named after each page's own heading.
const SOURCE_TITLE:Record<string,{zh:string;en:string}>={
 'https://library.hkust.edu.hk/about-us/policies-and-rules/borrowing-policy/requests-renewals-recalls':{zh:'预约、续借与召回',en:'Requests, renewals & recalls'},
 'https://library.hkust.edu.hk/about-us/policies-and-rules/borrowing-policy/':{zh:'借阅政策',en:'Borrowing policy'},
 'https://registry.hkust.edu.hk/resource-library/lossreplacement-hkust-card':{zh:'学生证遗失与补领',en:'Loss / replacement of the HKUST Card'},
 'https://hkustcard.hkust.edu.hk/administrative-matters-for-students':{zh:'HKUST Card 学生事务',en:'HKUST Card: matters for students'},
 'https://registry.hkust.edu.hk/resource-library/class-enrollment-ug':{zh:'本科生选课',en:'Class enrollment (UG)'},
 'https://registry.hkust.edu.hk/calendar_dates/dates26-27confirmed.pdf':{zh:'2026-27 校历（PDF）',en:'2026-27 academic calendar (PDF)'},
};
const OFFICE:Record<string,{zh:string;en:string}>={'library.hkust.edu.hk':{zh:'图书馆',en:'Library'},'registry.hkust.edu.hk':{zh:'教务处',en:'Academic Registry'},'hkustcard.hkust.edu.hk':{zh:'HKUST Card',en:'HKUST Card'}};
const sourceTitle=(url:string,language:Language)=>SOURCE_TITLE[url]?.[language]??host(url);
const office=(t:Template,language:Language)=>{const h=host(t.sources[0]?.url??'');return OFFICE[h]?.[language]??h;};
const hkParts=(iso:string)=>dateTimeInZone(iso,'Asia/Hong_Kong');
const monthDay=(iso:string,zh:boolean)=>{const v=hkParts(iso);return zh?`${Number(v.slice(5,7))} 月 ${Number(v.slice(8,10))} 日`:new Date(v.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});};
const dateLabel=(date:string,zh:boolean)=>zh?`${Number(date.slice(5,7))} 月 ${Number(date.slice(8,10))} 日`:new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const FIELD_LABEL:Record<string,[string,string]>={summary:['简介','Summary'],conditions:['条件','Conditions'],materials:['需要准备','Materials'],sources:['来源','Sources'],deadline:['截止','Deadline']};

export function AffairsScreen(props:Props){
 const owner=useSyncExternalStore(session.subscribe,session.snapshot).profile?.id;
 return <AffairsDirectory key={owner??'visitor'} {...props} owner={owner}/>;
}
function AffairsDirectory({language,dark,onBack,owner,initialInstance}:Props&{owner?:string}){
 const zh=language==='zh',pc=usePenColors();
 const [templates,setTemplates]=useState<Template[]>([]),[mine,setMine]=useState<AffairDetail[]>([]),[selected,setSelected]=useState<Template|null>(null),[instance,setInstance]=useState<string|null>(initialInstance??null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0),[archived,setArchived]=useState(false),[next,setNext]=useState<string|null>(null);
 useEffect(()=>{let active=true;setBusy(true);setError(false);void(async()=>{try{
  const all:Template[]=[];let cursor:string|null=null;do{const page:{items:Template[];next_cursor:string|null}=await api.request<{items:Template[];next_cursor:string|null}>('/affairs/templates?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));all.push(...page.items);cursor=page.next_cursor;}while(cursor&&all.length<500);
  const own=owner?await session.request<{items:AffairDetail[];next_cursor:string|null}>('/me/affairs?limit=50&state='+(archived?'archived':'active')):{items:[],next_cursor:null};
  if(active){setTemplates(all);setMine(own.items);setNext(own.next_cursor);}
 }catch{if(active)setError(true);}finally{if(active)setBusy(false);}})();return()=>{active=false;};},[owner,revision,archived]);
 async function more(){if(!next||busy)return;setBusy(true);try{const page=await session.request<{items:AffairDetail[];next_cursor:string|null}>('/me/affairs?limit=50&state='+(archived?'archived':'active')+'&cursor='+encodeURIComponent(next));setMine(old=>[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]);setNext(page.next_cursor);}catch{setError(true);}finally{setBusy(false);}}
 if(instance&&owner)return <AffairEditor key={owner+instance} id={instance} language={language} onBack={()=>{setInstance(null);setRevision(v=>v+1);}}/>;
 if(selected)return <TemplateDetail key={selected.template_id+selected.revision} template={selected} language={language} existing={archived?undefined:mine.find(x=>x.template_id===selected.template_id)?.id} onBack={()=>setSelected(null)} onOpen={id=>{setSelected(null);setInstance(id);}}/>;
 const guideIcon=(id:string):[string,string]=>/renew|library|book/i.test(id)?['book-open-check','#24467F']:/drop|course|enrol/i.test(id)?['calendar-range','#56647D']:/card|id/i.test(id)?['id-card','#A9824C']:['clipboard-check','#4F6F8C'];
 void dark;
 return <View style={{gap:18}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><CircleButton icon="chevron-left" label={zh?'返回校园':'Back to campus'} onPress={onBack}/><CircleButton icon="refresh-cw" label={zh?'刷新':'Refresh'} disabled={busy} onPress={()=>setRevision(v=>v+1)}/></View>
  <View style={{gap:6,paddingHorizontal:4}}><Text accessibilityRole="header" style={{fontSize:30,lineHeight:37,fontWeight:'700',color:pc.text}}>{zh?'办事指南':'Campus guides'}</Text><Text style={{fontSize:15,lineHeight:22,color:pc.muted}}>{zh?'找到步骤，留好自己的进度。官方说明为准。':'Find the steps and keep your own progress. Official pages prevail.'}</Text></View>
  {error?<Notice tone="error" text={zh?'读取失败，以下可能是上次结果。':'Could not refresh; results may be old.'} action={zh?'重试':'Retry'} onAction={()=>setRevision(v=>v+1)}/>:null}
  {busy&&!templates.length?<><Skeleton height={88} radius={28}/><Skeleton height={180} radius={28}/></>:null}
  {owner?<Section title={archived?(zh?'已归档':'Archived'):(zh?'我的进度':'My progress')} link={archived?(zh?'进行中':'Active'):(zh?'已归档':'Archived')} onLink={()=>setArchived(v=>!v)}>
   {!busy&&!error&&!mine.length?<Surface><Text style={{fontSize:15,color:pc.muted}}>{archived?(zh?'没有归档的清单。':'Nothing archived.'):(zh?'从下面选一个指南，建立你自己的清单。':'Pick a guide below to start your own checklist.')}</Text></Surface>:null}
   {mine.map(item=>{const steps=item.template.steps,done=steps.filter(st=>item.step_checks[st.id]).length,nextStep=steps.find(st=>!item.step_checks[st.id]);return <Surface key={item.id} onPress={()=>setInstance(item.id)} label={item.label||item.template.title[language]}><View style={{flexDirection:'row',alignItems:'center',gap:14}}>
    <ProgressRing done={done} total={steps.length}/>
    <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'600',color:pc.text}}>{item.label||item.template.title[language]}</Text><Text numberOfLines={1} style={{fontSize:13,color:item.requires_review?pc.orange:pc.muted}}>{item.requires_review?(zh?'官方说明有更新，请核对':'Official guide changed — review'):nextStep?`${zh?'下一步：':'Next: '}${nextStep.text[language]}${item.personal_due?.kind==='date'?(zh?` · ${dateLabel(item.personal_due.date,zh)}前`:` · by ${dateLabel(item.personal_due.date,zh)}`):''}`:(zh?'步骤都完成了':'All steps done')}</Text></View>
    <PenIcon name="chevron-right" size={16} color={pc.tertiary}/>
   </View></Surface>;})}
   {next?<ViewAll label={zh?'加载更多':'Load more'} onPress={()=>void more()}/>:null}
  </Section>:null}
  <Section title={zh?'全部指南':'All guides'}>
   {!busy&&!error&&!templates.length?<Surface><Text style={{fontSize:15,color:pc.muted}}>{zh?'指南正在核验，暂未发布。不会用示例内容代替官方资料。':'Guides are under review; nothing verified is published yet.'}</Text></Surface>:null}
   {templates.length?<ListGroup>{templates.map(t=>{const [icon,tile]=guideIcon(t.template_id);return <ListRow key={t.template_id} icon={icon} tile={tile} title={t.title[language]} subtitle={zh?`${t.steps.length} 步 · ${office(t,language)}`:`${t.steps.length} steps · ${office(t,language)}`} chevron onPress={()=>setSelected(t)}/>;})}</ListGroup>:null}
  </Section>
  <Text style={{paddingHorizontal:4,fontSize:12,lineHeight:18,color:pc.muted}}>{zh?'说明来自学校公开页面；个人资格或期限请以官方系统为准。':'Guides come from public school pages; check eligibility and deadlines in official systems.'}</Text>
 </View>;
}

function Label({text}:{text:string}){const c=usePenColors();return <Text style={{paddingHorizontal:4,paddingTop:8,fontSize:13,fontWeight:'600',color:c.muted}}>{text}</Text>;}
function Card({children}:{children:ReactNode}){const c=usePenColors();return <View style={{borderRadius:20,overflow:'hidden',backgroundColor:c.surface}}>{children}</View>;}
function TextRows({rows,lead}:{rows:string[];lead:PenIconName|'num'}){
 const c=usePenColors();
 return <Card>{rows.map((t,i)=><View key={i} style={{flexDirection:'row',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
  <View style={{width:22,paddingTop:2}}>{lead==='num'?<Text style={{fontSize:15,fontWeight:'700',color:c.accent,fontVariant:['tabular-nums']}}>{i+1}</Text>:<PenIcon name={lead} size={18} color={c.muted}/>}</View>
  <Text selectable style={{flex:1,fontSize:15,lineHeight:22,color:c.text}}>{t}</Text>
 </View>)}</Card>;
}
function Sources({template,language}:{template:Template;language:Language}){
 const c=usePenColors(),zh=language==='zh';
 return <Card>{template.sources.map((s,i)=><Pressable key={s.id} accessibilityRole="link" accessibilityLabel={sourceTitle(s.url,language)} onPress={()=>void openOfficial(s.url).catch(()=>Alert.alert(zh?'无法打开官方页面':'Unable to open the official page'))} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border,backgroundColor:pressed?c.fill:'transparent'})}>
  <View style={{flex:1,gap:2}}><Text style={{fontSize:16,color:c.text}}>{sourceTitle(s.url,language)}</Text><Text style={{fontSize:13,color:c.muted}}>{host(s.url)}</Text></View>
  <PenIcon name="arrow-up-right" size={16} color={c.muted}/>
 </Pressable>)}</Card>;
}
function Status({icon,color,title,sub,action}:{icon:PenIconName;color:string;title:string;sub:string;action?:ReactNode}){
 const c=usePenColors();
 return <View style={{gap:14,padding:16,borderRadius:20,backgroundColor:c.surface}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:color+'1F'}}><PenIcon name={icon} size={20} color={color}/></View>
   <View style={{flex:1,gap:2}}><Text accessibilityRole="alert" style={{fontSize:17,fontWeight:'700',color:c.text}}>{title}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{sub}</Text></View>
  </View>
  {action}
 </View>;
}
function Soft({label,onPress,disabled}:{label:string;onPress:()=>void;disabled?:boolean}){const c=usePenColors();return <Pressable accessibilityRole="button" disabled={disabled} onPress={()=>{feel.tap();onPress();}} style={({pressed})=>({height:46,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:c.surface,opacity:disabled?0.4:pressed?0.7:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.text}}>{label}</Text></Pressable>;}

function TemplateDetail({template:t,language,existing,onBack,onOpen}:{template:Template;language:Language;existing?:string;onBack:()=>void;onOpen:(id:string)=>void}){
 const [controller]=useState(()=>new CreateAffairController(t.template_id,t.revision,newWriteKey(),(p,o)=>session.request(p,o)));
 const s=useSyncExternalStore(controller.subscribe,controller.snapshot),zh=language==='zh',c=usePenColors(),protect=useSceneNavigation(zh);
 useEffect(()=>()=>controller.dispose(),[controller]);useNavigationProtection(s.phase==='saving'?'busy':s.phase==='uncertain'?'uncertain':'clear',zh);
 const available=t.source_health==='verified'&&Date.parse(t.review_due_at)>Date.now();
 async function create(){if(await controller.save()){const id=controller.snapshot().id;if(id){feel.success();onOpen(id);}}}
 const deadline=t.deadline.kind==='fixed'?t.deadline:null,due=deadline?hkParts(deadline.at):'';
 return <View style={{gap:12}}>
  <View style={{flexDirection:'row'}}><CircleButton icon="chevron-left" label={zh?'返回办事指南':'Back to guides'} onPress={()=>protect(onBack)}/></View>
  <View style={{paddingHorizontal:4,gap:6}}>
   <Text accessibilityRole="header" style={{fontSize:28,lineHeight:34,fontWeight:'800',color:c.text,letterSpacing:-0.4}}>{t.title[language]}</Text>
   <Text selectable style={{fontSize:15,lineHeight:22,color:c.muted}}>{t.summary[language]}</Text>
  </View>
  {deadline?<View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderRadius:20,backgroundColor:c.surface}}>
   <PenIcon name="calendar-clock" size={18} color={c.orange}/>
   <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'600',color:c.text}}>{zh?`截止：${due.slice(0,4)} 年 ${Number(due.slice(5,7))} 月 ${Number(due.slice(8,10))} 日 ${due.slice(11)}`:`Deadline: ${due} HKT`}</Text><Text style={{fontSize:13,color:c.muted}}>{zh?`来自 ${sourceTitle(t.sources.find(x=>x.id===deadline.source_id)?.url??'',language)}`:`From ${sourceTitle(t.sources.find(x=>x.id===deadline.source_id)?.url??'',language)}`}</Text></View>
  </View>:null}
  {t.conditions.length?<><Label text={zh?'条件':'Conditions'}/><TextRows rows={t.conditions.map(x=>x.text[language])} lead="info"/></>:null}
  {t.materials.length?<><Label text={zh?'需要准备':'You’ll need'}/><TextRows rows={t.materials.map(x=>x.text[language])} lead="file-text"/></>:null}
  <Label text={zh?'步骤':'Steps'}/><TextRows rows={t.steps.map(x=>x.text[language])} lead="num"/>
  <Label text={zh?'官方页面':'Official pages'}/><Sources template={t} language={language}/>
  <Text style={{textAlign:'center',paddingHorizontal:4,fontSize:12,lineHeight:18,color:c.muted}}>{zh?`来源核对于 ${monthDay(t.reviewed_at,zh)} · 打开官方页面不会改变你的进度`:`Sources checked ${monthDay(t.reviewed_at,zh)} · opening a page doesn’t change your progress`}</Text>
  {!available&&!existing?<Notice tone="warning" text={zh?'这份说明待重新核对，暂不能建立新清单':'This guide is due for review; new checklists are paused'}/>:null}
  {s.phase==='uncertain'?<Notice tone="warning" text={zh?'建立结果还没确认；重试只会核对同一次，不会建立第二份。':'Not confirmed yet; retrying checks the same request and never makes a second copy.'}/>:null}
  {s.phase==='error'?<Notice tone="error" text={zh?'没有建立成功，返回后刷新再试。':'Couldn’t create it. Go back, refresh and try again.'}/>:null}
  {existing?<View style={{flexDirection:'row',paddingTop:4}}><PrimaryButton tone="soft" label={zh?'打开我的清单':'Open my checklist'} onPress={()=>onOpen(existing)}/></View>
  :<View style={{flexDirection:'row',paddingTop:4}}><PrimaryButton label={s.phase==='saving'?(zh?'正在建立…':'Creating…'):s.phase==='uncertain'?(zh?'再试一次':'Try again'):(zh?'建立我的清单':'Start my checklist')} disabled={!available||s.phase==='saving'||s.phase==='error'} onPress={()=>void create()}/></View>}
 </View>;
}

function AffairEditor({id,language,onBack}:{id:string;language:Language;onBack:()=>void}){
 const [controller]=useState(()=>new AffairController(id,(p,o)=>session.request(p,o)));
 const [acceptor]=useState(()=>new AcceptRevisionController(id,newWriteKey,(p,o)=>session.request(p,o)));
 const s=useSyncExternalStore(controller.subscribe,controller.snapshot),a=useSyncExternalStore(acceptor.subscribe,acceptor.snapshot);
 const zh=language==='zh',c=usePenColors(),protect=useSceneNavigation(zh),editable=['ready','dirty'].includes(s.phase),v=s.value;
 const [reviewing,setReviewing]=useState(false),[picking,setPicking]=useState(false);
 useNavigationProtection(a.phase==='saving'?'busy':a.phase==='uncertain'?'uncertain':controller.protection(),zh);
 useEffect(()=>{void controller.refresh();return()=>{controller.dispose();acceptor.dispose();};},[controller,acceptor]);
 const draft={...v,...s.draft,step_checks:{...v?.step_checks,...s.draft.step_checks}};
 const dirty=s.phase==='dirty'||s.phase==='saving';
 // Pen WZaR0 "Save bar (when edited)": replaces the tab bar while there are unsaved changes.
 useSceneBottomBar(dirty?<BottomBar><View style={{flexDirection:'row'}}><PrimaryButton label={s.phase==='saving'?(zh?'正在保存…':'Saving…'):(zh?'保存修改':'Save changes')} disabled={s.phase==='saving'} onPress={()=>void controller.save().then(ok=>{if(ok)feel.success();})}/></View><Pressable accessibilityRole="button" disabled={s.phase==='saving'} onPress={()=>controller.discard()} style={{alignItems:'center',paddingVertical:6}}><Text style={{fontSize:14,fontWeight:'600',color:c.muted}}>{zh?'放弃修改':'Discard'}</Text></Pressable></BottomBar>:null);
 const openReview=()=>{if(s.phase!=='dirty'){acceptor.reset();setReviewing(true);return;}
  Alert.alert(zh?'先处理未保存的修改':'Unsaved changes',zh?'核对新说明前，需要先保存或放弃这些修改。':'Save or discard your changes before reviewing the new guide.',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'放弃修改':'Discard',style:'destructive',onPress:()=>{controller.discard();acceptor.reset();setReviewing(true);}},{text:zh?'保存':'Save',onPress:()=>void controller.save().then(ok=>{if(ok){acceptor.reset();setReviewing(true);}})}]);};
 const archive=()=>{if(!v)return;const next=!v.archived;Alert.alert(next?(zh?'归档这份清单？':'Archive this checklist?'):(zh?'取消归档？':'Unarchive?'),next?(zh?'归档后在「已归档」里还能找到。':'You can find it under Archived.'):undefined,[{text:zh?'取消':'Cancel',style:'cancel'},{text:next?(zh?'归档':'Archive'):(zh?'取消归档':'Unarchive'),onPress:()=>{controller.edit({archived:next});void controller.save().then(ok=>{if(ok){feel.success();onBack();}});}}]);};
 const steps=v?.template.steps??[],done=steps.filter(st=>draft.step_checks[st.id]).length;
 const due=draft.personal_due?.kind==='date'?draft.personal_due.date:draft.personal_due?.kind==='time'?hkParts(draft.personal_due.at).slice(0,10):'';
 return <View style={{gap:12}}>
  <View style={{flexDirection:'row'}}><CircleButton icon="chevron-left" label={zh?'返回办事指南':'Back to guides'} onPress={()=>protect(onBack)}/></View>
  {!v&&(s.phase==='loading'||s.phase==='idle')?<><Skeleton height={90} radius={20}/><Skeleton height={180} radius={20}/></>:null}
  {s.phase==='gone'?<Notice tone="info" text={zh?'这份清单已经删除。':'This checklist was deleted.'} action={zh?'返回':'Back'} onAction={onBack}/>:null}
  {s.phase==='error'&&!v?<Notice tone="error" text={zh?'读取失败，请检查网络后重试。':'Couldn’t load. Check your connection and retry.'} action={zh?'重试':'Retry'} onAction={()=>void controller.refresh()}/>:null}
  {v?<>
   <View style={{paddingHorizontal:4,gap:8}}>
    <Text accessibilityRole="header" style={{fontSize:28,lineHeight:34,fontWeight:'800',color:c.text,letterSpacing:-0.4}}>{v.label||v.template.title[language]}</Text>
    <View style={{flexDirection:'row',gap:6}}>{([['lock',zh?'仅自己可见':'Only you'],['circle-check',zh?`已完成 ${done}/${steps.length}`:`${done}/${steps.length} done`]] as [PenIconName,string][]).map(([icon,t])=><View key={t} style={{flexDirection:'row',alignItems:'center',gap:4,paddingVertical:4,paddingHorizontal:10,borderRadius:99,backgroundColor:c.fill}}><PenIcon name={icon} size={12} color={c.text}/><Text style={{fontSize:12,fontWeight:'600',color:c.text}}>{t}</Text></View>)}</View>
   </View>
   {s.phase==='uncertain'?<Notice tone="warning" text={zh?'保存结果还没确认，你的修改仍保留。':'Save not confirmed; your changes are kept.'} action={zh?'读取最新':'Reload'} onAction={()=>void controller.refresh()}/>:null}
   {s.phase==='review'?<Status icon="git-compare" color={c.orange} title={zh?'记录刚刚在别处改过':'The record changed elsewhere'} sub={zh?'保留你的修改继续编辑，或采用已保存的记录。':'Keep your edits, or use the saved record.'} action={<View style={{gap:8}}><View style={{flexDirection:'row'}}><PrimaryButton label={zh?'保留我的修改':'Keep my edits'} onPress={()=>controller.resolve('keep-draft')}/></View><Soft label={zh?'采用已保存的记录':'Use saved record'} onPress={()=>controller.resolve('use-server')}/></View>}/>:null}
   {v.requires_review?<View style={{gap:12,padding:16,borderRadius:20,backgroundColor:c.orange+'14'}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
     <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:c.orange+'1F'}}><PenIcon name="refresh-cw" size={18} color={c.orange}/></View>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'官方说明有更新':'The official guide changed'}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?`${monthDay(v.current_template.reviewed_at,zh)}更新 · 先看看改了什么，再继续勾选`:`Updated ${monthDay(v.current_template.reviewed_at,zh)} · see what changed before ticking more`}</Text></View>
    </View>
    <Soft label={zh?'核对新说明':'Review the new guide'} onPress={openReview} disabled={s.phase==='saving'||s.phase==='loading'}/>
   </View>:null}
   <Label text={zh?'步骤':'Steps'}/>
   <Card>{steps.map((step,i)=>{const on=!!draft.step_checks[step.id];return <View key={step.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingLeft:14,paddingRight:16,minHeight:56,paddingVertical:8,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
    <CheckCircle checked={on} disabled={!editable} label={step.text[language]} onPress={()=>controller.edit({step_checks:{[step.id]:!on}})}/>
    <Text style={{flex:1,fontSize:16,lineHeight:22,color:on?c.muted:c.text,textDecorationLine:on?'line-through':'none'}}>{step.text[language]}</Text>
    <Text style={{fontSize:13,fontWeight:'600',color:c.tertiary,fontVariant:['tabular-nums']}}>{i+1}</Text>
   </View>;})}</Card>
   <Label text={zh?'我的安排':'My plan'}/>
   <Card>
    <Pressable accessibilityRole="button" disabled={!editable} onPress={()=>setPicking(true)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,backgroundColor:pressed?c.fill:'transparent'})}>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:16,color:c.text}}>{zh?'我的截止日期':'My target date'}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?`只提醒你自己；官方期限以${office(v.template,language)}为准`:`Just for you; ${office(v.template,language)} sets the real deadline`}</Text></View>
     <Text style={{fontSize:15,color:c.muted}}>{due?dateLabel(due,zh):(zh?'未设置':'Not set')}</Text>
     <PenIcon name="chevron-right" size={16} color={c.tertiary}/>
    </Pressable>
    <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:0.5,borderTopColor:c.border}}>
     <View style={{flex:1,gap:2}}><Text style={{fontSize:16,color:c.text}}>{zh?'我已在学校系统办理':'I applied in the school system'}</Text><Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{v.reported_at&&draft.submission==='self_reported'?(zh?`记录于 ${monthDay(v.reported_at,zh)} ${hkParts(v.reported_at).slice(11)} · 结果请在学校系统核对`:`Noted ${monthDay(v.reported_at,zh)} · check the result in the school system`):(zh?'只是你的记录；结果请在学校系统核对':'Only your note; check the result in the school system')}</Text></View>
     <Switch accessibilityLabel={zh?'我已在学校系统办理':'I applied in the school system'} value={draft.submission==='self_reported'} disabled={!editable} onValueChange={on=>{feel.select();controller.edit({submission:on?'self_reported':'not_reported'});}} trackColor={{true:c.accent}}/>
    </View>
   </Card>
   <Label text={zh?'备注':'Note'}/>
   <TextInput accessibilityLabel={zh?'备注':'Note'} multiline maxLength={2000} editable={editable} value={draft.note??''} onChangeText={note=>controller.edit({note})} placeholder={zh?'只有你能看到':'Only you can see this'} placeholderTextColor={c.muted} style={{minHeight:84,borderRadius:16,backgroundColor:c.surface,paddingHorizontal:14,paddingTop:12,paddingBottom:12,fontSize:15,lineHeight:21,color:c.text,textAlignVertical:'top'}}/>
   <Label text={zh?'官方页面':'Official pages'}/>
   <Sources template={v.template} language={language}/>
   <Text style={{textAlign:'center',paddingHorizontal:4,paddingTop:4,fontSize:12,lineHeight:18,color:c.muted}}>{zh?`来源核对于 ${monthDay(v.template.reviewed_at,zh)} · 勾选只记录你的进度，不代表学校已受理`:`Sources checked ${monthDay(v.template.reviewed_at,zh)} · ticks are your progress, not the school’s acceptance`}</Text>
   <Pressable accessibilityRole="button" disabled={!editable} onPress={archive} style={{alignSelf:'center',paddingVertical:8,opacity:editable?1:0.4}}><Text style={{fontSize:13,fontWeight:'500',color:c.muted}}>{v.archived?(zh?'取消归档':'Unarchive'):(zh?'归档这份清单':'Archive this checklist')}</Text></Pressable>
   {picking?<PickerSheet zh={zh} title={zh?'我的截止日期':'My target date'} value={due} mode="date" clearable onClose={()=>setPicking(false)} onDone={d=>{setPicking(false);controller.edit({personal_due:d?{kind:'date',date:d,timezone:'Asia/Hong_Kong'}:null});}}/>:null}
   <ReviewSheet visible={reviewing} value={v} acceptor={acceptor} state={a} language={language} onClose={()=>setReviewing(false)} onAccepted={()=>{feel.success();setReviewing(false);void controller.refresh();}} onReload={()=>{acceptor.reset();void controller.refresh();}}/>
  </>:null}
 </View>;
}

/** Pen NMWlS: what changed between the accepted and the current guide; the student decides per changed step. */
function ReviewSheet({visible,value:v,acceptor,state,language,onClose,onAccepted,onReload}:{visible:boolean;value:AffairDetail;acceptor:AcceptRevisionController;state:ReturnType<AcceptRevisionController['snapshot']>;language:Language;onClose:()=>void;onAccepted:()=>void;onReload:()=>void}){
 const c=usePenColors(),zh=language==='zh';
 const old:Step[]=v.template.steps,next:Step[]=v.current_template.steps;
 const changed=next.filter(s=>old.some(o=>o.id===s.id&&!sameValue(o,s))),added=next.filter(s=>!old.some(o=>o.id===s.id)),removed=old.filter(o=>!next.some(s=>s.id===o.id));
 const others=v.change_summary.map(x=>x.field).filter(f=>FIELD_LABEL[f]);
 const locked=acceptor.lockedBody();
 const [choices,setChoices]=useState<Record<string,'retain'|'reset'>>({});
 const choiceOf=(id:string)=>locked?.changed_step_choices[id]??choices[id]??(v.step_checks[id]?'retain':'reset');
 const submit=async()=>{const body={instance_version:v.version,from_revision:v.accepted_revision,to_revision:v.current_revision,changed_step_choices:Object.fromEntries(changed.map(s=>[s.id,choiceOf(s.id)]))};if(await acceptor.submit(locked?undefined:body))onAccepted();};
 const busy=state.phase==='saving';
 const section=(title:string,children:ReactNode)=><><Label text={title}/><Card>{children}</Card></>;
 return <BottomSheet visible={visible} onClose={onClose} closeLabel={zh?'关闭':'Close'} header={<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,height:44}}>
   <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose}><Text style={{fontSize:17,color:c.accent}}>{zh?'取消':'Cancel'}</Text></Pressable>
   <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'700',color:c.text}}>{zh?'说明有更新':'Guide updated'}</Text>
   <Text style={{fontSize:17,color:'transparent'}}>{zh?'取消':'Cancel'}</Text>
  </View>}>
  <ScrollView style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{paddingHorizontal:16,paddingTop:4,paddingBottom:16,gap:10}}>
   <View style={{paddingHorizontal:4,gap:2}}>
    <Text style={{fontSize:17,fontWeight:'700',color:c.text}}>{v.label||v.current_template.title[language]}</Text>
    <Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?`官方说明 ${monthDay(v.current_template.reviewed_at,zh)}更新。你的进度会保留，改了说明的步骤由你决定。`:`Updated ${monthDay(v.current_template.reviewed_at,zh)}. Your progress is kept; you decide for steps whose wording changed.`}</Text>
   </View>
   {state.phase==='uncertain'?<Status icon="loader" color={c.accent} title={zh?'更新结果还没确认':'Not confirmed yet'} sub={zh?'重试只会核对同一次更新，不会重复提交':'Retrying checks the same update; nothing is sent twice'}/>:null}
   {state.phase==='conflict'?<Status icon="refresh-cw" color={c.orange} title={zh?'内容刚刚又变了':'It changed again'} sub={zh?'重新读取后再核对一次':'Reload, then review once more'} action={<View style={{flexDirection:'row'}}><PrimaryButton label={zh?'重新读取':'Reload'} onPress={onReload}/></View>}/>:null}
   {state.phase==='error'?<Notice tone="error" text={zh?'没有更新成功，请重新读取后再试。':'Couldn’t update. Reload and try again.'} action={zh?'重新读取':'Reload'} onAction={onReload}/>:null}
   {changed.length?section(zh?'说明改了的步骤':'Steps with new wording',changed.map((s,i)=>{const before=old.find(o=>o.id===s.id)!,wasDone=!!v.step_checks[s.id],choice=choiceOf(s.id);return <View key={s.id} style={{gap:6,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}>
    <Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{zh?'原来：':'Was: '}{before.text[language]}</Text>
    <Text style={{fontSize:16,lineHeight:22,fontWeight:'600',color:c.text}}>{s.text[language]}</Text>
    {wasDone?<View accessibilityRole="radiogroup" style={{flexDirection:'row',gap:4,padding:3,borderRadius:99,backgroundColor:c.fill}}>{(['retain','reset'] as const).map(k=>{const on=choice===k;return <Pressable key={k} accessibilityRole="radio" accessibilityState={{checked:on,disabled:!!locked||busy}} disabled={!!locked||busy} onPress={()=>{feel.select();setChoices(x=>({...x,[s.id]:k}));}} style={{flex:1,height:32,borderRadius:99,alignItems:'center',justifyContent:'center',backgroundColor:on?c.surface:'transparent'}}><Text style={{fontSize:13,fontWeight:on?'600':'500',color:on?c.text:c.muted}}>{k==='retain'?(zh?'保留已完成':'Keep done'):(zh?'改回未完成':'Mark not done')}</Text></Pressable>;})}</View>
    :<Text style={{fontSize:12,color:c.muted}}>{zh?'你还没勾这一步，保持未完成':'Not ticked yet; stays not done'}</Text>}
   </View>;})):null}
   {added.length?section(zh?'新增步骤':'New steps',added.map((s,i)=><View key={s.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}><PenIcon name="plus" size={18} color={c.green}/><Text style={{flex:1,fontSize:15,lineHeight:21,color:c.text}}>{s.text[language]}</Text></View>)):null}
   {removed.length?section(zh?'不再需要的步骤':'Removed steps',removed.map((s,i)=><View key={s.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,paddingHorizontal:16,borderTopWidth:i?0.5:0,borderTopColor:c.border}}><PenIcon name="minus" size={18} color={c.muted}/><Text style={{flex:1,fontSize:15,lineHeight:21,color:c.muted}}>{s.text[language]}</Text></View>)):null}
   {others.length?<View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,paddingHorizontal:4,paddingTop:2}}><Text style={{fontSize:13,fontWeight:'500',color:c.muted}}>{zh?'也有更新：':'Also updated:'}</Text>{others.map(f=><View key={f} style={{paddingVertical:3,paddingHorizontal:8,borderRadius:99,backgroundColor:c.fill}}><Text style={{fontSize:12,fontWeight:'600',color:c.text}}>{FIELD_LABEL[f][zh?0:1]}</Text></View>)}</View>:null}
  </ScrollView>
  {state.phase!=='conflict'?<View style={{paddingHorizontal:16,paddingTop:8,gap:4}}>
   <View style={{flexDirection:'row'}}><PrimaryButton label={busy?(zh?'正在更新…':'Updating…'):state.phase==='uncertain'?(zh?'再试一次':'Try again'):(zh?'使用新说明':'Use the new guide')} disabled={busy} onPress={()=>void submit()}/></View>
   <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={({pressed})=>({height:40,alignItems:'center',justifyContent:'center',opacity:busy?0.4:pressed?0.6:1})}><Text style={{fontSize:15,fontWeight:'600',color:c.muted}}>{zh?'稍后再说':'Later'}</Text></Pressable>
  </View>:null}
 </BottomSheet>;
}
