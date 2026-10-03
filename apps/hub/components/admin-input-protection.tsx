'use client';
import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useState,type ReactNode} from 'react';

type InputState={dirty:boolean;busy:boolean};
type Registry={entries:Record<string,InputState>;update:(id:string,state:InputState|null)=>void};
const Context=createContext<Registry|null>(null);

export function AdminInputProtection({children}:{children:ReactNode}){
 const [entries,setEntries]=useState<Record<string,InputState>>({});
 const update=useCallback((id:string,state:InputState|null)=>setEntries(old=>{
  if(state&&old[id]?.dirty===state.dirty&&old[id]?.busy===state.busy||!state&&!old[id])return old;
  const next={...old};if(state)next[id]=state;else delete next[id];return next;
 }),[]);
 const value=useMemo(()=>({entries,update}),[entries,update]);
 const protectedInput=Object.values(entries).some(x=>x.dirty||x.busy);
 useEffect(()=>{if(!protectedInput)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[protectedInput]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminInputState(){const value=useContext(Context);if(!value)throw new Error('Admin input provider required');return value;}
export function useAdminInput(id:string,dirty:boolean,busy:boolean){
 const {update}=useAdminInputState();
 useLayoutEffect(()=>{update(id,{dirty,busy});},[id,dirty,busy,update]);
 useLayoutEffect(()=>()=>update(id,null),[id,update]);
}
