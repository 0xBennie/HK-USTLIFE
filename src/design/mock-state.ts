/** Isolated, in-memory prototype state. Never represents a school or backend account. */
export type MockTask = {id:string;title:string;note:string;course:boolean;done:boolean};
export type MockState = {
  participation: 'none' | 'confirmed' | 'waitlisted' | 'withdrawn';
  calendar: boolean; taskDone: boolean; imported: boolean;
  saved: string[]; replies: string[]; activityReplies:string[]; tasks:MockTask[];
  notices: {id:number;kind:'confirmed'|'waitlisted'|'withdrawn'|'reply'|'activity-reply';read:boolean}[];
};
export const initialMockState: MockState = {participation:'none',calendar:false,taskDone:false,imported:false,saved:[],replies:[],activityReplies:[],tasks:[],notices:[]};
export type MockAction = {type:'join';waitlist:boolean;calendar:boolean}|{type:'withdraw'}|{type:'calendar'}|{type:'task'}|{type:'save';id:string}|{type:'reply'|'activity-reply';body:string}|{type:'read';id?:number}|{type:'import'}|{type:'reset'}
 |{type:'task-add';task:MockTask}|{type:'task-edit';id:string;title:string;note:string;course:boolean}|{type:'task-toggle'|'task-remove';id:string}|{type:'task-restore';task:MockTask;index:number};
export function mockReducer(state:MockState,action:MockAction):MockState {
 const notice=(kind:MockState['notices'][number]['kind'])=>[{id:(state.notices[0]?.id??0)+1,kind,read:false},...state.notices];
 switch(action.type){
  case 'join': if(state.participation==='confirmed'||state.participation==='waitlisted')return state;return {...state,participation:action.waitlist?'waitlisted':'confirmed',calendar:action.calendar,notices:notice(action.waitlist?'waitlisted':'confirmed')};
  case 'withdraw':if(state.participation!=='confirmed'&&state.participation!=='waitlisted')return state;return {...state,participation:'withdrawn',calendar:false,notices:notice('withdrawn')};
  case 'calendar':return {...state,calendar:!state.calendar};
  case 'task':return {...state,taskDone:!state.taskDone};
  case 'save':return {...state,saved:state.saved.includes(action.id)?state.saved.filter(x=>x!==action.id):[...state.saved,action.id]};
  case 'reply':return action.body.trim()?{...state,replies:[...state.replies,action.body.trim()],notices:notice('reply')}:state;
  case 'activity-reply':return action.body.trim()?{...state,activityReplies:[...state.activityReplies,action.body.trim()],notices:notice('activity-reply')}:state;
  case 'read':return {...state,notices:state.notices.map(n=>action.id===undefined||n.id===action.id?{...n,read:true}:n)};
  case 'task-add':return !action.task.title.trim()||state.tasks.some(task=>task.id===action.task.id)?state:{...state,tasks:[...state.tasks,{...action.task,title:action.task.title.trim()}]};
  case 'task-edit':return !action.title.trim()?state:{...state,tasks:state.tasks.map(task=>task.id===action.id?{...task,title:action.title.trim(),note:action.note,course:action.course}:task)};
  case 'task-toggle':return {...state,tasks:state.tasks.map(task=>task.id===action.id?{...task,done:!task.done}:task)};
  case 'task-remove':return {...state,tasks:state.tasks.filter(task=>task.id!==action.id)};
  case 'task-restore':{if(state.tasks.some(task=>task.id===action.task.id))return state;const tasks=[...state.tasks];tasks.splice(action.index,0,action.task);return {...state,tasks};}
  case 'import':return {...state,imported:true};
  case 'reset':return initialMockState;
 }
}
