import {describe,it,expect} from 'vitest';
import {initialMockState,mockReducer} from '../src/design/mock-state';
describe('isolated interactive prototype state',()=>{
 it('multiple tasks keep independent identity, edits and completion across views',()=>{
  let state=mockReducer(initialMockState,{type:'task-add',task:{id:'a',title:'Outline',note:'Three points',course:true,done:false}});
  state=mockReducer(state,{type:'task-add',task:{id:'b',title:'Shopping',note:'',course:false,done:false}});
  state=mockReducer(state,{type:'task-toggle',id:'a'});
  state=mockReducer(state,{type:'task-edit',id:'a',title:' Revised outline ',note:'Four points',course:true});
  expect(state.tasks).toEqual([{id:'a',title:'Revised outline',note:'Four points',course:true,done:true},{id:'b',title:'Shopping',note:'',course:false,done:false}]);
  expect(mockReducer(state,{type:'task-add',task:state.tasks[0]})).toBe(state);
  expect(mockReducer(state,{type:'task-edit',id:'a',title:'  ',note:'',course:false})).toBe(state);
 });
 it('undo restores the original task position without reverting intervening changes',()=>{
  let state=initialMockState;
  for(const id of ['a','b','c'])state=mockReducer(state,{type:'task-add',task:{id,title:id,note:'',course:true,done:false}});
  const task=state.tasks[1];
  state=mockReducer(state,{type:'task-remove',id:'b'});
  state=mockReducer(state,{type:'task-toggle',id:'a'});
  state=mockReducer(state,{type:'task-restore',task,index:1});
  expect(state.tasks.map(t=>t.id)).toEqual(['a','b','c']);
  expect(state.tasks[0].done).toBe(true);
  expect(mockReducer(state,{type:'task-restore',task,index:1})).toBe(state);
 });
 it('activity discussion stays separate and opening one notification preserves other unread items',()=>{
  let state=mockReducer(initialMockState,{type:'reply',body:'Classroom question'});
  state=mockReducer(state,{type:'activity-reply',body:'Ten minutes late?'});
  state=mockReducer(state,{type:'read',id:state.notices[0].id});
  expect(state.replies).toEqual(['Classroom question']);
  expect(state.activityReplies).toEqual(['Ten minutes late?']);
  expect(state.notices.map(n=>[n.kind,n.read])).toEqual([['activity-reply',true],['reply',false]]);
  expect(mockReducer(state,{type:'reset'}).tasks).toEqual([]);
 });
 it('one join updates participation, optional calendar and inbox exactly once',()=>{const joined=mockReducer(initialMockState,{type:'join',waitlist:false,calendar:true});expect(joined.participation).toBe('confirmed');expect(joined.calendar).toBe(true);expect(joined.notices.map(n=>n.kind)).toEqual(['confirmed']);expect(mockReducer(joined,{type:'join',waitlist:false,calendar:true})).toBe(joined);});
 it('waitlist stays distinct, withdrawal removes calendar and is idempotent',()=>{const queued=mockReducer(initialMockState,{type:'join',waitlist:true,calendar:true});expect(queued.participation).toBe('waitlisted');const left=mockReducer(queued,{type:'withdraw'});expect(left.calendar).toBe(false);expect(left.participation).toBe('withdrawn');expect(left.notices.map(n=>n.kind)).toEqual(['withdrawn','waitlisted']);expect(mockReducer(left,{type:'withdraw'})).toBe(left);});
 it('saving a calendar or bookmark does not imply a signup',()=>{const saved=mockReducer(mockReducer(initialMockState,{type:'calendar'}),{type:'save',id:'activity'});expect(saved.participation).toBe('none');expect(saved.notices).toHaveLength(0);expect(saved.saved).toEqual(['activity']);expect(mockReducer(saved,{type:'save',id:'activity'}).saved).toEqual([]);});
 it('blank replies have no effect, reset clears all demo changes',()=>{expect(mockReducer(initialMockState,{type:'reply',body:'  '})).toBe(initialMockState);const reply=mockReducer(initialMockState,{type:'reply',body:' Thanks! '});expect(reply.replies).toEqual(['Thanks!']);expect(mockReducer(reply,{type:'read'}).notices[0].read).toBe(true);expect(mockReducer(reply,{type:'reset'})).toEqual(initialMockState);});
});
