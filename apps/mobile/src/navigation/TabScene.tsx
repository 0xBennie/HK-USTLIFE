import {createContext,useContext,useRef,useState,type ReactNode} from 'react';
import {ScrollView,View,useColorScheme,type ScrollViewProps} from 'react-native';
import {BlurView} from 'expo-blur';
import {useAppearance} from '../ui/Appearance';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ContentTransition} from '../ui/Primitives';
import {useBottomClearance,usePenColors} from '../ui/Pen';
import {SceneOverlayHost,SceneOverlayProvider,useOverlayPresent,type SceneOverlayStore} from './SceneOverlay';

const SceneFocus=createContext(true);
export const useSceneFocus=()=>useContext(SceneFocus);

/** Keep a visited screen's inputs/navigation in memory. The parent is keyed by session identity. */
export function TabScene({active,children,pageRef,contentContainerStyle,overlay}:{active:boolean;children:ReactNode;pageRef:(reset:(()=>void)|null)=>void;contentContainerStyle:ScrollViewProps['contentContainerStyle'];overlay:SceneOverlayStore}){
 const [visited,setVisited]=useState(active);
 // A guarded render update mounts the destination in the same commit, without mounting all five pages.
 if(active&&!visited)setVisited(true);
 const offset=useRef(0),page=useRef<ScrollView|null>(null);
 // Content runs under the status bar (Pen boards draw full-bleed heroes there) and clears the floating bar.
 const insets=useSafeAreaInsets(),pushed=useOverlayPresent(overlay);
 // iOS shows a material behind the status bar once content scrolls under it.
 const [scrolled,setScrolled]=useState(false),c=usePenColors(),dark=useColorScheme()==='dark',{reduceTransparency}=useAppearance();
 const tabClearance=useBottomClearance('tab'),barClearance=useBottomClearance('bottom');
 return <SceneFocus.Provider value={active}><SceneOverlayProvider value={overlay}>
  <View style={active?{flex:1}:{display:'none'}} pointerEvents={active?'auto':'none'} accessibilityElementsHidden={!active} importantForAccessibility={active?'auto':'no-hide-descendants'}>
   {visited?<ScrollView ref={value=>{page.current=value;pageRef(value?()=>{offset.current=0;value.scrollTo({y:0,animated:false});}:null);}} onLayout={()=>{if(active)page.current?.scrollTo({y:offset.current,animated:false});}} onScroll={event=>{if(!active)return;const y=event.nativeEvent.contentOffset.y;offset.current=y;if((y>4)!==scrolled)setScrolled(y>4);}} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentInsetAdjustmentBehavior="never" contentContainerStyle={[contentContainerStyle,{paddingTop:insets.top+6,paddingBottom:pushed?barClearance:tabClearance}]}>
    <ContentTransition changeKey={Number(active)}>{children}</ContentTransition>
   </ScrollView>:null}
   {visited&&active&&scrolled?<View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,height:insets.top,overflow:'hidden',backgroundColor:reduceTransparency?c.background:c.glass,borderBottomWidth:0.5,borderBottomColor:c.border}}>{!reduceTransparency?<BlurView intensity={60} tint={dark?'dark':'light'} style={{position:'absolute',inset:0}}/>:null}</View>:null}
   {visited&&active?<SceneOverlayHost store={overlay}/>:null}
  </View>
 </SceneOverlayProvider></SceneFocus.Provider>;
}
