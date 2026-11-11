import { _decorator, Component, Node, Vec3, v3 } from 'cc';
import { BasicComponet } from '../../../Init/Basic/BasicComponet';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import GlobalPool from '../../../Init/Tools/GlobalPool';
import { BasicEffect } from '../Common/Basic/BasicEffect';
import { BasicLayer } from '../Common/Basic/BasicLayer';
import { InstanceFrameAnim } from './Effect/InstanceFrameAnim';

const { ccclass, property } = _decorator;
@ccclass('EffectLayer')
export class EffectLayer extends BasicLayer {

    // #region -------------------------------层级生命周期------------
    /**初始化 只执行一次*/
    protected init() {

    };
    /**注册通过自定义事件管理器管理的事件  */
    protected onEvents() {
        this.on(EventTypes.EffectEvents.showParticleEffect, this.onShowParticleEffect, this);
        this.on(EventTypes.EffectEvents.showFrameEffect, this.onShowFrameEffect, this);

        this.on(EventTypes.EffectEvents.showObjs, this.onShowObjs, this);


    };
    /**设置状态、数据等, */
    public setData(data?: any) {

    };
    /**重置状态、数据等，子类实现 ,注销事件*/
    public reset() {
        this.resetEffects();
    }

    public customUpdate(dt: number) {
        this.updateEffects(dt);
    }
    public customLateUpdate(dt: number) {

    }
    // #endregion

    //#region -----------------通用效果管理-------------
    private _effectRecs: { [id: string]: BasicEffect } = {};
    private resetEffects() {
        for (const key in this._effectRecs) {
            const rec = this._effectRecs[key];
            rec && rec.reset();
        }
        this._effectRecs = {};
    }

    private updateEffects(dt) {
        for (const key in this._effectRecs) {
            const rec = this._effectRecs[key];
            if (rec && rec.isFinish) {
                rec.reset();
                delete this._effectRecs[key];
            } else {
                rec.update(dt);
            }
        }
    }
    //#endregion

    //#region -----------------粒子效果--------------
    protected onShowParticleEffect(n: string, d: { p: Vec3, r?: Vec3, s?: Vec3 }) {
        let e = GlobalPool.get(n, d.p);
        e.parent = this.node;
        if (d.p) e.setPosition(d.p);
        if (d.r) e.eulerAngles = d.r;
        if (d.s) e.setScale(d.s);
    }

    protected onShowFrameEffect(n: string, p: Vec3) {
        let e = GlobalPool.get(n, p);
        e.parent = this.node;
        e.setPosition(Vec3.ZERO);
        e.eulerAngles = Vec3.ZERO;

        // let cmp = new InstanceFrameAnim(e);
        // cmp.setData(p);
        // this._effectRecs[e.uuid] = cmp;
    }

    protected onShowObjs(n: string, d: any) {
        let e = GlobalPool.get(n, d);
        e.parent = this.node;
    }

    //#endregion

}

