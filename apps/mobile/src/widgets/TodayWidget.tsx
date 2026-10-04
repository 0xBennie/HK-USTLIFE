// Pen board "V3 / 桌面小组件" (VPKlH): small = deadlines today, medium = next ride + deadlines, lock screen = one-line brief.
// Runs in the widget extension's isolated runtime: only @expo/ui/swift-ui, no hooks, everything inside the function.
import {HStack,Spacer,Text,VStack} from '@expo/ui/swift-ui';
import {containerBackground,font,foregroundStyle,lineLimit,monospacedDigit,padding,widgetURL} from '@expo/ui/swift-ui/modifiers';
import {createWidget,type WidgetEnvironment} from 'expo-widgets';

export type TodayWidgetProps={due:number;firstDue:string;firstDueAt:string;overdue:string;rideLabel:string;rideTime:string;liveLabel:string;updated:string};

const TodayWidget=(props:TodayWidgetProps,environment:WidgetEnvironment)=>{
 'widget';
 const navy='#24467F',muted='#7A7A80',ink='#0B0B0C',orange='#D98A1C',red='#E5484D',green='#2E9E5B';
 const dark=environment.colorScheme==='dark';
 const bg=dark?'#1C1C1E':'#FFFFFF',fg=dark?'#F5F5F7':ink;
 if(environment.widgetFamily==='accessoryRectangular'||environment.widgetFamily==='accessoryInline'){
  return <VStack alignment="leading" spacing={1} modifiers={[containerBackground('clear','widget'),widgetURL('hkust-campus-local://today')]}>
   <Text modifiers={[font({weight:'semibold',size:13})]}>{`今天 ${props.due} 项截止`}</Text>
   <Text modifiers={[font({size:12}),lineLimit(1)]}>{props.firstDue?`${props.firstDue} · ${props.firstDueAt}`:'都完成了'}</Text>
   <Text modifiers={[font({size:12}),lineLimit(1)]}>{`${props.rideLabel} ${props.rideTime}`}</Text>
  </VStack>;
 }
 const dueCard=<VStack alignment="leading" spacing={4}>
  <Text modifiers={[font({size:12,weight:'semibold'}),foregroundStyle(muted)]}>今天截止</Text>
  <Text modifiers={[font({size:40,weight:'bold',design:'rounded'}),foregroundStyle(fg),monospacedDigit()]}>{String(props.due)}</Text>
  <Spacer/>
  <Text modifiers={[font({size:12,weight:'semibold'}),foregroundStyle(orange),lineLimit(1)]}>{props.firstDue?`${props.firstDue} · ${props.firstDueAt}`:'都完成了'}</Text>
  {props.overdue?<Text modifiers={[font({size:11,weight:'semibold'}),foregroundStyle(red),lineLimit(1)]}>{props.overdue}</Text>:null}
 </VStack>;
 if(environment.widgetFamily==='systemSmall'){
  return <VStack alignment="leading" modifiers={[padding({all:14}),containerBackground(bg,'widget'),widgetURL('hkust-campus-local://today')]}>{dueCard}</VStack>;
 }
 return <HStack spacing={14} modifiers={[padding({all:14}),containerBackground(bg,'widget'),widgetURL('hkust-campus-local://today')]}>
  {dueCard}
  <Spacer/>
  <VStack alignment="leading" spacing={4}>
   <Text modifiers={[font({size:12,weight:'semibold'}),foregroundStyle(muted)]}>{props.rideLabel}</Text>
   <Text modifiers={[font({size:34,weight:'bold',design:'rounded'}),foregroundStyle(navy),monospacedDigit()]}>{props.rideTime}</Text>
   <Spacer/>
   <Text modifiers={[font({size:12,weight:'semibold'}),foregroundStyle(green),lineLimit(1)]}>{props.liveLabel}</Text>
   <Text modifiers={[font({size:10}),foregroundStyle(muted)]}>{`更新于 ${props.updated}`}</Text>
  </VStack>
 </HStack>;
};
export default createWidget<TodayWidgetProps>('TodayWidget',TodayWidget);
