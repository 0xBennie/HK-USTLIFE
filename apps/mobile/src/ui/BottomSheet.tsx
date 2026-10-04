// Pen V6 sheet (e.g. "V6 / 确认报名（面板）"): a content-height panel over a dimmed screen, so the primary
// action at the bottom is always visible (an iOS pageSheet opens half-height and would hide it).
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Animated,Easing,Keyboard,LayoutAnimation,Modal,PanResponder,Pressable,StyleSheet,View,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppearance} from './Appearance';
import {usePenColors} from './Pen';

/** `header` is the drag handle area: swipe it down to close. Children should put long content in a ScrollView. */
export function BottomSheet({visible,onClose,closeLabel,header,children}:{visible:boolean;onClose:()=>void;closeLabel:string;header:ReactNode;children:ReactNode}){
 const c=usePenColors(),{reduceMotion}=useAppearance(),insets=useSafeAreaInsets(),{height}=useWindowDimensions();
 const [mounted,setMounted]=useState(visible);
 const shift=useRef(new Animated.Value(height)).current,shade=useRef(new Animated.Value(0)).current;
 const close=useRef(onClose);close.current=onClose;
 // The sheet rides on top of the keyboard (the report form has a text field).
 const [kb,setKb]=useState(0);
 useEffect(()=>{
  const move=(to:number,duration:number)=>{if(!reduceMotion)LayoutAnimation.configureNext({duration:Math.max(duration,10),update:{type:LayoutAnimation.Types.keyboard}});setKb(to);};
  const show=Keyboard.addListener('keyboardWillShow',e=>move(e.endCoordinates.height,e.duration)),hide=Keyboard.addListener('keyboardWillHide',e=>move(0,e.duration));
  return()=>{show.remove();hide.remove();};
 },[reduceMotion]);
 useEffect(()=>{
  if(visible){shift.setValue(reduceMotion?0:height);shade.setValue(0);setMounted(true);}
  else if(mounted){
   Animated.parallel([Animated.timing(shade,{toValue:0,duration:180,useNativeDriver:true}),Animated.timing(shift,{toValue:reduceMotion?0:height,duration:reduceMotion?0:220,easing:Easing.in(Easing.cubic),useNativeDriver:true})]).start(()=>setMounted(false));
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[visible]);
 const pan=useRef(PanResponder.create({
  onMoveShouldSetPanResponder:(_,g)=>g.dy>6&&Math.abs(g.dy)>Math.abs(g.dx),
  onPanResponderMove:(_,g)=>shift.setValue(Math.max(0,g.dy)),
  onPanResponderRelease:(_,g)=>{if(g.dy>110||g.vy>1.1)close.current();else Animated.spring(shift,{toValue:0,damping:30,stiffness:280,useNativeDriver:true}).start();},
  onPanResponderTerminate:()=>{Animated.spring(shift,{toValue:0,useNativeDriver:true}).start();},
 })).current;
 // Animate in only once the modal is on screen, so the native driver has mounted views to move.
 // (On the iOS Simulator RN divides native animation time by the simulator's drag coefficient,
 // so with Slow Animations / automation it runs 10x slower there; devices always use 1.)
 const enter=()=>Animated.parallel([Animated.timing(shade,{toValue:1,duration:200,useNativeDriver:true}),Animated.timing(shift,{toValue:0,duration:reduceMotion?0:320,easing:Easing.bezier(0.2,0.9,0.25,1),useNativeDriver:true})]).start();
 return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onShow={enter} onRequestClose={onClose}>
  <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'#0B0B0C66',opacity:shade}]}><Pressable accessibilityRole="button" accessibilityLabel={closeLabel} style={{flex:1}} onPress={onClose}/></Animated.View>
  <Animated.View accessibilityViewIsModal style={{position:'absolute',left:0,right:0,bottom:kb,maxHeight:height-insets.top-8-kb,borderTopLeftRadius:28,borderTopRightRadius:28,borderCurve:'continuous',backgroundColor:c.background,paddingBottom:kb?8:Math.max(insets.bottom,12),transform:[{translateY:shift}]}}>
   <View {...pan.panHandlers}>
    <View style={{alignItems:'center',paddingTop:8}}><View style={{width:36,height:5,borderRadius:3,backgroundColor:c.tertiary}}/></View>
    {header}
   </View>
   {children}
  </Animated.View>
 </Modal>;
}
