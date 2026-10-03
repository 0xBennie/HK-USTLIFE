// Shared Liquid Glass motion state (Pen "V5 LIQUID GLASS · 设计系统"): the tab bar compacts while content scrolls down
// and returns after a deliberate upward scroll (>40pt), so the bottom bounce does not flip it back.
// Holds only 0/1; the tab bar animates the change itself inside useAnimatedStyle.
import {makeMutable} from 'react-native-reanimated';
export const tabCompact=makeMutable(0);
let last=0,upTravel=0;
const set=(v:0|1)=>{if(tabCompact.value!==v)tabCompact.value=v;};
export function trackScroll(y:number){
 const dy=y-last;last=y;
 if(dy<0)upTravel+=-dy;else if(dy>0)upTravel=0;
 if(y<60||upTravel>40)set(0);
 else if(y>120&&dy>4)set(1);
}
export function resetCompact(){last=0;upTravel=0;set(0);}
