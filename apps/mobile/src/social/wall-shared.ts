import {ApiFailure} from '../api';
import type {Language} from '../strings';
import {socialError} from './shared';
// Pen "V6 / 校园墙", "V6 / 帖子详情", "V6 / 发帖" · 其他状态: a failed read asks for a retry; an unconfirmed
// write says the retry only checks the same request.
export type WallErrorKind='list'|'read'|'post'|'reply'|'write';
export function wallError(error:unknown,language:Language,kind:WallErrorKind='write'){const zh=language==='zh';if(error instanceof ApiFailure){
 if(error.code==='RECEIPT_REVIEW_REQUIRED')return socialError(error,language);
 if(error.code==='POST_LIMIT')return zh?'今天已经发了 10 条，明天再来。':'You’ve posted 10 times today. Try again tomorrow.';
 if(error.code==='DISCUSSION_CLOSED')return zh?'帖子已解决或讨论已结束，暂时不能回复。':'This post is resolved or closed to replies.';
 if(error.status===400)return zh?'请检查标题、正文、回复和可见范围。':'Check the title, body, reply and visibility.';
 if(error.status===409)return zh?'帖子刚刚有变化，请返回刷新后再试。':'The post just changed. Go back, refresh and try again.';
 if(error.status>0&&error.status<500)return socialError(error,language);
 }
 if(kind==='list')return zh?'校园墙暂时打不开，请检查网络后重试。':'The wall didn’t load. Check your connection and try again.';
 if(kind==='read')return zh?'暂时打不开，请检查网络后重试。':'Couldn’t load. Check your connection and try again.';
 if(kind==='reply')return zh?'回复还没确认，重试只会核对同一条。':'Reply not confirmed yet; retrying only checks the same one.';
 return zh?'还没确认结果，重试只会核对同一次。':'Not confirmed yet; retrying only checks the same request.';
}
export const postStatus=(status:string,zh:boolean)=>status==='resolved'?(zh?'已解决':'Resolved'):status==='closed'?(zh?'已结束':'Closed'):(zh?'可以回复':'Open to replies');
