import {ApiFailure} from '../api';
import type {Language} from '../strings';
export function socialError(error:unknown,language:Language){
 const zh=language==='zh';if(error instanceof ApiFailure){
  if(error.code==='RECEIPT_REVIEW_REQUIRED')return zh?'本次操作的安全重试期限已过。请先查看已保存内容或当前报名状态，再决定下一步。':'The safe retry window ended. Check saved content or current participation before taking another action.';
  if(error.status===401)return zh?'登录已失效，请重新登录。':'Please sign in again.';
  if(error.status===404||error.status===410)return zh?'内容已删除或无权查看，请返回列表刷新。':'This content was removed or is not visible to you. Refresh the list.';
  if(error.status===409)return zh?'状态、时间或名额已变化。请刷新后核对，再继续。':'The state, time or capacity changed. Refresh and review before continuing.';
  if(error.status===400)return zh?'请检查标题、地点、开始／结束时间和名额。':'Check the title, location, start/end times and capacity.';
  if(error.status===403)return zh?'你没有执行此操作的权限。':'You do not have permission for this action.';
  if(error.status===429)return zh?'操作次数达到限制，请稍后重试。':'The request limit was reached. Try again later.';
 }
 return zh?'暂时无法确认结果。请保留当前输入，通过页面的重试入口核对同一笔操作。':'Could not confirm the result. Keep this draft and use the retry action to check the same request.';
}
export const participationLabel=(status:string,zh:boolean)=>({confirmed:zh?'报名已确认':'Confirmed',waitlisted:zh?'候补中':'Waitlisted',withdrawn:zh?'已退出':'Withdrawn',cancelled:zh?'已取消':'Cancelled',organizer:zh?'组织者':'Organizer',not_joined:zh?'仅保存日程，未报名':'Saved only, not joined'}[status]??status);
