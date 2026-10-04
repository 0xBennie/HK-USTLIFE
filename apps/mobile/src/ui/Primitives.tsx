import {useEffect,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {Animated,Pressable,Text,View,useColorScheme,type StyleProp,type ViewStyle} from 'react-native';
import {Button as HeroButton} from 'heroui-native/button';
import {Card as HeroCard} from 'heroui-native/card';
import {Input as HeroInput} from 'heroui-native/input';
import {palette,styles} from '../theme';
import {useAppearance} from './Appearance';
import {Icon} from './Icon';
import type {IconName} from '../../../../src/design/icons';
const useColors=()=>palette[useColorScheme()==='dark'?'dark':'light'];
type ButtonProps=Omit<ComponentProps<typeof HeroButton>,'style'|'feedbackVariant'|'animation'> & {style?:StyleProp<ViewStyle>};
export function Button({children,variant='primary',style,...props}:ButtonProps) {
 const c=useColors(),dark=useColorScheme()==='dark',{reduceMotion}=useAppearance();
 const primary=variant==='primary',danger=variant==='danger'||variant==='danger-soft',ghost=variant==='ghost';
 // V5 (Liquid Glass skill): capsule buttons. primary = navy prominent, secondary = glass capsule, ghost = navy text.
 const navy=dark?'#8FB0E8':'#24467F';
 return <HeroButton {...props} variant={variant} feedbackVariant={reduceMotion?'none':'scale'} background={null} style={[{minHeight:50,height:'auto',paddingVertical:13,paddingHorizontal:20,borderRadius:99,borderCurve:'continuous',borderWidth:ghost||primary||danger?0:1,borderColor:'#FFFFFFCC',backgroundColor:ghost?'transparent':danger?c.danger:primary?(dark?'#3D63A6':'#24467F'):c.glass,boxShadow:ghost?undefined:primary?'0 10px 24px #1B356640':danger?undefined:'0 6px 18px #1B35661A'},style]}>
  <HeroButton.Label style={{fontSize:16,lineHeight:22,fontWeight:'600',textAlign:'center',flexShrink:1,color:danger||primary?'#FFFFFF':ghost?navy:c.text}}>{children}</HeroButton.Label>
 </HeroButton>;
}
export function Card(props:ComponentProps<typeof HeroCard>){const c=useColors();return <HeroCard {...props} style={[styles.card,{backgroundColor:c.surface,borderRadius:28,borderCurve:'continuous',padding:18,borderWidth:0,boxShadow:'0 10px 30px #1B356614'},props.style]}/>;}
export function Input(props:ComponentProps<typeof HeroInput>){const c=useColors();return <HeroInput {...props} background={null} placeholderTextColor={c.muted} selectionColor={c.accent} style={[styles.input,{backgroundColor:c.surface,color:c.text,borderColor:'transparent',borderRadius:16,borderCurve:'continuous',minHeight:48,paddingHorizontal:16,boxShadow:'0 4px 14px #1B35660D'},props.style]}/>;}
export function SegmentedControl<T extends string>({value,options,onChange,label,disabled=false}:{value:T;options:{value:T;label:string}[];onChange:(value:T)=>void;label:string;disabled?:boolean}) {
 const c=useColors();
 return <View accessibilityRole="tablist" accessibilityLabel={label} style={{flexDirection:'row',flexWrap:'wrap',backgroundColor:c.border,borderRadius:12,padding:3,gap:2}}>{options.map(option=><Pressable key={option.value} accessibilityRole="tab" accessibilityState={{selected:value===option.value,disabled}} disabled={disabled} onPress={()=>onChange(option.value)} style={({pressed})=>({flexGrow:1,flexBasis:0,minWidth:64,minHeight:44,justifyContent:'center',paddingHorizontal:8,paddingVertical:8,borderRadius:9,opacity:disabled?0.5:pressed?0.65:1,backgroundColor:value===option.value?c.surface:'transparent'})}><Text style={{fontSize:14,lineHeight:20,fontWeight:value===option.value?'600':'400',textAlign:'center',color:c.text}}>{option.label}</Text></Pressable>)}</View>;
}
export function Disclosure({title,children,initiallyOpen=false}:{title:string;children:ReactNode;initiallyOpen?:boolean}){
 // Local expansion does not unmount the enclosing form or alter submitted values.
 const [open,setOpen]=useState(initiallyOpen);const c=useColors();
 return <View style={styles.smallStack}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={({pressed})=>({minHeight:44,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?0.6:1})}><Text style={[styles.body,{color:c.accent,flex:1}]}>{title}</Text><View style={{transform:[{rotate:open?'90deg':'0deg'}]}}><Icon name="chevron" color={c.accent} size={16}/></View></Pressable>{open?<View style={styles.smallStack}>{children}</View>:null}</View>;
}
export function NavigationRow({title,subtitle,icon,onPress}:{title:string;subtitle?:string;icon:IconName;onPress:()=>void}){const c=useColors();return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({minHeight:66,flexDirection:'row',alignItems:'center',gap:14,padding:16,borderRadius:16,backgroundColor:c.surface,opacity:pressed?0.65:1})}><View style={{padding:9,borderRadius:10,backgroundColor:c.tint}}><Icon name={icon} color={c.accent} size={22}/></View><View style={{flex:1,gap:3}}><Text style={[styles.body,{color:c.text,fontWeight:'500'}]}>{title}</Text>{subtitle?<Text style={[styles.caption,{color:c.muted}]}>{subtitle}</Text>:null}</View><Icon name="chevron" size={15} color={c.muted}/></Pressable>;}
export function ContentTransition({changeKey,children}:{changeKey:string|number;children:ReactNode}){const opacity=useRef(new Animated.Value(1)).current,{reduceMotion}=useAppearance();useEffect(()=>{opacity.stopAnimation();if(reduceMotion){opacity.setValue(1);return;}opacity.setValue(0.6);const animation=Animated.timing(opacity,{toValue:1,duration:180,useNativeDriver:true});animation.start();return()=>animation.stop();},[changeKey,reduceMotion,opacity]);return <Animated.View style={{opacity,gap:18}}>{children}</Animated.View>;}
