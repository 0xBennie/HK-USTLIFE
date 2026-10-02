import {ApiFailure} from '../api';
import type {Language} from '../strings';
import {socialError} from './shared';
export function wallError(error:unknown,language:Language){const zh=language==='zh';if(error instanceof ApiFailure){
 if(error.code==='DISCUSSION_CLOSED')return zh?'帖子已解决或讨论已结束，暂时不能回复。':'This post is resolved or closed to replies.';
 if(error.status===400)return zh?'请检查标题、正文、回复和可见范围。':'Check the title, body, reply and visibility.';
 if(error.status===409)return zh?'帖子已变化或请求内容不同，请返回刷新后核对。':'The post or request content changed. Go back and refresh before continuing.';
 if(error.status>0&&error.status<500)return socialError(error,language);
 }return zh?'暂时无法确认结果。请检查网络；重试会使用同一次请求，避免重复发布。':'Could not confirm the result. Check your connection; retry uses the same request to avoid duplicate posts.';
}
export const postStatus=(status:string,zh:boolean)=>status==='resolved'?(zh?'已解决':'Resolved'):status==='closed'?(zh?'讨论已结束':'Discussion closed'):(zh?'可以回复':'Open to replies');
