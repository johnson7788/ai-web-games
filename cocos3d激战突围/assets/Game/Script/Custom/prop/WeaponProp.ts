import { _decorator, Component, Node, Enum, Quat, Vec3, v3 } from 'cc';
import { GlobalConfig, WeaponCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { ColliderGroup } from '../../Common/VertCollison/CollisionManager';
import { BasicProp } from './BasicProp';
import { ModifyPosRotMesh } from './ModifyPosRotMesh';
const { ccclass, property } = _decorator;

@ccclass('WeaponProp')
export class WeaponProp extends BasicProp {

    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.ElectricSaw;

    effect: Node = null;

    initSub() {
        this.initAnim();
    }

    curPos = v3();
    rot = v3();
    curScale = 1;
    weaponType = 0;
    weaponId = -1;

    weapon: ModifyPosRotMesh = null;

    onEvents() {
        this.on(EventTypes.CurLevelEvents.HideWeaponProp, this.onHideWeaponProp, this);
    }

    setData(data?: { p: Vec3, r: Quat, d: { weaponType: number, weaponId: number }, parent?, }) {
        this.curPos.set(data.p);
        data.r.getEulerAngles(this.rot);
        this.weaponType = data.d.weaponType;
        this.weaponId = data.d.weaponId;

        this.node.parent = data.parent;
        this.node.setPosition(data.p);
        this.node.eulerAngles = this.rot;

        this.setCollider();

        //创建模型
        this.weapon && GlobalPool.put(this.weapon.node);
        let e = GlobalPool.get(GlobalEnum.WeaponType[this.weaponType]);
        e.parent = data.parent;

        this.weapon = e.getComponent(ModifyPosRotMesh);
        this.curScale = WeaponCfg[this.weaponType].propScale;

        this.setTransData();

        //粒子效果
        if (!this.effect) {
            this.effect = GlobalPool.get('Effect_IS_buff_prop_001');
            this.effect.setPosition(v3(0, 0.1, 0));
            this.effect.setParent(this.node);
        }
    }

    reset() {
        this.weapon && GlobalPool.put(this.weapon.node);
        this.weapon = null;
        this.resetAnim();
        super.reset();
    }

    customUpdate(dt) {
        super.customUpdate(dt);
        this.updateAnim(dt);
        this.setTransData();
    }
    tmpR = v3();
    setTransData() {
        this.tmpR.set(this.rot).multiplyScalar(0.01745);
        this.curPos.y = 0.5;
        this.weapon && this.weapon.setTransData(this.curPos, this.tmpR, this.curScale);
    }

    //#region ------------动画------------
    initAnim() {
    }

    resetAnim() {
    }

    updateAnim(dt) {
        this.rot.y += -180 * dt;
        if (this.isTriggerUsed) {
            GlobalPool.put(this.node);
        }
    }

    //#endregion

    //#region ------------碰撞------------
    //隐藏指定Id的武器
    onHideWeaponProp(id) {
        if (this.weaponId == id && !this.isTriggerUsed) {
            this.isTriggerUsed = true;
        }
    }

    setCollider() {

    }

    isTriggerUsed = false;
    resetCollider() {
        super.resetCollider();
        this.isTriggerUsed = false;
    }
    tmpP = v3();
    checkRadius = GlobalConfig.Player.checkRadius;
    checkCollistion() {
        //触发器
        if (!this.isTriggerUsed) {
            // this.collider && this.collider.checkPosFast(this.pos, this.onTriggerEnter.bind(this));
            let curDist = this.tmpP.set(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset).subtract(this.curPos).lengthSqr();
            if (curDist < this.checkRadius * this.checkRadius) {
                this.onTriggerEnter();
            }
        }
    }

    onTriggerEnter() {
        this.isTriggerUsed = true;

        //效果
        switch (this.weaponType) {
            case GlobalEnum.WeaponType.Drone:
                //无人机
                this.emit(EventTypes.CurLevelEvents.CreateDrones);

                break;
            default:
                //武器
                this.emit(EventTypes.RoleEvents.SetWeapon, this.weaponType);
                break;
        }

        //隐藏对应Id的道具
        EventManager.emit(EventTypes.CurLevelEvents.HideWeaponProp, this.weaponId);

        //道具效果
        let pos = v3(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset);
        EventManager.emit(EventTypes.EffectEvents.showParticleEffect, GlobalEnum.Effect3dType.Effect_IS_buff_get_001,
            { p: pos });
    }

    //#endregion
}
