import { _decorator, Component, Node } from 'cc';

//角色基础借口
export interface BasicRole {
    /**受击 */
    byHit(...d);
}

