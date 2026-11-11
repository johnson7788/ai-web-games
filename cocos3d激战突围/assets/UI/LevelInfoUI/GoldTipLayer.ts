import { _decorator, Component, Node, Vec3, Camera, v3, tween, Tween, Label } from 'cc';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import GlobalData from '../../Init/Config/GlobalData';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import GlobalPool from '../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('GoldTipLayer')
export class GoldTipLayer extends Component {
    cameraUI: Camera = null;
    _tipName = 'goldTip';
    _tipRecs: { [id: number]: GoldTipCmp } = {};

    onLoad() {
        GlobalPool.preCreate(this._tipName, 10);
        EventManager.on(EventTypes.UIEvents.AddGoldEffect, this.onAddGoldEffect, this);
        this.cameraUI = GlobalData.get(GlobalEnum.GlobalDataType.Camera3D);
    }

    onEnable() {
        this.reset();
    }

    reset() {
        GlobalPool.putAllChildren(this.node);
        this._tipRecs = {};
    }

    update(dt) {
        for (const key in this._tipRecs) {
            const e = this._tipRecs[key];
            if (!e || e.isFinish) {
                e.node && GlobalPool.put(e.node);
                delete this._tipRecs[key];
            } else {
                e.update(dt);
            }
        }
    }

    tmpP = v3();
    //显示
    onAddGoldEffect(d: { wpos: Vec3, gold: number, isAnim: boolean }) {
        let gold = Math.round(d.gold) || 0;

        this.cameraUI.convertToUINode(d.wpos, this.node, this.tmpP);
        this.tmpP.y += 100;
        //
        let goldTip = GlobalPool.get(this._tipName);
        goldTip.parent = this.node;
        let cmp = new GoldTipCmp(goldTip, this.tmpP, gold);
        this._tipRecs[cmp.id] = cmp;
    }

}

export class GoldTipCmp {
    static _ID = 0;
    id = 0;
    node: Node;
    p: Vec3 = v3();
    isFinish = false;

    constructor(n: Node, p: Vec3, g: number) {
        this.node = n;
        let label = n.getComponentInChildren(Label);
        label.string = g.toFixed(0);

        this.id = GoldTipCmp._ID++;
        this.p.set(p);
        this.showAnim();
    }

    showAnim() {
        this.node.setPosition(this.p);
        tween(this.p).by(0.8, { y: 200 }, { easing: 'sineOut' }).call(() => {
            this.isFinish = true;
        }).start();
    }

    update(dt) {
        this.node.setPosition(this.p);
    }

}

