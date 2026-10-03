// Shared tactile feedback. Haptics are cheap and give native-feeling confirmation without visual noise.
import * as Haptics from 'expo-haptics';
const safe=(run:()=>Promise<unknown>)=>{run().catch(()=>{});};
export const feel={
 tap:()=>safe(()=>Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
 select:()=>safe(()=>Haptics.selectionAsync()),
 success:()=>safe(()=>Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
 warn:()=>safe(()=>Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
