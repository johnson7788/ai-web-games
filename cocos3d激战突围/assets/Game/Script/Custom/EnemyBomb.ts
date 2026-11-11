import { _decorator, Component, Node, v3 } from 'cc';
import { GlobalConfig } from '../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { ColliderGroup, CollisionManager, CollisionTools } from '../Common/VertCollison/CollisionManager';
import { BasicRole } from './BasicRole';
import { Enemy } from './Enemy';
import { EnemyStateType } from './EnemyStates';
const { ccclass, property } = _decorator;

@ccclass('EnemyBomb')
export class EnemyBomb extends Enemy {

    byHit(n: number) {
        if (this.hp <= 0) return;

        this.hp -= n;
        //击中效果
        this.modfiyMsCmp.byHit();

        if (this.hp <= 0) {
            this.hp = 0;
            //自爆效果
            this.enemyBoom();
            //
            this.resetCollider();
            this.modfiyMsCmp.setDeath();

            this.changeState(EnemyStateType.Death);
        }
    }

    enemyBoom() {

        //检测范围内的所有角色
        const cfg = GlobalConfig.Enemy[GlobalEnum.EnemyType.Bomb];
        let res: { [groupId: number]: number[] } = {};

        if (CollisionTools.getCollInfoByPos(this.curPos, cfg.boomRadius, res, [ColliderGroup.Enemy, ColliderGroup.Player])) {
            let boomAtk = cfg.boomAtk;
            let maxRadius = cfg.boomRadius * cfg.boomRadius;

            for (const key in res) {
                const arr = res[key];
                for (let i = 0; i < arr.length; i++) {
                    const cld = arr[i];
                    if (cld != this.collider.SelfId) {
                        const target = CollisionManager.getColilderByColId(cld).targetCmp as BasicRole;
                        if (target && target != this && target.hp > 0) {
                            //检测距离
                            let len = this.tmpP.set(this.curPos).subtract(target.curPos).lengthSqr();
                            if (len <= maxRadius) {
                                setTimeout(() => {
                                    target.byHit(boomAtk);
                                }, 0);
                            }
                        }
                    }
                }
            }
        }

        //爆炸效果
        EventManager.emit(EventTypes.EffectEvents.show3DTo2DEffect, { t: GlobalEnum.Effect3dType.Effect_jz_bomb_boom, p: this.curPos })

    }

}

