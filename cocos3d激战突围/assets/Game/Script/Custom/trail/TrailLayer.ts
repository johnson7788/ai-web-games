
import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { clog } from '../../../../Init/Tools/ColorLog';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { BasicLayer } from '../../Common/Basic/BasicLayer';
import { TrailMesh } from './TrailMesh';
const { ccclass, property } = _decorator;

@ccclass('TrailLayer')
export class TrailLayer extends BasicLayer {
    //根据宽度来分类
    protected meshRecs: { [type: number]: TrailMesh[] } = {};


    // #region -------------------------------层级生命周期------------

    /**初始化 只执行一次*/
    protected init() {

    };
    /**注册通过自定义事件管理器管理的事件  */
    protected onEvents() {
        this.on(EventTypes.EffectEvents.ShowTrail, this.onShowTrail, this);
        this.on(EventTypes.EffectEvents.HideTrail, this.onHideTrail, this);
    };
    /**设置状态、数据等, */
    public setData(data?: any) {

    };
    /**重置状态、数据等，子类实现 ,注销事件*/
    public reset() {
        //回收
        GlobalPool.putAllChildren(this.node);
        this.meshRecs = {};
    }
    //游戏中 update
    public customUpdate(dt: number) {
        for (const key in this.meshRecs) {
            const arr = this.meshRecs[key];
            for (let i = 0; i < arr.length; i++) {
                const ms = arr[i];
                if (ms && ms.node.active) {
                    ms.customUpdate(dt);
                }
            }
        }
    }
    public customLateUpdate(dt: number) {

    }

    // #endregion

    //#region ---------功能--------
    //拖尾配置 trailLen < 210;
    private trailCfg = {
        //冰
        0: { trailLen: 3, scale: 0.7, spd: 0.1, name: ' ' },
    }
    //创建拖尾
    protected createTrailMesh(trailType: number) {
        if (!this.meshRecs[trailType]) {
            this.meshRecs[trailType] = [];
        }
        const cfg = this.trailCfg[trailType];
        let mergeNum = Math.floor(TrailMesh.MAX_PARAM_LEN / cfg.trailLen);
        let d = { mergeNum: mergeNum, trailLen: cfg.trailLen, scale: cfg.scale };
        let ms = GlobalPool.get('trailMergeMesh', d);
        ms.parent = this.node;
        let cmp = ms.getComponent(TrailMesh);
        this.meshRecs[trailType].push(cmp);
        clog.warn('#TrailMesh:' + Object.keys(this.meshRecs).length);
        return cmp;
    }
    //#endregion

    //#region ----------事件
    protected onShowTrail(d: { trailType: number, followPos: Vec3, colorType?: number }) {
        let cmp: TrailMesh = null;
        if (this.meshRecs[d.trailType]) {
            const arr = this.meshRecs[d.trailType];
            for (let i = 0; i < arr.length; i++) {
                const ms = arr[i];
                if (ms && !ms.isFull) {
                    cmp = ms;
                    ms.node.active = true;
                    break;
                }
            }
        }
        if (!cmp) {
            cmp = this.createTrailMesh(d.trailType);
        }
        let spd = this.trailCfg[d.trailType].spd;
        cmp.showTrail(d.followPos, d.colorType, spd);
    }

    protected onHideTrail(d: { trailType: number, followPos: Vec3, }) {
        if (this.meshRecs[d.trailType]) {
            const arr = this.meshRecs[d.trailType];
            for (let i = 0; i < arr.length; i++) {
                const tms = arr[i];
                for (const key in tms.trailRecs) {
                    const rec = tms.trailRecs[key];
                    if (rec.followPos == d.followPos) {
                        rec.setReuse();
                        break;
                    }
                }
            }
        }
    }
    //#endregion
}
