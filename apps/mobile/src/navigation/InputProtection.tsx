import {createContext,useContext,useLayoutEffect,useRef} from 'react';
import {Alert} from 'react-native';
import {NavigationProtections,protectionFor,type NavigationProtection} from './protection';
export const InputProtectionContext=createContext<{guards:NavigationProtections;scene:number}|null>(null);

// Pen "V6 / 离开确认（系统弹窗）" (hFxMD): short, plain confirmations when leaving an edit.
export function confirmNavigation(status:NavigationProtection,zh:boolean,proceed:()=>void){
 if(status==='clear'){proceed();return;}
 if(status==='busy'){
  Alert.alert(zh?'正在提交':'Submitting',zh?'等这一步完成再离开。':'Wait for this to finish before leaving.',[{text:zh?'好':'OK'}]);return;
 }
 if(status==='uncertain'){
  Alert.alert(zh?'结果还没确认':'Not confirmed yet',zh?'可能已经保存了。离开后先刷新看看，别重复提交。':'It may already be saved. Refresh after leaving; don’t submit it again.',[
   {text:zh?'留在这里':'Stay',style:'cancel'},{text:zh?'离开':'Leave',style:'destructive',onPress:proceed}]);
  return;
 }
 Alert.alert(zh?'放弃修改？':'Discard changes?',zh?'这页还有没保存的修改。':'This page has unsaved changes.',[
  {text:zh?'继续编辑':'Keep editing',style:'cancel'},{text:zh?'放弃修改':'Discard',style:'destructive',onPress:proceed}]);
}
/** Compare with initial form data; only the risk level is registered, never the form text. */
export function useInputProtection(value:unknown,busy:boolean,uncertain:boolean,zh:boolean){
 const baseline=useRef(JSON.stringify(value));
 const state=protectionFor(JSON.stringify(value)!==baseline.current,busy,uncertain);
 return useNavigationProtection(state,zh);
}
/** For persistent editors whose baseline is the latest saved server profile. */
export function useNavigationProtection(state:NavigationProtection,zh:boolean){
 const context=useContext(InputProtectionContext);
 useLayoutEffect(()=>context?.guards.register(context.scene,state),[context?.guards,context?.scene,state]);
 return (proceed:()=>void)=>confirmNavigation(state,zh,proceed);
}
/** A parent Back action must consult guards registered by its mounted child forms. */
export function useSceneNavigation(zh:boolean){
 const context=useContext(InputProtectionContext);
 return (proceed:()=>void)=>confirmNavigation(context?.guards.status(context.scene)??'clear',zh,()=>{
  // Work may have started while a native confirmation dialog was open.
  if(context?.guards.status(context.scene)==='busy'){confirmNavigation('busy',zh,proceed);return;}
  proceed();
 });
}
