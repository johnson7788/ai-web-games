import { _decorator, Component, Node, Vec2, Vec3, Quat, v2, v3, quat } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import { GlobalConfig } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { StorageSystem } from '../../../../Init/SystemStorage/StorageSystem';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { BasicLayer } from '../../Common/Basic/BasicLayer';
import { BasicProp } from './BasicProp';
import { Drone } from './Drone';
const { ccclass, property } = _decorator;

@ccclass('PropsLayer')
export class PropsLayer extends BasicLayer {
    static _IncreaceID = 0;
    static _weaponID = 0;
    // #region -------------------------------层级生命周期------------
    /**初始化 只执行一次*/
    protected init() {

    };
    /**注册通过自定义事件管理器管理的事件  */
    protected onEvents() {
        this.on(EventTypes.CurLevelEvents.CreateProps, this.onCreateProps, this);
        this.on(EventTypes.CurLevelEvents.CreateDrones, this.onCreateDrones, this);
    };
    /**设置状态、数据等, */
    public setData(data?: any) {
        PropsLayer._IncreaceID = 0;
        PropsLayer._weaponID = 0;
        this.setDrones();
    };
    /**重置状态、数据等，子类实现 ,注销事件*/
    public reset() {
        this.resetProps();
        this.resetDrones();
    }
    //游戏中 update
    public customUpdate(dt: number) {
        this.updateProps(dt);
        this.updateDrones(dt);
    }
    public customLateUpdate(dt: number) {
        this.lateUpdateProps(dt);
        this.lateUpdateDrones(dt);
    }
    // #endregion

    //#region -----------------------------创建道具-------------
    _allProps: { [uuid: string]: BasicProp } = {}
    resetProps() {
        for (const key in this._allProps) {
            const e = this._allProps[key];
            e.reset();
        }
        this._allProps = {};
    }
    //创建道具
    createProp(n: string, data: { p: Vec3, r: Quat, d: any, parent?}) {
        data.parent = this.node;
        let e = GlobalPool.get(n, data);
        let cmp = e.getComponent(BasicProp);
        this._allProps[e.uuid] = cmp;
    }

    propSize = v2(15, 15);
    updateProps(dt) {

        const p = GlobalTmpData.Player.wpos;

        const maxX = this.propSize.x * 0.5 + GlobalConfig.RunPropSize.x * 0.5;
        const maxZ = this.propSize.y * 0.5 + GlobalConfig.RunPropSize.y * 0.5;

        for (const key in this._allProps) {
            const e = this._allProps[key];
            if (e && e.node.active) {
                //距离判断-超出范围不运行
                if (Math.abs(p.x - e.node.worldPosition.x) <= maxX &&
                    Math.abs(p.z - e.node.worldPosition.z) <= maxZ) {
                    e.show();
                    e.customUpdate(dt);
                } else {
                    e.hide();
                }
            } else {
                delete this._allProps[key];
            }
        }
    }

    lateUpdateProps(dt) {
        for (const key in this._allProps) {
            const e = this._allProps[key];
            if (e && e.node.active) {
                e.customLateUpdate(dt);
            } else {
                delete this._allProps[key];
            }
        }
    }

    //#endregion

    //#region -----------------------------无人机类型-------
    _allDrones: { [uuid: string]: Drone } = {};
    _droneCount = 0;

    setDrones() {
        let unlockGoods = StorageSystem.getData().userAssets.unlockGoods;
        if (unlockGoods.indexOf(GlobalEnum.WeaponType.Drone) >= 0) {
            this.createDrone();
        }
    }

    resetDrones() {
        for (const key in this._allDrones) {
            const e = this._allDrones[key];
            e.reset();
        }
        this._allDrones = {};
        this._droneCount = 0;
    }

    tmpP = v3();
    createDrone() {
        let e = GlobalPool.get('Drone');
        e.parent = this.node;
        e.setPosition(Vec3.ZERO);
        e.eulerAngles = Vec3.ZERO;
        let cmp = new Drone(e);
        cmp.init();
        this._allDrones[e.uuid] = cmp;
        this._droneCount++;

        //设置偏移
        let width = 10;
        let stepW = width / (this._droneCount + 1);
        let i = 0;

        for (const key in this._allDrones) {
            const e = this._allDrones[key];
            //计算位置偏移
            e.offsetX = (i + 1) * stepW - width / 2;
            i++;
        }

        if (this._droneCount == 1) {
            cmp.offsetX = -3;
        }
    }

    updateDrones(dt) {
        for (const key in this._allDrones) {
            const e = this._allDrones[key];
            if (e && e.node.active) {
                e.customUpdate(dt);
            } else {
                delete this._allDrones[key];
            }
        }
    }

    lateUpdateDrones(dt) {

    }

    //#endregion

    //#region -----------------------------事件-------------
    onCreateProps(n: string, d: { p: Vec3, r: Quat, d: any }) {
        this.createProp(n, d);
    }
    onCreateDrones() {
        this.createDrone();
    }

    //#endregion

}

