export type NavigationProtection='clear'|'draft'|'uncertain'|'busy';
const priority:Record<NavigationProtection,number>={clear:0,draft:1,uncertain:2,busy:3};
/** In-memory guards only; no private text or request payload is copied into the navigation layer. */
export class NavigationProtections {
 private entries=new Map<symbol,{scene:number;state:NavigationProtection}>();
 register(scene:number,state:NavigationProtection){const id=Symbol();this.entries.set(id,{scene,state});return()=>{this.entries.delete(id);};}
 status(scene?:number):NavigationProtection {
  let result:NavigationProtection='clear';
  for(const item of this.entries.values())if((scene===undefined||item.scene===scene)&&priority[item.state]>priority[result])result=item.state;
  return result;
 }
}
export function protectionFor(changed:boolean,busy:boolean,uncertain:boolean):NavigationProtection {
 return busy?'busy':uncertain?'uncertain':changed?'draft':'clear';
}
