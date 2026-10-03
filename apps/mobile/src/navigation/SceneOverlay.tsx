import {createContext,useContext,useEffect,useSyncExternalStore,type ReactNode} from 'react';

/**
 * A pushed page (e.g. activity details) shows the Pen "Bottom bar" in place of the tab bar.
 * Content updates only re-render the host; the app shell re-renders only when presence flips.
 */
export class SceneOverlayStore {
 private node:ReactNode=null;private present=false;
 private content=new Set<()=>void>();private presence=new Set<()=>void>();
 set(node:ReactNode){this.node=node;this.content.forEach(l=>l());const next=node!=null;if(next!==this.present){this.present=next;this.presence.forEach(l=>l());}}
 subscribeContent=(l:()=>void)=>{this.content.add(l);return()=>{this.content.delete(l);};};
 subscribePresence=(l:()=>void)=>{this.presence.add(l);return()=>{this.presence.delete(l);};};
 snapshot=()=>this.node;
 isPresent=()=>this.present;
}
const Context=createContext<SceneOverlayStore|null>(null);
export const SceneOverlayProvider=Context.Provider;
/** Render `node` as this scene's bottom bar while mounted; pass null to show the tab bar again. */
export function useSceneBottomBar(node:ReactNode){
 const store=useContext(Context);
 useEffect(()=>{store?.set(node);});
 useEffect(()=>()=>store?.set(null),[store]);
}
export function SceneOverlayHost({store}:{store:SceneOverlayStore}){return <>{useSyncExternalStore(store.subscribeContent,store.snapshot)}</>;}
export const useOverlayPresent=(store:SceneOverlayStore)=>useSyncExternalStore(store.subscribePresence,store.isPresent);
/** Full-screen pushed pages (compose, edit) hide the tab bar without showing a bottom bar. */
export function useHideTabBar(){useSceneBottomBar(<></>);}
