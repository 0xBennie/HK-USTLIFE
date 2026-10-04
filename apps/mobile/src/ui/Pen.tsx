// Native counterparts of the reusable Pen components in design/campus-apple.pen.
import {GlassView,isLiquidGlassAvailable} from 'expo-glass-effect';
import {Blur,Canvas,Circle as SkCircle,Group,Rect as SkRect} from '@shopify/react-native-skia';
import {Easing,Keyframe,interpolate,useAnimatedStyle,useDerivedValue,useSharedValue,withRepeat,withSpring,withTiming,type SharedValue} from 'react-native-reanimated';
import {resetCompact,tabCompact} from './glass-motion';
import {NumberFlow,TimeFlow} from 'number-flow-react-native';
import {feel} from './feel';
// Sizes, radii, colors and icon names are read from the Pen boards; do not restyle here without updating Pen.
import {Children,createContext,isValidElement,useContext,useEffect,useState,type ReactNode} from 'react';
import {Pressable,ScrollView,Switch,Text,TextInput,View,useColorScheme,useWindowDimensions,type StyleProp,type TextInputProps,type ViewStyle} from 'react-native';
import Reanimated,{FadeIn,ZoomIn} from 'react-native-reanimated';
import Svg,{Circle,Defs,LinearGradient as SvgGradient,RadialGradient,Rect,Stop} from 'react-native-svg';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
// The package root also exports lucide's legacy names (Smile, Building2…) that Pen boards still use.
import * as icons from 'lucide-react-native';
import type {LucideIcon} from 'lucide-react-native';
import {palette,TAB_BAR_HEIGHT,type Colors} from '../theme';
import {useAppearance} from './Appearance';

// Pen boards name lucide icons in kebab case ("calendar-days"); lucide-react-native exports them in PascalCase.
export type PenIconName=string;
const missing=new Set<string>();
const glyph=(name:string):LucideIcon=>{const found=(icons as unknown as Record<string,LucideIcon>)[name.split('-').map(p=>p[0].toUpperCase()+p.slice(1)).join('')];if(!found&&__DEV__&&!missing.has(name)){missing.add(name);console.warn(`PenIcon: no lucide icon "${name}"`);}return found??icons.Circle;};
export function PenIcon({name,color,size=19,strokeWidth=2}:{name:PenIconName;color:string;size?:number;strokeWidth?:number}){const Glyph=glyph(name);return <Glyph color={color} size={size} strokeWidth={strokeWidth} accessible={false}/>;}
export const usePenColors=():Colors=>palette[useColorScheme()==='dark'?'dark':'light'];

const pressFeedback=(reduceMotion:boolean)=>({pressed}:{pressed:boolean})=>({opacity:pressed?0.6:1,transform:[{scale:pressed&&!reduceMotion?0.97:1}]});

/** Pen "Button plus" / overlay nav buttons: 38pt circle, 19pt glyph, 1pt/4 blur shadow. */
export function CircleButton({icon,label,onPress,variant='surface',color,disabled}:{icon:PenIconName;label:string;onPress:()=>void;variant?:'surface'|'overlay'|'fill'|'prominent';color?:string;disabled?:boolean}){
 const c=usePenColors(),{reduceMotion}=useAppearance(),dark=useColorScheme()==='dark';
 const prominent=variant==='prominent'&&!disabled,glass=variant!=='fill'&&liquidGlass;
 const background=glass?'transparent':prominent?NAVY:variant==='overlay'?(dark?'#1C1C1ED9':'#FFFFFFE6'):variant==='fill'?c.fill:c.surface;
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} hitSlop={4} onPress={()=>{feel.tap();onPress();}} style={state=>[{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:background,boxShadow:variant==='fill'||glass?undefined:'0 4px 14px #0000000F',opacity:disabled?0.4:1},pressFeedback(reduceMotion)(state)]}>{glass?prominent?<GlassView pointerEvents="none" isInteractive glassEffectStyle="regular" tintColor={NAVY} style={{position:'absolute',inset:0,borderRadius:22}}/>:<GlassFill radius={22}/>:null}<PenIcon name={icon} size={20} strokeWidth={2.2} color={prominent?"#FFFFFF":variant==="prominent"?c.muted:color??c.text}/></Pressable>;
}

/** Pen "Large title": 13/600 eyebrow, 34/700 title, optional circle action. */
export function LargeTitle({eyebrow,title,action}:{eyebrow?:string;title:string;action?:{icon:PenIconName;label:string;onPress:()=>void}}){
 const c=usePenColors();
 return <View style={{paddingHorizontal:4,paddingTop:4,gap:2}}>
  {eyebrow?<Text style={{fontSize:13,lineHeight:19,fontWeight:'600',color:c.muted}}>{eyebrow}</Text>:null}
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}><Text accessibilityRole="header" style={{flex:1,fontSize:34,lineHeight:41,fontWeight:'700',color:c.text}}>{title}</Text>{action?<CircleButton {...action}/>:null}</View>
 </View>;
}

/** Pen "Segmented control": fill track, radius 10, padding 2, 32pt segments. */
export function Segmented<T extends string>({value,options,onChange,label}:{value:T;options:{value:T;label:string}[];onChange:(value:T)=>void;label:string}){
 return <GlassChips fill items={options} value={value} onChange={onChange} label={label}/>;
}

/** Pen filter "Pill": 34pt, radius 99, padding 7/14, 14/600. Selected pill is inverted. */
export function FilterPill({label,selected,icon,onPress}:{label:string;selected?:boolean;icon?:PenIconName;onPress:()=>void}){
 // Pen V5 chip: glass capsule; selected = navy-tinted lens with navy label.
 const c=usePenColors(),{reduceMotion}=useAppearance(),dark=useColorScheme()==='dark',accent=dark?'#8FB0E8':NAVY;
 return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={()=>{feel.select();onPress();}} style={state=>[{minHeight:36,flexDirection:'row',alignItems:'center',gap:5,paddingVertical:8,paddingHorizontal:15,borderRadius:99,borderCurve:'continuous',backgroundColor:selected?(dark?'#FFFFFF1F':'#24467F17'):c.glass,borderWidth:1,borderColor:selected?(dark?'#FFFFFF26':'#24467F26'):'#FFFFFFCC',boxShadow:selected?undefined:'0 4px 12px #1B35660D'},pressFeedback(reduceMotion)(state)]}>
  {icon?<PenIcon name={icon} size={13} color={selected?accent:c.text}/>:null}<Text style={{fontSize:14,lineHeight:20,fontWeight:selected?'700':'500',color:selected?accent:c.text}}>{label}</Text>
 </Pressable>;
}
// Search fields draw their own placeholder: while a Chinese keyboard is active, iOS draws a native
// placeholder lower than the typed text (clipped in short fields).
export function PlainField({placeholder,fontSize,value,...rest}:Omit<TextInputProps,'style'|'placeholderTextColor'>&{placeholder:string;fontSize:number;value:string}){
 const c=usePenColors();
 return <View style={{flex:1,height:44,justifyContent:'center'}}>
  {!value?<View pointerEvents="none" style={{position:'absolute',left:0,right:0}}><Text numberOfLines={1} style={{fontSize,color:c.muted}}>{placeholder}</Text></View>:null}
  <TextInput {...rest} value={value} accessibilityHint={placeholder} style={{height:44,padding:0,fontSize,color:c.text}}/>
 </View>;
}
/** Pen V5 search field: glass capsule with search glyph. */
export function SearchField({value,onChangeText,placeholder,autoFocus}:{value:string;onChangeText:(v:string)=>void;placeholder:string;autoFocus?:boolean}){
 const c=usePenColors();
 return <GlassCapsule radius={24}><View style={{flexDirection:'row',alignItems:'center',gap:8,height:48,paddingHorizontal:16}}><PenIcon name="search" size={18} color={c.muted}/><PlainField accessibilityLabel={placeholder} autoFocus={autoFocus} value={value} onChangeText={onChangeText} placeholder={placeholder} returnKeyType="search" clearButtonMode="while-editing" fontSize={16}/></View></GlassCapsule>;
}
export function PillRow({children}:{children:ReactNode}){return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-16}} contentContainerStyle={{paddingHorizontal:16,gap:8}}>{children}</ScrollView>;}

/** Pen tag pill: 12/600 on 90% white (over images) or accent-soft (on page). */
export function Tag({label,tone='accent',overlay}:{label:string;tone?:'accent'|'green'|'orange'|'red'|'muted';overlay?:boolean}){
 const c=usePenColors();
 const color=tone==='accent'?c.accent:tone==='green'?c.green:tone==='orange'?c.orange:tone==='red'?c.red:c.muted;
 return <View style={{alignSelf:'flex-start',paddingVertical:overlay?5:4,paddingHorizontal:overlay?11:10,borderRadius:99,backgroundColor:overlay?'#FFFFFFE6':color+'1F'}}><Text style={{fontSize:12,lineHeight:17,fontWeight:'600',color:overlay?'#1C1C1E':color}}>{label}</Text></View>;
}

/** Pen "List" group: optional 13pt section header, white radius-14 container. */
export function ListGroup({header,children,style}:{header?:string;children:ReactNode;style?:StyleProp<ViewStyle>}){
 const c=usePenColors();
 const rows=Children.toArray(children).filter(isValidElement);
 return <View style={[{gap:7},style]}>
  {header?<Text style={{paddingHorizontal:16,fontSize:13,lineHeight:19,color:c.muted}}>{header}</Text>:null}
  <View style={{backgroundColor:c.surface,borderRadius:28,borderCurve:'continuous',overflow:'hidden',borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 10px 30px #0000000F'}}>{rows.map((row,i)=><RowPosition.Provider key={i} value={i<rows.length-1}>{row}</RowPosition.Provider>)}</View>
 </View>;
}
const RowPosition=createContext(false);

/** Pen "Component / List row": 30pt colored icon tile, 17pt title, 13pt subtitle, optional value and chevron, inset hairline. */
export function ListRow({icon,tile,title,subtitle,value,valueColor,chevron,titleColor,onPress,disabled,accessory}:{icon?:PenIconName;tile?:string;title:string;subtitle?:string;value?:string;valueColor?:string;chevron?:boolean;titleColor?:string;onPress?:()=>void;disabled?:boolean;accessory?:ReactNode}){
 const c=usePenColors(),separated=useContext(RowPosition);
 const body=<View style={{flexDirection:'row',alignItems:'center',gap:14,paddingLeft:18}}>
  {icon?<IconTile icon={icon} color={tile??c.gray} size={subtitle?40:32}/>:null}
  <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:subtitle?72:52,paddingVertical:12,paddingRight:18,borderBottomWidth:separated?0.5:0,borderBottomColor:c.border}}>
   <View style={{flex:1,gap:3}}><Text style={{fontSize:17,lineHeight:25,color:titleColor??c.text}}>{title}</Text>{subtitle?<Text style={{fontSize:13,lineHeight:19,color:c.muted}}>{subtitle}</Text>:null}</View>
   {value?<Text style={{fontSize:15,lineHeight:22,fontWeight:valueColor?'700':'400',color:valueColor??c.muted}}>{value}</Text>:null}
   {accessory}
   {chevron?<PenIcon name="chevron-right" size={16} color={c.tertiary}/>:null}
  </View>
 </View>;
 return onPress?<Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>({opacity:disabled?0.4:pressed?0.6:1})}>{body}</Pressable>:body;
}

/** Overlapping 24pt avatar dots (Pen "Avatars": -8 gap, 2pt surface ring). */
const avatarColors=['#C8A875','#4F6F8C','#6B6F8E','#2E9E5B','#7F8DA8'];
export function AvatarDots({count}:{count:number}){
 const c=usePenColors(),n=Math.min(count,3);
 if(!n)return null;
 return <View style={{flexDirection:'row'}}>{Array.from({length:n},(_,i)=><View key={i} style={{width:24,height:24,borderRadius:12,marginLeft:i?-8:0,backgroundColor:avatarColors[i],borderWidth:2,borderColor:c.surface}}/>)}</View>;
}
export function InitialAvatar({name,size=28}:{name:string;size?:number}){
 const color=avatarColors[[...name].reduce((s,ch)=>s+ch.charCodeAt(0),0)%avatarColors.length];
 return <View style={{width:size,height:size,borderRadius:size/2,backgroundColor:color,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:size*0.46,fontWeight:'700',color:'#FFFFFF'}}>{[...name.trim()][0]?.toUpperCase()??'?'}</Text></View>;
}

/** Pen "Primary action": 50pt pill, 17/600. */
export function PrimaryButton({label,onPress,disabled,tone='accent',icon,iconAfter}:{label:string;onPress:()=>void;disabled?:boolean;tone?:'accent'|'soft';icon?:PenIconName;iconAfter?:boolean}){
 // Pen V5: accent = tinted (prominent) Liquid Glass in HKUST navy; soft = regular glass. One accent per screen.
 const c=usePenColors(),{reduceMotion,reduceTransparency}=useAppearance(),prominent=tone!=='soft'&&!disabled;
 const glass=liquidGlass&&!reduceTransparency,fg=prominent?'#FFFFFF':disabled?c.muted:c.text;
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={()=>{feel.tap();onPress();}} style={state=>[{flex:1,minHeight:54,borderRadius:99,borderCurve:'continuous',flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',paddingHorizontal:22,backgroundColor:glass?'transparent':prominent?NAVY:c.glass,borderWidth:glass?0:1,borderColor:prominent?'#FFFFFF26':'#FFFFFFCC',boxShadow:glass?undefined:prominent?'0 10px 24px #1B356645':'0 6px 18px #1B35661A',opacity:disabled?0.4:1},pressFeedback(reduceMotion)(state)]}>
  {glass?<GlassView pointerEvents="none" isInteractive glassEffectStyle="regular" tintColor={prominent?NAVY:undefined} style={{position:'absolute',inset:0,borderRadius:99}}/>:null}
  {icon&&!iconAfter?<PenIcon name={icon} size={18} strokeWidth={2.2} color={fg}/>:null}<Text style={{fontSize:17,lineHeight:23,fontWeight:'600',color:fg}}>{label}</Text>{icon&&iconAfter?<PenIcon name={icon} size={18} strokeWidth={2.2} color={fg}/>:null}</Pressable>;
}
export function TextAction({label,onPress,color,disabled}:{label:string;onPress:()=>void;color?:string;disabled?:boolean}){
 const c=usePenColors();
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed})=>({minHeight:36,alignItems:'center',justifyContent:'center',opacity:disabled?0.4:pressed?0.6:1})}><Text style={{fontSize:16,lineHeight:23,fontWeight:'600',color:color??c.muted}}>{label}</Text></Pressable>;
}

/** Pen "Bottom bar": glass, 0.5pt top line, blur 30, padding 12/16/(safe area). Replaces the tab bar on pushed pages. */
export function BottomBar({children}:{children:ReactNode}){
 // Pen V5 "Floating input bar": no full-width slab; children are floating glass capsules over content.
 const {reduceMotion}=useAppearance(),insets=useSafeAreaInsets();
 const c=usePenColors();
 return <Reanimated.View entering={reduceMotion?undefined:materialize} style={{position:'absolute',left:0,right:0,bottom:0,paddingTop:22,paddingHorizontal:16,paddingBottom:Math.max(insets.bottom-6,12),gap:8}}>
  {/* Scroll-edge effect: content fades out beneath the floating glass controls so they stay legible. */}
  <Svg pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 1 1" style={{position:'absolute',top:0,left:0,right:0,bottom:0}}><Defs><SvgGradient id="edge" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.background} stopOpacity={0}/><Stop offset="0.45" stopColor={c.background} stopOpacity={0.85}/><Stop offset="1" stopColor={c.background} stopOpacity={0.97}/></SvgGradient></Defs><Rect x="0" y="0" width="1" height="1" fill="url(#edge)"/></Svg>
  {children}
 </Reanimated.View>;
}
/** Floating glass capsule (input fields, grouped actions). */
export function GlassCapsule({children,style,radius=24}:{children:ReactNode;style?:StyleProp<ViewStyle>;radius?:number}){
 const c=usePenColors(),{reduceTransparency}=useAppearance(),glass=liquidGlass&&!reduceTransparency;
 return <View style={[{borderRadius:radius,borderCurve:'continuous',overflow:'hidden',backgroundColor:glass?'transparent':reduceTransparency?c.surface:c.glass,borderWidth:glass?0:1,borderColor:'#FFFFFFCC',boxShadow:glass?undefined:'0 8px 24px #1B35661F'},style]}><GlassFill radius={radius}/>{children}</View>;
}

/** Pen "Component / Tab bar": 361×64 floating glass capsule, radius 34, selected tab on fill with accent. */
export function FloatingTabBar({tabs,selected,onSelect,badges}:{tabs:{label:string;icon:PenIconName}[];selected:number;onSelect:(index:number)=>void;badges?:(number|undefined)[]}){
 // Pen "V5 / Glass tab bar": Liquid Glass capsule, a lens springs to the selected tab, compacts while scrolling down.
 const c=usePenColors(),dark=useColorScheme()==='dark',{reduceTransparency,reduceMotion}=useAppearance(),insets=useSafeAreaInsets();
 const [width,setWidth]=useState(0),item=width?(width-10)/tabs.length:0;
 const x=useSharedValue(-1);
 useEffect(()=>{if(!item)return;const to=5+selected*item;x.value=reduceMotion||x.value<0?to:withSpring(to,{damping:19,stiffness:210,mass:0.9});},[selected,item,reduceMotion]);
 const lens=useAnimatedStyle(()=>({opacity:x.value<0?0:1,transform:[{translateX:Math.max(0,x.value)}]}));
 const cfg={duration:reduceMotion?0:260};
 const bar=useAnimatedStyle(()=>({height:withTiming(tabCompact.value?52:TAB_BAR_HEIGHT+4,cfg),marginHorizontal:withTiming(tabCompact.value?36:0,cfg)}));
 const labels=useAnimatedStyle(()=>({opacity:withTiming(tabCompact.value?0:1,cfg),height:withTiming(tabCompact.value?0:14,cfg)}));
 const glass=liquidGlass&&!reduceTransparency,accent=dark?'#8FB0E8':NAVY;
 return <View pointerEvents="box-none" style={{position:'absolute',left:14,right:14,bottom:Math.max(10,insets.bottom-16)}}>
  <Reanimated.View accessibilityRole="tablist" onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={[{flexDirection:'row',padding:5,borderRadius:36,borderCurve:'continuous',overflow:'hidden',backgroundColor:glass?'transparent':reduceTransparency?c.surface:c.glass,borderWidth:glass?0:1,borderColor:dark?'#FFFFFF1F':'#FFFFFFCC',boxShadow:glass?undefined:'0 10px 30px #1B35661F'},bar]}>
   <GlassFill radius={36}/>
   {item?<Reanimated.View pointerEvents="none" style={[{position:'absolute',left:0,top:5,bottom:5,width:item,borderRadius:31,backgroundColor:dark?'#FFFFFF1F':'#24467F14',borderWidth:1,borderColor:dark?'#FFFFFF26':'#FFFFFFD9'},lens]}/>:null}
   {tabs.map((tab,index)=>{const on=index===selected,badge=badges?.[index];return <Pressable key={tab.label} accessibilityRole="tab" accessibilityLabel={badge?`${tab.label}, ${badge}`:tab.label} accessibilityState={{selected:on}} onPress={()=>{if(index!==selected)feel.select();resetCompact();onSelect(index);}} style={{flex:1,gap:3,alignItems:'center',justifyContent:'center'}}>
    <View><PenIcon name={tab.icon} size={22} strokeWidth={on?2.5:2.1} color={on?accent:c.text}/>{badge?<View style={{position:'absolute',top:-4,right:-9,minWidth:17,height:17,borderRadius:9,paddingHorizontal:4,backgroundColor:c.red,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:c.surface}}><Text style={{fontSize:10,fontWeight:'700',color:'#FFFFFF'}}>{badge>99?'99+':badge}</Text></View>:null}</View>
    <Reanimated.Text style={[{fontSize:10,lineHeight:14,fontWeight:on?'700':'600',color:on?accent:c.text},labels]}>{tab.label}</Reanimated.Text>
   </Pressable>;})}
  </Reanimated.View>
 </View>;
}
/** Pen "V5 / Glass chip row": glass capsule of options; a lens slides to the selection. Scrolls when options overflow. */
export function GlassChips<T extends string>({items,value,onChange,label,fill}:{items:{value:T;label:string;count?:number}[];value:T;onChange:(v:T)=>void;label:string;fill?:boolean}){
 const c=usePenColors(),dark=useColorScheme()==='dark',{reduceMotion}=useAppearance(),accent=dark?'#8FB0E8':NAVY;
 const [layouts,setLayouts]=useState<Record<string,{x:number;w:number}>>({});
 const x=useSharedValue(-1),w=useSharedValue(0);
 useEffect(()=>{const l=layouts[value];if(!l)return;if(reduceMotion||x.value<0){x.value=l.x;w.value=l.w;}else{x.value=withSpring(l.x,{damping:19,stiffness:210});w.value=withSpring(l.w,{damping:19,stiffness:210});}},[value,layouts,reduceMotion]);
 const lens=useAnimatedStyle(()=>({opacity:x.value<0?0:1,width:w.value,transform:[{translateX:Math.max(0,x.value)}]}));
 const chips=<>
  <Reanimated.View pointerEvents="none" style={[{position:'absolute',left:0,top:4,bottom:4,borderRadius:18,backgroundColor:dark?'#FFFFFF1F':'#24467F14',borderWidth:1,borderColor:dark?'#FFFFFF26':'#FFFFFFD9'},lens]}/>
  {items.map(it=>{const on=it.value===value;return <Pressable key={it.value} accessibilityRole="tab" accessibilityState={{selected:on}} onLayout={e=>{const {x:lx,width}=e.nativeEvent.layout;setLayouts(p=>p[it.value]?.x===lx&&p[it.value]?.w===width?p:{...p,[it.value]:{x:lx,w:width}});}} onPress={()=>{if(!on){feel.select();onChange(it.value);}}} style={{flex:fill?1:undefined,height:36,paddingHorizontal:16,alignItems:'center',justifyContent:'center'}}><Text numberOfLines={1} style={{fontSize:15,fontWeight:on?'700':'500',color:on?accent:c.text}}>{it.label}{it.count!=null?<Text style={{fontSize:13,fontWeight:'500',color:on?accent:c.muted,fontVariant:['tabular-nums']}}>{` ${it.count}`}</Text>:null}</Text></Pressable>;})}
 </>;
 return <GlassCapsule radius={22} style={{alignSelf:fill?'stretch':'flex-start',maxWidth:'100%'}}>
  <View accessibilityRole="tablist" accessibilityLabel={label}>
   {fill?<View style={{flexDirection:'row',padding:4,height:44}}>{chips}</View>:<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,height:44}} contentContainerStyle={{padding:4,alignItems:'stretch'}}>{chips}</ScrollView>}
  </View>
 </GlassCapsule>;
}
/** Bottom inset scroll content needs so the last item clears the floating tab bar or bottom bar. */
export function useBottomClearance(bar:'tab'|'bottom'){const insets=useSafeAreaInsets();return bar==='tab'?TAB_BAR_HEIGHT+Math.max(12,insets.bottom-14)+24:118+insets.bottom;}

/** Pushed-page header (Pen "Page header"): circle back button, optional trailing actions, then a large title. */
export function PageHeader({title,eyebrow,subtitle,onBack,backLabel,right}:{title:string;eyebrow?:string;subtitle?:string;onBack?:()=>void;backLabel?:string;right?:ReactNode}){
 const c=usePenColors();
 return <View style={{gap:14}}>
  {onBack||right?<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
   {onBack?<CircleButton icon="chevron-left" label={backLabel??'Back'} onPress={onBack}/>:<View/>}
   {right?<View style={{flexDirection:'row',gap:10}}>{right}</View>:null}
  </View>:null}
  <View style={{paddingHorizontal:4,gap:4}}>
   {eyebrow?<Text style={{fontSize:13,lineHeight:19,fontWeight:'600',color:c.muted}}>{eyebrow}</Text>:null}
   <Text accessibilityRole="header" style={{fontSize:30,lineHeight:37,fontWeight:'700',color:c.text,letterSpacing:-0.3}}>{title}</Text>
   {subtitle?<Text style={{fontSize:15,lineHeight:22,color:c.muted}}>{subtitle}</Text>:null}
  </View>
 </View>;
}
/** Section with a 20/700 heading and optional trailing link. */
export function Section({title,link,onLink,children,gap=10}:{title?:string;link?:string;onLink?:()=>void;children:ReactNode;gap?:number}){
 const c=usePenColors();
 return <View style={{gap}}>
  {title?<View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:4}}><Text accessibilityRole="header" style={{flex:1,fontSize:20,lineHeight:27,fontWeight:'700',color:c.text}}>{title}</Text>{link?<Pressable hitSlop={8} onPress={onLink} accessibilityRole="button" style={{flexDirection:'row',alignItems:'center',gap:2}}><Text style={{fontSize:15,fontWeight:'500',color:c.muted}}>{link}</Text><PenIcon name="chevron-right" size={15} color={c.muted}/></Pressable>:null}</View>:null}
  {children}
 </View>;
}
/** Plain surface card (radius 18). Pressable when onPress is given. */
export function Surface({children,onPress,style,padding=16,label}:{children:ReactNode;onPress?:()=>void;style?:StyleProp<ViewStyle>;padding?:number;label?:string}){
 const c=usePenColors(),{reduceMotion}=useAppearance();
 const base={backgroundColor:c.surface,borderRadius:28,borderCurve:'continuous' as const,padding:padding+2,borderWidth:1,borderColor:c.glassBorder,boxShadow:'0 10px 30px #0000000F'};
 return onPress?<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={state=>[base,style,pressFeedback(reduceMotion)(state)]}>{children}</Pressable>:<View style={[base,style]}>{children}</View>;
}
/** Colored icon tile used in rows and cards. */
/** Round icon tile: pale tint of the colour with the glyph in full colour (Pen V4 Row). */
export function IconTile({icon,color,size=30}:{icon:PenIconName;color:string;size?:number}){
 const dark=useColorScheme()==='dark';
 return <View style={{width:size,height:size,borderRadius:size/2,backgroundColor:color.slice(0,7)+(dark?'38':'1F'),alignItems:'center',justifyContent:'center'}}><PenIcon name={icon} size={size*0.5} strokeWidth={2.2} color={dark?'#FFFFFFE6':color.slice(0,7)}/></View>;
}
/** Inline notice: success / warning / error with an optional action. */
export function Notice({tone='info',text,action,onAction}:{tone?:'info'|'success'|'warning'|'error';text:string;action?:string;onAction?:()=>void}){
 const c=usePenColors();
 const col=tone==='success'?c.green:tone==='warning'?c.orange:tone==='error'?c.danger:c.accent;
 const icon=tone==='success'?'circle-check':tone==='warning'?'triangle-alert':tone==='error'?'circle-alert':'info';
 return <View accessibilityRole={tone==='error'||tone==='warning'?'alert':undefined} accessibilityLiveRegion="polite" style={{flexDirection:'row',alignItems:'center',gap:10,padding:12,paddingHorizontal:14,borderRadius:14,backgroundColor:col+'1A'}}>
  <PenIcon name={icon} size={18} color={col}/>
  <Text style={{flex:1,fontSize:14,lineHeight:20,color:c.text}}>{text}</Text>
  {action?<Pressable hitSlop={8} onPress={onAction} accessibilityRole="button"><Text style={{fontSize:14,fontWeight:'600',color:col}}>{action}</Text></Pressable>:null}
 </View>;
}
export function EmptyState({icon,title,body,action,onAction}:{icon:PenIconName;title:string;body?:string;action?:string;onAction?:()=>void}){
 const c=usePenColors();
 return <View style={{alignItems:'center',gap:8,paddingVertical:28,paddingHorizontal:20}}>
  <View style={{width:64,height:64,borderRadius:32,backgroundColor:c.fill,alignItems:'center',justifyContent:'center',marginBottom:4}}><PenIcon name={icon} size={30} color={c.muted}/></View>
  <Text style={{fontSize:19,lineHeight:27,fontWeight:'700',color:c.text,textAlign:'center'}}>{title}</Text>
  {body?<Text style={{fontSize:15,lineHeight:22,color:c.muted,textAlign:'center'}}>{body}</Text>:null}
  {action?<View style={{flexDirection:'row',marginTop:8}}><PrimaryButton tone="soft" label={action} onPress={onAction??(()=>{})}/></View>:null}
 </View>;
}
/** Skeleton block for loading states. */
export function Skeleton({height=72,radius=18}:{height?:number;radius?:number}){
 const c=usePenColors();
 return <View accessibilityLabel="Loading" style={{height,borderRadius:radius,backgroundColor:c.fill}}/>;
}
/** List entrance: each child rises 8pt and fades in, 30ms apart (motion M3). */
/** Content appears with a short opacity fade only: no slide, no stagger, so filtering never moves cards over other UI. */
export function Stagger({children}:{children:ReactNode;index?:number}){
 const {reduceMotion}=useAppearance();
 if(reduceMotion)return <>{children}</>;
 return <Reanimated.View entering={FadeIn.duration(140)}>{children}</Reanimated.View>;
}
/** Animated completion circle (motion M4). 44pt hit area around a 24pt ring. */
export function CheckCircle({checked,onPress,color,label,disabled}:{checked:boolean;onPress:()=>void;color?:string;label:string;disabled?:boolean}){
 const c=usePenColors(),{reduceMotion}=useAppearance(),ring=color??c.tertiary;
 return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked,disabled}} disabled={disabled} hitSlop={10} onPress={()=>{if(!checked)feel.success();else feel.tap();onPress();}} style={({pressed})=>({width:30,height:30,alignItems:'center',justifyContent:'center',opacity:disabled?0.4:pressed?0.6:1})}>
  <Reanimated.View key={String(checked)} entering={reduceMotion?undefined:ZoomIn.springify().damping(14)} style={{width:24,height:24,borderRadius:12,borderWidth:checked?0:1.8,borderColor:ring,backgroundColor:checked?c.green:'transparent',alignItems:'center',justifyContent:'center'}}>
   {checked?<PenIcon name="check" size={15} strokeWidth={3} color="#FFFFFF"/>:null}
  </Reanimated.View>
 </Pressable>;
}
/** Grouped form (Pen V2 forms): white group, label above value, inset separators. */
export function FormGroup({header,footer,children}:{header?:string;footer?:string;children:ReactNode}){
 const c=usePenColors();
 const rows=Children.toArray(children).filter(isValidElement);
 return <View style={{gap:7}}>
  {header?<Text style={{paddingHorizontal:16,fontSize:13,lineHeight:19,color:c.muted}}>{header}</Text>:null}
  <View style={{backgroundColor:c.surface,borderRadius:20,borderCurve:'continuous',overflow:'hidden'}}>{rows.map((row,i)=><View key={i} style={{borderBottomWidth:i<rows.length-1?0.5:0,borderBottomColor:c.border,marginLeft:16}}><View style={{marginLeft:-16}}>{row}</View></View>)}</View>
  {footer?<Text style={{paddingHorizontal:16,fontSize:12,lineHeight:17,color:c.muted}}>{footer}</Text>:null}
 </View>;
}
export function FormField({label,value,onChangeText,placeholder,multiline,editable=true,keyboardType,maxLength,autoCapitalize='sentences'}:{label:string;value:string;onChangeText:(v:string)=>void;placeholder?:string;multiline?:boolean;editable?:boolean;keyboardType?:TextInputProps['keyboardType'];maxLength?:number;autoCapitalize?:TextInputProps['autoCapitalize']}){
 const c=usePenColors();
 return <View style={{paddingHorizontal:16,paddingTop:10,paddingBottom:multiline?12:10,gap:2}}>
  <Text style={{fontSize:12,lineHeight:16,fontWeight:'600',color:c.muted}}>{label}</Text>
  <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.tertiary} editable={editable} multiline={multiline} keyboardType={keyboardType} maxLength={maxLength} autoCapitalize={autoCapitalize} selectionColor={c.accent} style={{fontSize:17,lineHeight:23,color:editable?c.text:c.muted,paddingVertical:4,minHeight:multiline?88:30,textAlignVertical:multiline?'top':'center'}}/>
 </View>;
}
/** Tappable form row: label left, value right, chevron. */
export function FormRow({label,value,onPress,icon,tile,valueColor,accessory}:{label:string;value?:string;onPress?:()=>void;icon?:PenIconName;tile?:string;valueColor?:string;accessory?:ReactNode}){
 const c=usePenColors();
 const body=<View style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:50,paddingHorizontal:16,paddingVertical:10}}>
  {icon?<IconTile icon={icon} color={tile??c.gray} size={28}/>:null}
  <Text style={{flex:1,fontSize:17,color:c.text}}>{label}</Text>
  {value?<Text numberOfLines={1} style={{maxWidth:'60%',fontSize:16,color:valueColor??c.muted}}>{value}</Text>:null}
  {accessory}
  {onPress?<PenIcon name="chevron-right" size={16} color={c.tertiary}/>:null}
 </View>;
 return onPress?<Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({opacity:pressed?0.6:1})}>{body}</Pressable>:body;
}
export function SwitchRow({label,detail,value,onValueChange,disabled}:{label:string;detail?:string;value:boolean;onValueChange:(v:boolean)=>void;disabled?:boolean}){
 const c=usePenColors();
 return <View style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:54,paddingHorizontal:16,paddingVertical:10}}>
  <View style={{flex:1,gap:2}}><Text style={{fontSize:17,color:c.text}}>{label}</Text>{detail?<Text style={{fontSize:13,lineHeight:18,color:c.muted}}>{detail}</Text>:null}</View>
  <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{true:c.green}}/>
 </View>;
}
/** Horizontal choice chips inside a form row. */
export function ChoiceRow<T extends string|number|null>({label,options,value,onChange,disabled}:{label?:string;options:{value:T;label:string}[];value:T;onChange:(v:T)=>void;disabled?:boolean}){
 const c=usePenColors();
 return <View style={{paddingVertical:10,gap:8}}>
  {label?<Text style={{paddingHorizontal:16,fontSize:12,fontWeight:'600',color:c.muted}}>{label}</Text>:null}
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,gap:8}}>
   {options.map(o=>{const on=o.value===value;return <Pressable key={String(o.value)} disabled={disabled} accessibilityRole="button" accessibilityState={{selected:on,disabled}} onPress={()=>onChange(o.value)} style={({pressed})=>({paddingVertical:7,paddingHorizontal:13,borderRadius:99,backgroundColor:on?c.accent:c.fill,opacity:disabled?0.5:pressed?0.7:1})}><Text style={{fontSize:14,fontWeight:'600',color:on?c.onAccent:c.text}}>{o.label}</Text></Pressable>;})}
  </ScrollView>
 </View>;
}

/** V3 top bar (Plasma): gradient avatar on the left, a round action on the right, optional small centred title. */
export function TopBar({name,onAvatar,title,right}:{name?:string;onAvatar?:()=>void;title?:string;right?:ReactNode}){
 const c=usePenColors();
 const initial=[...(name??'').trim()][0]?.toUpperCase()??'';
 return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:48}}>
  {onAvatar?<Pressable accessibilityRole="button" accessibilityLabel={name??'Me'} onPress={onAvatar} hitSlop={6}><GradientCircle size={48}>{initial?<Text style={{fontSize:20,fontWeight:'600',color:'#FFFFFF'}}>{initial}</Text>:<PenIcon name="user-round" size={22} color="#FFFFFF"/>}</GradientCircle></Pressable>:<View style={{width:48}}/>}
  {title?<Text numberOfLines={1} style={{flex:1,textAlign:'center',fontSize:17,fontWeight:'600',color:c.text}}>{title}</Text>:null}
  {right?<View style={{flexDirection:'row',gap:10}}>{right}</View>:<View style={{width:48}}/>}
 </View>;
}
export function GradientCircle({size,children,colors=['#34599A','#1B3566']}:{size:number;children?:ReactNode;colors?:[string,string]}){
 return <View style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',alignItems:'center',justifyContent:'center'}}>
  <Svg style={{position:'absolute',width:'100%',height:'100%'}}><Defs><SvgGradient id={`g${colors.join('')}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={colors[0]}/><Stop offset="1" stopColor={colors[1]}/></SvgGradient></Defs><Rect width="100%" height="100%" fill={`url(#g${colors.join('')})`}/></Svg>
  {children}
 </View>;
}
const heroDigits={fontSize:64,lineHeight:72,fontWeight:'700' as const,letterSpacing:-2,fontFamily:'ui-rounded'};
/** V3 hero (Plasma): small grey label, a very large centred value, and an optional grey chip underneath. */
export function Hero({label,value,unit,chip,chipIcon,chipColor,valueColor}:{label:string;value:string;unit?:string;chip?:string;chipIcon?:PenIconName;chipColor?:string;valueColor?:string}){
 const c=usePenColors();
 return <View style={{alignItems:'center',gap:10,paddingTop:8,paddingBottom:4}}>
  <Text style={{fontSize:20,fontWeight:'500',color:c.muted}}>{label}</Text>
  <View style={{flexDirection:'row',alignItems:'flex-end',gap:6}}>
   {/^\d{1,6}$/.test(value)?<NumberFlow value={Number(value)} style={{...heroDigits,color:valueColor??c.text}}/>:/^\d{1,2}:\d{2}$/.test(value)?<TimeFlow hours={Number(value.split(':')[0])} minutes={Number(value.split(':')[1])} padHours style={{...heroDigits,color:valueColor??c.text}}/>:<Text adjustsFontSizeToFit numberOfLines={1} style={{...heroDigits,color:valueColor??c.text,fontVariant:['tabular-nums']}}>{value}</Text>}
   {unit?<Text style={{paddingBottom:12,fontSize:22,fontWeight:'600',color:c.text}}>{unit}</Text>:null}
  </View>
  {chip?<View style={{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:9,paddingHorizontal:16,borderRadius:99,backgroundColor:c.fill}}>{chipIcon?<PenIcon name={chipIcon} size={17} strokeWidth={2.4} color={chipColor??c.muted}/>:null}<Text style={{fontSize:16,fontWeight:'500',color:c.muted}}>{chip}</Text></View>:null}
 </View>;
}
export function HeroActions({children}:{children:ReactNode}){return <View style={{flexDirection:'row',gap:14,paddingTop:6}}>{children}</View>;}
/** Plasma "View all >" footer inside a list card. */
export function ViewAll({label,onPress}:{label:string;onPress:()=>void}){
 const c=usePenColors();
 return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:16,opacity:pressed?0.6:1})}><Text style={{fontSize:17,fontWeight:'500',color:c.muted}}>{label}</Text><PenIcon name="chevron-right" size={18} strokeWidth={2.4} color={c.muted}/></Pressable>;
}

/** V4 aurora backdrop: four misty colour fields, Skia-blurred, drifting slowly (static when Reduce Motion is on). */
export function Aurora(){
 const dark=useColorScheme()==='dark',{reduceMotion}=useAppearance(),{width,height}=useWindowDimensions();
 const blobs:[number,number,number,string][]=dark?[[0.18,0.06,0.62,'#15213A'],[0.85,0.14,0.55,'#121B2C'],[0.1,0.62,0.55,'#0E1524'],[0.9,0.9,0.6,'#101828']]:[[0.18,0.06,0.62,'#D3DFF2'],[0.85,0.14,0.55,'#DCE6F3'],[0.1,0.62,0.55,'#E2E8F3'],[0.9,0.9,0.6,'#EFE7DA']];
 const t=useSharedValue(0);
 useEffect(()=>{if(reduceMotion){t.value=0;return;}t.value=withRepeat(withTiming(1,{duration:24000,easing:Easing.inOut(Easing.sin)}),-1,true);},[reduceMotion]);
 return <Canvas pointerEvents="none" style={{position:'absolute',top:0,left:0,width,height}}>
  <SkRect x={0} y={0} width={width} height={height} color={dark?'#05070B':'#F2F4F7'}/>
  <Group>
   <Blur blur={70}/>
   {blobs.map(([x,y,r,col],i)=><AuroraBlob key={i} t={t} i={i} cx={x*width} cy={y*height} r={r*width*0.8} color={col}/>)}
  </Group>
 </Canvas>;
}
function AuroraBlob({t,i,cx,cy,r,color}:{t:SharedValue<number>;i:number;cx:number;cy:number;r:number;color:string}){
 const dx=(i%2?-1:1)*40,dy=(i<2?1:-1)*30;
 const x=useDerivedValue(()=>cx+dx*t.value),y=useDerivedValue(()=>cy+dy*t.value);
 return <SkCircle cx={x} cy={y} r={r} color={color} opacity={0.9}/>;
}

const NAVY='#24467F';
const materialize=new Keyframe({0:{opacity:0,transform:[{scale:0.96}]},100:{opacity:1,transform:[{scale:1}]}}).duration(200);
const liquidGlass=(()=>{try{return isLiquidGlassAvailable();}catch{return false;}})();
/** Navigation-layer material: real iOS Liquid Glass when available, frosted blur otherwise. */
export function GlassFill({radius,tint,interactive}:{radius?:number;tint?:string;interactive?:boolean}){
 const dark=useColorScheme()==='dark',{reduceTransparency}=useAppearance();
 if(reduceTransparency)return null;
 if(liquidGlass)return <GlassView pointerEvents={interactive?'auto':'none'} isInteractive={interactive} glassEffectStyle="regular" tintColor={tint} style={{position:'absolute',inset:0,borderRadius:radius}}/>;
 return <BlurView pointerEvents="none" intensity={70} tint={dark?'dark':'light'} style={{position:'absolute',inset:0,borderRadius:radius,overflow:'hidden'}}/>;
}
export const hasLiquidGlass=liquidGlass;

/** Step progress ring (campus affairs, guides). */
export function ProgressRing({done,total}:{done:number;total:number}){
 const c=usePenColors(),pct=total?done/total:0,size=46,stroke=5,r=(size-stroke)/2,circ=2*Math.PI*r;
 return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <Svg width={size} height={size} style={{position:'absolute',transform:[{rotate:'-90deg'}]}}><Circle cx={size/2} cy={size/2} r={r} stroke={c.fill} strokeWidth={stroke} fill="none"/><Circle cx={size/2} cy={size/2} r={r} stroke={pct>=1?c.green:c.orange} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ*pct} ${circ}`}/></Svg>
  <Text style={{fontSize:12,fontWeight:'700',color:c.text}}>{done}/{total}</Text>
 </View>;
}
