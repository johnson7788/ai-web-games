import { _decorator, Component, Node, v3, Vec3 } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import { WeaponCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { ColliderGroup, CollisionManager, CollisionTools } from '../../Common/VertCollison/CollisionManager';
import { BasicRole } from '../BasicRole';
import { ModifyPosRotMesh } from '../prop/ModifyPosRotMesh';
const { ccclass, property } = _decorator;

@ccclass('GrenadesBullet')
export class GrenadesBullet extends BasicComponet {

    pos = v3();
    rot = v3();
    lineVec = v3();
    atkRate = 0;

    modfiyMsCmp: ModifyPosRotMesh = null;

    maxDist = 5;
    curDist = 0;
    isFinish = false;

    setData(d: { pos: Vec3, rot: Vec3, lineVec: Vec3, rotSpd: Vec3, atkRate: number }) {
        this.modfiyMsCmp = this.node.getComponent(ModifyPosRotMesh);

        this.node.setPosition(Vec3.ZERO);
        this.node.eulerAngles = Vec3.ZERO;

        this.lineVec.set(d.lineVec);
        this.pos.set(d.pos);
        this.atkRate = d.atkRate;
        this.rot.set(Vec3.ZERO);
        this.curDist = 0;
        this.isFinish = false;
    }

    tmpP = v3();
    maxH = 5;
    rotSpd = v3(5, 5, 5);

    update(dt) {
        if (GlobalTmpData.Game.isPause || this.isFinish) return;
        this.tmpP.set(this.lineVec).multiplyScalar(dt);
        this.curDist += this.tmpP.length();

        this.pos.add(this.tmpP);

        //计算高度
        this.pos.y = Math.sin(3.14 * (this.curDist / this.maxDist)) * this.maxH;

        this.tmpP.set(this.rotSpd).multiplyScalar(dt);
        this.rot.add(this.tmpP);

        this.modfiyMsCmp.setTransData(this.pos, this.rot, 2 + this.pos.y * 0.08);

        if (this.curDist >= this.maxDist) {
            this.isFinish = true;
            this.onBoom();
        }
    }

    onBoom() {
        //检测范围内的所有角色
        const cfg = WeaponCfg[GlobalEnum.WeaponType.Grenades];
        let res: { [groupId: number]: number[] } = {};

        if (CollisionTools.getCollInfoByPos(this.pos, cfg.boomRadius, res, [ColliderGroup.Enemy])) {
            let boomAtk = cfg.atk;
            let maxRadius = cfg.boomRadius * cfg.boomRadius;

            for (const key in res) {
                const arr = res[key];
                for (let i = 0; i < arr.length; i++) {
                    const cld = arr[i];
                    const target = CollisionManager.getColilderByColId(cld).targetCmp as BasicRole;
                    if (target && target.hp > 0) {
                        //检测距离
                        let len = this.tmpP.set(this.pos).subtract(target.curPos).lengthSqr();
                        if (len <= maxRadius) {
                            setTimeout(() => {
                                target.byHit(boomAtk);
                            }, 0);
                        }
                    }

                }
            }
        }
        //爆炸效果
        this.emit(EventTypes.EffectEvents.show3DTo2DEffect, { t: GlobalEnum.Effect3dType.Effect_jz_rocketboom, p: this.pos });

        setTimeout(() => {
            GlobalPool.put(this.node);
        }, 0);
    }


}

