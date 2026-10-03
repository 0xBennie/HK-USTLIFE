import Svg,{Path} from 'react-native-svg';
import {iconPaths,type IconName} from '../../../../src/design/icons';
export function Icon({name,color,size=24}:{name:IconName;color:string;size?:number}) {
 return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}><Path d={iconPaths[name]} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
