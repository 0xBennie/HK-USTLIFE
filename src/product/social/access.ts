import type {DatabaseSync} from 'node:sqlite';
export function blocked(db:DatabaseSync,viewer:string|null,author:string):boolean {
 return !!viewer&&!!db.prepare('SELECT 1 FROM user_blocks WHERE (owner_id=? AND target_id=?) OR (owner_id=? AND target_id=?)').get(viewer,author,author,viewer);
}
// Author expression is an internal SQL alias, never request data. Bind viewer twice.
export const unblockedSql=(author:string)=>`NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.owner_id=? AND b.target_id=${author}) OR (b.owner_id=${author} AND b.target_id=?))`;
