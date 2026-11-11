import { _decorator, Component, Node, v3, Vec3 } from 'cc';
import { GlobalConfig } from '../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../Init/Config/GlobalTmpData';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import GlobalPool from '../../../Init/Tools/GlobalPool';
import { BasicState } from '../Common/Basic/BasicState';
import { Role } from './Role';
const { ccclass, property } = _decorator;

export enum RoleStateType {
    Idle,           //首页
    Move,
    Pass,
    StandShoot,
    Death,
    Win,
}
//首页站立
export class RoleIdleState extends BasicState<Role>{
    offsetDirec = v3();
    public enter(d?: any): void {
        this.cmp.roleAnim.playAnim(GlobalEnum.PlayerClip.idle, true);
        this.cmp.curPos.add(this.cmp.offset);
        this.cmp.updateTransData(0);
    }

    public update(dt: any): void {
        this.cmp.move(dt);
        this.cmp.lineVec.set(0, 0, 1);
        this.cmp.rotation(dt);
    }
}

//移动
export class RoleMoveState extends BasicState<Role>{
    public enter(d?: any): void {
        this.cmp.playAtkAnim(false);
    }
    public update(dt: any): void {
        this.cmp.move(dt);
        this.cmp.rotation(dt);
    }
}
//通过通道状态
export class RolePassState extends BasicState<Role>{
    //
    endPath: Vec3[] = null;
    endIndex = 0;
    isMoveEnd = false;
    endRecIndex = 0; //阵型位置id

    public enter(d: { endPath: Vec3[], endRecIndex: number }): void {
        this.endPath = d.endPath;
        this.endRecIndex = d.endRecIndex;
        this.endIndex = 0;
        this.isMoveEnd = false;
    }

    public update(dt: any): void {
        this.calPathDirec(dt);
        if (this.isMoveEnd) {
            this.onMoveFinished();
        }
    }

    tmpP = v3();

    // /计算路径方向
    calPathDirec(dt) {
        if (this.isMoveEnd) return;

        let prePos = this.endPath[this.endIndex];
        let nexSubId = this.endIndex + 1;

        if (nexSubId <= this.endPath.length - 1) {

            let nextPos = this.endPath[nexSubId];
            let maxLen = this.tmpP.set(prePos).subtract(nextPos).lengthSqr();

            this.tmpP.set(this.cmp.curPos).subtract(prePos);
            let curLen = this.tmpP.lengthSqr();

            if (curLen >= maxLen) {
                //切换路线索引
                this.endIndex++;
                // console.log('enemy change:', this.endIndex);
                nexSubId = this.endIndex + 1;
                if (nexSubId > this.endPath.length - 1) {
                    this.isMoveEnd = true;
                    this.cmp.lineVec.set(0, 0, 0);
                    return;
                }
                prePos = this.endPath[this.endIndex];
                nextPos = this.endPath[nexSubId];
            }
            //--线性速度            
            this.cmp.lineVec.set(nextPos).subtract(prePos).normalize().
                multiplyScalar(this.cmp.moveSpd);
        }

        this.tmpP.set(this.cmp.lineVec).multiplyScalar(dt);
        this.cmp.curPos.add(this.tmpP);
    }

    public onMoveFinished() {
        this.cmp.changeState(RoleStateType.StandShoot);
    }

    public exit(): void {
        //
    }
}

//站着射击
export class RoleStandShootState extends BasicState<Role>{
    public enter(d?: any): void {
        this.cmp.playAtkAnim(true);
    }
}
//死亡
export class RoleDeathState extends BasicState<Role>{
    public enter(d?: any): void {
        //死亡效果
        let pos = v3(this.cmp.curPos);
        pos.y += 0.5;
        EventManager.emit(EventTypes.EffectEvents.showMergeEffect,
            GlobalEnum.MergeEffectType.MergeRoleDeath, { p: pos });
        //
        EventManager.emit(EventTypes.RoleEvents.Death, this.cmp.node.uuid);

    }
}

export class RoleWinState extends BasicState<Role>{
    public enter(d?: any): void {

    }
}