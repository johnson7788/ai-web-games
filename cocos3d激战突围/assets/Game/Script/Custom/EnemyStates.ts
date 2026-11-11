import { _decorator, Component, Node, v3, Collider, Vec3, clamp } from 'cc';
import { GlobalConfig } from '../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../Init/Config/GlobalTmpData';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import GlobalPool from '../../../Init/Tools/GlobalPool';
import { BasicState } from '../Common/Basic/BasicState';
import { ColliderGroup, CollisionManager, CollisionTools } from '../Common/VertCollison/CollisionManager';
import { Enemy } from './Enemy';
import { Role } from './Role';
const { ccclass, property } = _decorator;

export enum EnemyStateType {
    Move,
    Follow,
    EnterPass,  //通过通道
    EndFollow,
    Death,
    Win,
}

//跟随路径移动
export class EnemyMoveState extends BasicState<Enemy> {
    public enter(d?: any): void {
        let clip = this.cmp.enemyType == GlobalEnum.EnemyType.Ninja ?
            GlobalEnum.EnemyClip.rush : GlobalEnum.EnemyClip.run;
        this.cmp.anim.playAnim(clip, true);
    }
    public update(dt: any): void {
        this.cmp.calPathDirec();
        this.cmp.move(dt);
        this.cmp.checkEndMark();
        this.cmp.checkPlayerCenterPos(dt);
    }
}


//追随玩家
export class EnemyFollowState extends BasicState<Enemy> {
    public enter(d?: any): void {

    }

    public update(dt: any): void {
        this.updateCheck(dt);

        this.cmp.move(dt);
        this.cmp.checkEndMark();
    }
    checkCd = 0.1;
    curt = 0;
    tmpP = v3();
    //减少检测次数
    private updateCheck(dt) {
        this.curt += dt;
        if (this.curt >= this.checkCd) {
            this.curt = 0;
            //计算方向
            this.tmpP.set(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset).subtract(this.cmp.curPos);
            let r = 1.2;
            // let curLen = this.tmpP.length();

            //刺客-加速
            // if (this.cmp.enemyType == GlobalEnum.EnemyType.Ninja) {
            //     if (curLen < GlobalConfig.EnemyCfg.followDist * 0.5 && curLen > this.cmp.moveSpd) {
            //         r = clamp(curLen / this.cmp.moveSpd, 1.1, 1.2);
            //     }
            //     if (curLen < this.cmp.moveSpd) {
            //         r = 1.2;
            //     }
            // }
            //转向速率同步
            this.cmp._rotSpdRate = r;

            this.tmpP.normalize().multiplyScalar(this.cmp.moveSpd * r);
            this.cmp.lineVec.set(this.tmpP);
        }
    }
}
//进入终点通道
export class EnemyEnterPassState extends BasicState<Enemy> {
    public enter(d?: any): void {

        //重新设定路线
        this.cmp.allPath = [v3(this.cmp.curPos)];
        const endPath = GlobalTmpData.endPassPath;
        endPath.forEach(e => {
            this.cmp.allPath.push(v3(e));
        });
        this.cmp.pathIndex = 0;
        this.cmp.lineVec.set(this.cmp.allPath[1]).subtract(this.cmp.allPath[0]);
        this.cmp.lineVec.normalize().multiplyScalar(this.cmp.moveSpd);
    }

    public update(dt: any): void {
        this.cmp.calPathDirec();
        this.cmp.move(dt);
        //        
        this.checkPass();
    }
    //检测是否已通过通道
    public checkPass() {
        if (this.cmp.curPos.z >= this.cmp.allPath[this.cmp.allPath.length - 1].z) {
            this.cmp.changeState(EnemyStateType.EndFollow);
        }
    }

}
//终点追随玩家
export class EnemyEndFollowState extends BasicState<Enemy> {
    targetRec: { p: Vec3, role: Role } = null;
    maxDist = 0;

    public enter(d?: any): void {
        this.getTargetPos();
    }
    tmpP = v3();
    public update(dt: any): void {
        this.getTargetPos();
        this.moveToTarget(dt);
    }

    public reset(): void {
        super.reset();
        if (this.targetRec) {
            this.targetRec.p = null;
            this.targetRec.role = null;
        }
        this.targetRec = null;
    }

    //朝目标移动
    moveToTarget(dt) {
        if (this.targetRec) {
            let curDist = this.tmpP.set(this.cmp.curPos).subtract(this.targetRec.p).lengthSqr();
            if (curDist > this.maxDist) {
                this.cmp.lineVec.set(0, 0, this.cmp.moveSpd);
            }
        }
        this.tmpP.set(this.cmp.lineVec).multiplyScalar(dt);
        this.cmp.curPos.add(this.tmpP);
    }

    //获取玩家位置+移动方向
    getTargetPos() {
        if (!this.targetRec || this.targetRec && this.targetRec.role.hp < 0) {
            const recs = GlobalTmpData.endFormationRec;
            for (const key in recs) {
                const rec = recs[key];
                if (rec && rec.role.hp > 0) {
                    this.targetRec = rec;
                    this.tmpP.set(this.targetRec.p).subtract(this.cmp.curPos);
                    this.maxDist = this.tmpP.lengthSqr();
                    this.cmp.lineVec.set(this.tmpP).normalize().multiplyScalar(this.cmp.moveSpd);
                    break;
                }
            }
            if (!this.targetRec) {
                this.cmp.lineVec.set(0, 0, this.cmp.moveSpd);
            }
        }
    }

    public exit(): void {

    }
}



//死亡
export class EnemyDeathState extends BasicState<Enemy> {
    _delayId = null;

    public enter(d?: any): void {
        this.cmp.anim.playAnim(GlobalEnum.EnemyClip.death);

        this._delayId = setTimeout(() => {
            this.cmp && this.cmp.node &&
                GlobalPool.put(this.cmp.node);
        }, 2000);
    }
    public update(dt: any): void {

    }
    public reset(): void {
        clearTimeout(this._delayId);
        super.reset();
    }

}
//胜利
export class EnemyWinState extends BasicState<Enemy> {
    public enter(d?: any): void {

    }
    public update(dt: any): void {

    }
}
