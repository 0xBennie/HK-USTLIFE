import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {AccessibilityInfo} from 'react-native';
const Context=createContext({reduceMotion:true,reduceTransparency:true});
export function AppearanceProvider({children}:{children:ReactNode}) {
 const [reduceMotion,setMotion]=useState(true),[reduceTransparency,setTransparency]=useState(true);
 useEffect(()=>{let active=true;let motionEvent=false;let transparencyEvent=false;
  const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{motionEvent=true;setMotion(v);});
  const transparency=AccessibilityInfo.addEventListener('reduceTransparencyChanged',v=>{transparencyEvent=true;setTransparency(v);});
  void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active&&!motionEvent)setMotion(v);}).catch(()=>{});
  void AccessibilityInfo.isReduceTransparencyEnabled().then(v=>{if(active&&!transparencyEvent)setTransparency(v);}).catch(()=>{});
  return()=>{active=false;motion.remove();transparency.remove();};
 },[]);
 return <Context.Provider value={{reduceMotion,reduceTransparency}}>{children}</Context.Provider>;
}
export const useAppearance=()=>useContext(Context);
