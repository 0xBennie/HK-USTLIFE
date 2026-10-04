// Single-line search field with its own placeholder text: while a Chinese keyboard is active, iOS draws a
// native placeholder lower than the typed text (clipped in short fields), so the hint is plain Text instead.
import {Text,TextInput,View,type TextInputProps} from 'react-native';
import {usePenColors} from './Pen';

export function PlainField({placeholder,fontSize,value,...rest}:Omit<TextInputProps,'style'|'placeholderTextColor'>&{placeholder:string;fontSize:number;value:string}){
 const c=usePenColors();
 return <View style={{flex:1,height:44,justifyContent:'center'}}>
  {!value?<View pointerEvents="none" style={{position:'absolute',left:0,right:0}}><Text numberOfLines={1} style={{fontSize,color:c.muted}}>{placeholder}</Text></View>:null}
  <TextInput {...rest} value={value} accessibilityHint={placeholder} style={{height:44,padding:0,fontSize,color:c.text}}/>
 </View>;
}
