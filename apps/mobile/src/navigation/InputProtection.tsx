import {createContext,useContext,useLayoutEffect,useRef} from 'react';
import {Alert} from 'react-native';
import {NavigationProtections,protectionFor,type NavigationProtection} from './protection';
export const InputProtectionContext=createContext<{guards:NavigationProtections;scene:number}|null>(null);

export function confirmNavigation(status:NavigationProtection,zh:boolean,proceed:()=>void){
 if(status==='clear'){proceed();return;}
 if(status==='busy'){
  Alert.alert(zh?'正在处理':'Request in progress',zh?'请等待本次操作返回，避免丢失确认结果。':'Wait for this request to return before leaving.');return;
 }
 Alert.alert(status==='uncertain'?(zh?'结果尚未确认':'Result unconfirmed'):(zh?'离开编辑？':'Leave this edit?'),status==='uncertain'?(zh?'操作可能已保存。离开后请先刷新核对，避免重复创建。':'The change may already be saved. Check the latest records before creating another.'):(zh?'切换底部标签可以保留这份输入。返回或打开另一条内容会放弃尚未保存的修改。':'Switching bottom tabs keeps your input. Going back or opening another item discards unsaved changes.'),[
  {text:zh?'继续编辑／核对':'Stay here',style:'cancel'},
  {text:status==='uncertain'?(zh?'离开并稍后核对':'Leave and check later'):(zh?'放弃修改':'Discard changes'),style:'destructive',onPress:proceed},
 ]);
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
