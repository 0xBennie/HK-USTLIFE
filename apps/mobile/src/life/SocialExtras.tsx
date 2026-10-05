// Pen boards "V3 / 二手市场" (N3tva, live: wall posts with topic=market), "V3 / 我的数据 API" (O6b1L),
// "V3 / 企业校招主页" (BlIE0, sample), "V3 / 同学名片" (QOgeS, live posts by that author) — V5 styling.
import {useEffect,useState} from 'react';
import {Alert,Linking,Modal,Pressable,ScrollView,Share,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api,session} from '../runtime';
import type {WallPost} from '../../../../src/product/social/wall-types';
import {CircleButton,EmptyState,GlassChips,Hero,HeroActions,ListGroup,ListRow,PenIcon,PrimaryButton,SearchField,Section,Skeleton,Surface,usePenColors} from '../ui/Pen';
import {useAppearance} from '../ui/Appearance';
import {feel} from '../ui/feel';
import {GradientAvatar,WallPostCard,relativeTime} from '../social/wall-ui';
import {LifeTop} from './kit';
type Base={zh:boolean;onBack:()=>void};
const price=(t:string)=>t.match(/HK\$\s?\d+/i)?.[0]??null;
const marketKind=(p:WallPost)=>/换|swap/i.test(p.title)?'swap':/书|教材|笔记|book/i.test(p.title)?'books':/扇|电|显示器|耳机|fan|monitor/i.test(p.title)?'electronics':/桌|椅|床|柜|desk|chair/i.test(p.title)?'furniture':'other';

export function MarketScreen({zh,onBack,onOpenPost,onCompose}:Base&{onOpenPost:(id:string)=>void;onCompose:()=>void}){
 const c=usePenColors();
 const [posts,setPosts]=useState<WallPost[]|null>(null),[q,setQ]=useState(''),[kind,setKind]=useState('all'),[open,setOpen]=useState<WallPost|null>(null);
 useEffect(()=>{let live=true;(session.snapshot().profile?session:api).request<{items:WallPost[]}>('/posts?topic=market').then(r=>{if(live)setPosts(r.items);}).catch(()=>{if(live)setPosts([]);});return()=>{live=false;};},[]);
 const list=(posts??[]).filter(p=>(kind==='all'||marketKind(p)===kind)&&`${p.title} ${p.body}`.toLowerCase().includes(q.trim().toLowerCase()));
 const tint=(p:WallPost)=>({books:'#24467F',electronics:'#4F6F8C',furniture:'#A9824C',swap:'#7A5C8E',other:'#56647D'} as Record<string,string>)[marketKind(p)];
 const icon=(p:WallPost)=>({books:'book-open',electronics:'fan',furniture:'armchair',swap:'repeat',other:'package'} as Record<string,string>)[marketKind(p)];
 return <View style={{gap:16}}>
  <LifeTop zh={zh} title={zh?'二手与换宿':'Market & swaps'} onBack={onBack} right={{icon:'plus',label:zh?'发布':'Post',onPress:onCompose}}/>
  <SearchField value={q} onChangeText={setQ} placeholder={zh?'教材、风扇、换宿舍…':'Books, fans, hall swaps…'}/>
  <GlassChips label={zh?'分类':'Category'} value={kind} onChange={setKind} items={[{value:'all',label:zh?'全部':'All'},{value:'books',label:zh?'教材':'Books'},{value:'electronics',label:zh?'电器':'Electronics'},{value:'furniture',label:zh?'家具':'Furniture'},{value:'swap',label:zh?'换宿':'Swaps'}]}/>
  {posts===null?<View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Skeleton height={190}/></View><View style={{flex:1}}><Skeleton height={190}/></View></View>:null}
  {posts&&!list.length?<Surface><EmptyState icon="shopping-bag" title={zh?'暂时没有':'Nothing here yet'} body={zh?'在校园墙选“二手”发帖，就会出现在这里。':'Post on the wall with the Market topic.'} action={zh?'发布二手':'Post an item'} onAction={onCompose}/></Surface>:null}
  <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10}}>{list.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={()=>{feel.tap();setOpen(p);}} style={({pressed})=>({width:'48.5%',borderRadius:24,borderCurve:'continuous',overflow:'hidden',backgroundColor:c.surface,boxShadow:'0 6px 18px #1B35660D',transform:[{scale:pressed?0.97:1}]})}>
   <View style={{height:110,alignItems:'center',justifyContent:'center',backgroundColor:tint(p)+'14'}}><PenIcon name={icon(p)} size={40} strokeWidth={1.6} color={tint(p)}/></View>
   <View style={{padding:12,gap:4}}><Text numberOfLines={2} style={{fontSize:14,fontWeight:'700',color:c.text}}>{p.title.replace(/[，,]?\s*HK\$\s?\d+/i,'')}</Text><Text style={{fontSize:14,fontWeight:'800',color:marketKind(p)==='swap'?'#7A5C8E':'#A9824C'}}>{price(p.title)??(marketKind(p)==='swap'?(zh?'换宿':'Swap'):(zh?'面议':'Ask'))}</Text></View>
  </Pressable>)}</View>
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'交易约在校内公共地点；平台不经手付款。':'Meet on campus in public; we never handle payment.'}</Text>
  <ItemSheet post={open} zh={zh} onClose={()=>setOpen(null)} onOpen={id=>{setOpen(null);onOpenPost(id);}}/>
 </View>;
}
/** Native page sheet (Pen V5 "sheet" layer) for a market item. */
function ItemSheet({post,zh,onClose,onOpen}:{post:WallPost|null;zh:boolean;onClose:()=>void;onOpen:(id:string)=>void}){
 const c=usePenColors(),{reduceMotion}=useAppearance();
 return <Modal visible={!!post} presentationStyle="pageSheet" animationType={reduceMotion?'none':'slide'} onRequestClose={onClose}>
  <SafeAreaView edges={['bottom']} style={{flex:1,backgroundColor:c.background}}>
   {post?<ScrollView contentContainerStyle={{padding:20,gap:16}}>
    <View style={{alignSelf:'center',width:40,height:5,borderRadius:3,backgroundColor:c.fill}}/>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}><GradientAvatar name={post.author.display_name}/><View style={{flex:1}}><Text style={{fontSize:16,fontWeight:'700',color:c.text}}>{post.author.display_name}</Text><Text style={{fontSize:12,color:c.muted}}>{relativeTime(post.created_at,zh)}</Text></View><CircleButton icon="x" label={zh?'关闭':'Close'} onPress={onClose}/></View>
    <Text style={{fontSize:24,fontWeight:'800',color:c.text}}>{post.title}</Text>
    <Text style={{fontSize:16,lineHeight:24,color:c.muted}}>{post.body}</Text>
    <ListGroup><ListRow icon="map-pin" tile="#24467F" title={zh?'建议校内当面交易':'Meet on campus'} subtitle={zh?'北闸、LG7、图书馆门口等公共地点':'North Gate, LG7, library entrance'}/><ListRow icon="shield-check" tile="#2E9E5B" title={zh?'仅同学可见':'Members only'} subtitle={zh?'对方是验证过的科大同学':'Verified HKUST member'}/></ListGroup>
    <PrimaryButton icon="message-circle" label={zh?'回复卖家':'Reply to seller'} onPress={()=>onOpen(post.id)}/>
   </ScrollView>:null}
  </SafeAreaView>
 </Modal>;
}

type Token={id:string;name:string;created_at:string;last_used_at:string|null;token?:string}; // release-check:allow (type field name; the key is shown once, never stored)
export function DataApiScreen({zh,onBack}:Base){
 const c=usePenColors();
 const [tokens,setTokens]=useState<Token[]|null>(null),[fresh,setFresh]=useState<Token|null>(null),[error,setError]=useState('');
 const load=()=>session.request<Token[]>('/me/tokens').then(setTokens).catch(()=>setError(zh?'暂时无法读取连接。':'Could not load connections.'));
 useEffect(()=>{void load();},[]);
 const create=(name:string)=>{setError('');void session.request<Token>('/me/tokens',{method:'POST',body:{name}}).then(t=>{feel.success();setFresh(t);void load();}).catch(e=>setError(e?.code==='TOKEN_LIMIT'?(zh?'最多 5 个连接，请先撤销旧的。':'Max 5 connections.'):(zh?'创建失败，请重试。':'Could not create.')));};
 const ask=()=>Alert.prompt(zh?'给这个连接起个名字':'Name this connection',zh?'例如 Claude、ChatGPT、快捷指令':'e.g. Claude, ChatGPT, Shortcuts',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'创建':'Create',onPress:(v?:string)=>{const n=(v??'').trim();if(n)create(n.slice(0,40));}}],'plain-text','Claude');
 const revoke=(t:Token)=>Alert.alert(zh?`撤销「${t.name}」？`:`Revoke ${t.name}?`,zh?'撤销后这个 AI 立刻无法再读取你的数据。':'It immediately loses access.',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'撤销':'Revoke',style:'destructive',onPress:()=>void session.request(`/me/tokens/${t.id}`,{method:'DELETE'}).then(()=>{feel.tap();void load();})}]);
 const base='http://127.0.0.1:4338/api/v1';
 const when=(iso:string|null)=>iso?relativeTime(iso,zh):(zh?'还没用过':'Never used');
 const endpoints:[string,string][]=[['/me/calendar',zh?'今天和本周的课、截止':'Classes and deadlines'],['/me/notifications',zh?'消息与提醒':'Inbox'],['/transport/routes',zh?'校巴时刻':'Shuttle times'],['/posts',zh?'校园墙':'Campus wall']];
 return <View style={{gap:18}}>
  <LifeTop zh={zh} title={zh?'用 AI 管理生活':'AI for campus life'} onBack={onBack}/>
  <Surface style={{gap:8}}><Text style={{fontSize:20,fontWeight:'800',color:c.text}}>{zh?'把你的校园数据交给你的 AI':'Hand your campus data to your AI'}</Text><Text style={{fontSize:14,lineHeight:21,color:c.muted}}>{zh?'生成一把只读钥匙，交给 ChatGPT、Claude 或快捷指令，直接问“我这周有什么要交”。它只能读，不能改；随时撤销。':'Create a read-only key for ChatGPT, Claude or Shortcuts. It can read, never write. Revoke anytime.'}</Text></Surface>
  {fresh?.token?<Surface style={{gap:10,borderWidth:1.5,borderColor:'#2E9E5B'}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><PenIcon name="key-round" size={18} color="#2E9E5B"/><Text style={{flex:1,fontSize:16,fontWeight:'700',color:c.text}}>{zh?`「${fresh.name}」的钥匙`:`Key for ${fresh.name}`}</Text></View>
   <Text selectable style={{fontSize:13,fontFamily:'Menlo',color:c.text,padding:10,borderRadius:12,backgroundColor:c.fill}}>{fresh.token}</Text>
   <Text style={{fontSize:12,color:'#D98A1C'}}>{zh?'只显示这一次。关掉后无法再看到，请现在复制。':'Shown only once — copy it now.'}</Text>
   <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><PrimaryButton icon="share" label={zh?'复制 / 分享':'Copy / share'} onPress={()=>void Share.share({message:`USTLIFE API\n${base}\nAuthorization: Bearer ${fresh.token}`})}/></View><View style={{flex:1}}><PrimaryButton tone="soft" label={zh?'我已保存':'Done'} onPress={()=>setFresh(null)}/></View></View>
  </Surface>:null}
  {error?<Text style={{paddingHorizontal:4,fontSize:13,color:c.red}}>{error}</Text>:null}
  <Section title={zh?'我的连接':'Connections'}>
   {tokens===null?<Skeleton height={72} radius={28}/>:tokens.length?<ListGroup>{tokens.map(t=><ListRow key={t.id} icon="bot" tile="#24467F" title={t.name} subtitle={`${zh?'只读':'Read-only'} · ${when(t.last_used_at)}`} value={zh?'撤销':'Revoke'} valueColor={c.red} onPress={()=>revoke(t)}/>)}</ListGroup>:<Surface><Text style={{fontSize:15,color:c.muted}}>{zh?'还没有连接。点下面新建一个。':'No connections yet.'}</Text></Surface>}
  </Section>
  {/* Pen "V5 / 交互 · 截止滑动与 AI 钥匙" (pD6xT): while a fresh key is shown, sharing it is the only primary action. */}
  {fresh?null:<PrimaryButton label={zh?'新建连接':'New connection'} onPress={ask}/>}
  <Section title={zh?'上手教程':'Get started'}><ListGroup>
   <ListRow icon="message-square-text" tile="#56647D" title={zh?'5 个好用的提问':'5 great prompts'} subtitle={zh?'“帮我排一下这周的复习时间”':'"Plan my revision this week"'} chevron onPress={()=>Alert.alert(zh?'5 个好用的提问':'Prompts',zh?'1. 我这周有哪些截止？\n2. 下一班去坑口的车几点？\n3. 帮我把 Lab 5 拆成三步\n4. 周三下午哪里有空研讨室？\n5. 把今天的安排读给我听':'1. What’s due this week?\n2. Next bus to Hang Hau?\n3. Split Lab 5 into steps\n4. Free study rooms Wed pm?\n5. Read me today’s plan')}/>
   <ListRow icon="code" tile="#4F6F8C" title={zh?'开发者接口':'Developer endpoints'} subtitle={endpoints.map(e=>e[0]).join(' · ')} chevron onPress={()=>Alert.alert(zh?'开发者接口（只读）':'Endpoints (read-only)',`${base}\n\n`+endpoints.map(([p,d])=>`GET ${p}  ${d}`).join('\n')+`\n\nAuthorization: Bearer ustl_…`)}/>
  </ListGroup></Section>
 </View>;
}

type Employer={id:string;name:string;tagline:string;verified:boolean;sample:boolean;quote:string|null;quote_by:string|null;jobs:{id:string;title:string;detail:string;apply_url:string}[];talks:{id:string;title:string;venue:string;starts_at:string;going:number;rsvp:boolean}[]};
export function CompanyScreen({zh,onBack,id}:Base&{id:string}){
 const c=usePenColors();
 const [co,setCo]=useState<Employer|null>(null),[error,setError]=useState(false);
 useEffect(()=>{void (session.snapshot().profile?session:api).request<Employer>(`/employers/${id}`).then(setCo).catch(()=>setError(true));},[id]);
 const apply=(j:Employer['jobs'][number])=>Alert.alert(zh?`投递「${j.title}」？`:`Apply to ${j.title}?`,zh?'会打开企业的官方投递页面，你的资料不会自动发送。':'Opens the official careers page; nothing is sent automatically.',[{text:zh?'取消':'Cancel',style:'cancel'},{text:zh?'去投递':'Continue',onPress:()=>{feel.tap();void Linking.openURL(j.apply_url);}}]);
 const rsvp=(t:Employer['talks'][number])=>{feel.success();void session.request<Employer['talks'][number]>(`/me/talks/${t.id}`,{method:'PUT',body:{going:!t.rsvp}}).then(n=>setCo(o=>o?{...o,talks:o.talks.map(x=>x.id===n.id?n:x)}:o));};
 if(error)return <View style={{gap:18}}><LifeTop zh={zh} title={zh?'企业':'Employer'} onBack={onBack}/><Surface><EmptyState icon="briefcase" title={zh?'暂时无法读取':'Unavailable'}/></Surface></View>;
 if(!co)return <View style={{gap:18}}><LifeTop zh={zh} title={zh?'企业':'Employer'} onBack={onBack}/><Skeleton height={240} radius={30}/></View>;
 return <View style={{gap:18}}>
  <View style={{borderRadius:30,overflow:'hidden',backgroundColor:'#142440',padding:18,gap:14}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><CircleButton icon="chevron-left" label={zh?'返回':'Back'} variant="overlay" onPress={onBack}/><View style={{paddingVertical:5,paddingHorizontal:10,borderRadius:99,backgroundColor:'#FFFFFF26'}}><Text style={{fontSize:12,fontWeight:'700',color:'#FFFFFF'}}>{co.sample?(zh?'推广 · 示例企业':'Sponsored · sample'):co.verified?(zh?'推广 · 已认证企业':'Sponsored · verified'):(zh?'推广':'Sponsored')}</Text></View></View>
   <View style={{width:56,height:56,borderRadius:16,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:26,fontWeight:'900',color:'#142440'}}>{co.name[0]}</Text></View>
   <View><Text style={{fontSize:26,fontWeight:'800',color:'#FFFFFF'}}>{co.name}</Text><Text style={{fontSize:13,color:'#FFFFFFB3'}}>{co.tagline}</Text></View>
   <View style={{flexDirection:'row',gap:10}}>{([[co.jobs.length,zh?'在招岗位':'Open roles'],[co.talks.reduce((s,t)=>s+t.going,0),zh?'宣讲会报名':'RSVPs']] as [number,string][]).map(([n,l])=><View key={l} style={{flex:1,alignItems:'center',paddingVertical:10,borderRadius:16,backgroundColor:'#FFFFFF1A'}}><Text style={{fontSize:20,fontWeight:'800',color:'#FFFFFF'}}>{n}</Text><Text style={{fontSize:11,color:'#FFFFFFB3'}}>{l}</Text></View>)}</View>
  </View>
  <Section title={zh?'在招岗位':'Open roles'}><ListGroup>{co.jobs.map(j=><ListRow key={j.id} icon="briefcase" tile="#24467F" title={j.title} subtitle={j.detail} value={zh?'投递':'Apply'} valueColor="#24467F" onPress={()=>apply(j)}/>)}</ListGroup></Section>
  {co.talks.length?<Section title={zh?'宣讲会':'Info session'}>{co.talks.map(t=>{const d=new Date(Date.parse(t.starts_at)+8*3600e3);return <Surface key={t.id}><View style={{flexDirection:'row',alignItems:'center',gap:14}}>
   <View style={{width:52,alignItems:'center',paddingVertical:6,borderRadius:14,backgroundColor:'#E5484D1F'}}><Text style={{fontSize:11,fontWeight:'700',color:'#E5484D'}}>{d.getUTCMonth()+1}{zh?' 月':''}</Text><Text style={{fontSize:22,fontWeight:'800',color:'#E5484D'}}>{d.getUTCDate()}</Text></View>
   <View style={{flex:1,gap:2}}><Text style={{fontSize:16,fontWeight:'700',color:c.text}}>{t.title}</Text><Text style={{fontSize:12,color:c.muted}}>{t.venue} · {zh?`${t.going} 人已报名`:`${t.going} going`}</Text></View>
   <Pressable accessibilityRole="button" onPress={()=>rsvp(t)} style={{paddingVertical:8,paddingHorizontal:14,borderRadius:99,backgroundColor:t.rsvp?'#2E9E5B1F':'#24467F'}}><Text style={{fontSize:13,fontWeight:'700',color:t.rsvp?'#2E9E5B':'#FFFFFF'}}>{t.rsvp?(zh?'已报名':'Going'):(zh?'报名':'RSVP')}</Text></Pressable>
  </View></Surface>;})}</Section>:null}
  {co.quote?<Section title={zh?'学长学姐说':'Alumni say'}><Surface style={{gap:8}}><Text style={{fontSize:15,lineHeight:23,color:c.text}}>“{co.quote}”</Text>{co.quote_by?<Text style={{fontSize:12,color:c.muted}}>— {co.quote_by}</Text>:null}</Surface></Section>:null}
  {co.sample?<Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'示例企业 · 认证企业入驻后才会出现真实岗位':'Sample employer · real roles appear once employers are verified'}</Text>:null}
 </View>;
}

export function ClassmateScreen({zh,onBack,author,onOpenPost}:Base&{author:{id:string;display_name:string};onOpenPost:(id:string)=>void}){
 const c=usePenColors();
 const [posts,setPosts]=useState<WallPost[]|null>(null),[following,setFollowing]=useState(false);
 useEffect(()=>{let live=true;session.request<{items:WallPost[]}>('/posts').then(r=>{if(live)setPosts(r.items.filter(p=>p.author.id===author.id));}).catch(()=>{if(live)setPosts([]);});return()=>{live=false;};},[author.id]);
 return <View style={{gap:18}}>
  <View style={{flexDirection:'row',justifyContent:'space-between'}}><CircleButton icon="chevron-left" label={zh?'返回':'Back'} onPress={onBack}/><CircleButton icon="ellipsis" label={zh?'更多':'More'} onPress={()=>Alert.alert(author.display_name,undefined,[{text:zh?'举报':'Report',style:'destructive'},{text:zh?'屏蔽':'Block',style:'destructive'},{text:zh?'取消':'Cancel',style:'cancel'}])}/></View>
  <View style={{alignItems:'center',gap:8}}>
   <GradientAvatar name={author.display_name} size={96}/>
   <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{fontSize:28,fontWeight:'800',color:c.text}}>{author.display_name}</Text><PenIcon name="badge-check" size={20} color="#24467F"/></View>
   <Text style={{fontSize:13,color:c.muted}}>{zh?'已验证的科大同学':'Verified HKUST member'}</Text>
  </View>
  <HeroActions><PrimaryButton label={zh?'打个招呼':'Say hi'} onPress={()=>posts?.[0]?onOpenPost(posts[0].id):Alert.alert(zh?'打个招呼':'Say hi',zh?'在 TA 的帖子下留言就能认识 TA。':'Reply to one of their posts.')}/><PrimaryButton tone="soft" label={following?(zh?'已关注':'Following'):(zh?'关注':'Follow')} onPress={()=>{feel.select();setFollowing(!following);}}/></HeroActions>
  <Section title={zh?`${author.display_name} 的帖子`:`Posts by ${author.display_name}`}>
   {posts===null?<Skeleton height={160} radius={28}/>:posts.length?posts.map(p=><WallPostCard key={p.id} post={p} zh={zh} onOpen={()=>onOpenPost(p.id)}/>):<Surface><Text style={{fontSize:15,color:c.muted}}>{zh?'最近没有发帖。':'No recent posts.'}</Text></Surface>}
  </Section>
  <Text style={{textAlign:'center',fontSize:12,color:c.muted}}>{zh?'打招呼不会公开你的课表；对方可以随时屏蔽。':'Saying hi never shares your timetable.'}</Text>
 </View>;
}
export {Linking};
