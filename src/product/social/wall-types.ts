export type WallTopic='question'|'share'|'buddy'|'market';
export type WallPost={id:string;kind:'wall'|'help';topic:WallTopic;reply_count:number;title:string;body:string;visibility:'public'|'members';status:'open'|'resolved'|'closed';version:number;created_at:string;updated_at:string;is_demo:true;author:{id:string;display_name:string};is_mine:boolean};
export type WallReply={id:number;post_id:string;body:string;version:number;created_at:string;author:{id:string;display_name:string};is_mine:boolean};
export type ReportTarget={kind:'post'|'reply'|'activity'|'activity_comment'|'contact_card';id:string};
