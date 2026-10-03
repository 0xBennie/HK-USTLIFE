import {createContext,useContext,useRef,useState,type ReactNode} from 'react';
import {ScrollView,View,type ScrollViewProps} from 'react-native';
import {ContentTransition} from '../ui/Primitives';

const SceneFocus=createContext(true);
export const useSceneFocus=()=>useContext(SceneFocus);

/** Keep a visited screen's inputs/navigation in memory. The parent is keyed by session identity. */
export function TabScene({active,children,pageRef,contentContainerStyle}:{active:boolean;children:ReactNode;pageRef:(reset:(()=>void)|null)=>void;contentContainerStyle:ScrollViewProps['contentContainerStyle']}){
 const [visited,setVisited]=useState(active);
 // A guarded render update mounts the destination in the same commit, without mounting all five pages.
 if(active&&!visited)setVisited(true);
 const offset=useRef(0),page=useRef<ScrollView|null>(null);
 return <SceneFocus.Provider value={active}>
  <View style={active?{flex:1}:{display:'none'}} pointerEvents={active?'auto':'none'} accessibilityElementsHidden={!active} importantForAccessibility={active?'auto':'no-hide-descendants'}>
   {visited?<ScrollView ref={value=>{page.current=value;pageRef(value?()=>{offset.current=0;value.scrollTo({y:0,animated:false});}:null);}} onLayout={()=>{if(active)page.current?.scrollTo({y:offset.current,animated:false});}} onScroll={event=>{if(active)offset.current=event.nativeEvent.contentOffset.y;}} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={contentContainerStyle}>
    <ContentTransition changeKey={Number(active)}>{children}</ContentTransition>
   </ScrollView>:null}
  </View>
 </SceneFocus.Provider>;
}
