import { _decorator, Component, Node, v3, Tween, tween, Label, Button } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('TurntableUI')
export class TurntableUI extends BasicUI {

    onLoad() {
    }

    public show(d?) {
        super.show(d);

        this.initTable();
        this.setTable();
    }

    public hide(d?) {
        super.hide(d);
    };

    // #region ----------------按钮---------
    // 关闭
    public onCloseClick() {
        UISystem.hideUI(UIEnum.TurntableUI);
    }
    // 抽奖
    public onRunTableClick() {
        let d = StorageSystem.getData();
        if (d.userAssets.turntableNum <= 0) {
            //观看视频后
            this.emit(EventTypes.SDKEvents.ShowVideo, () => {
                this.runTableAnim();
            })
        } else {
            StorageSystem.setData((d) => {
                d.userAssets.turntableNum--;
            }, true);
            this.runTableAnim();
        }
        this.checkFreeNum();
    }

    // #endregion

    // #region ----------------转盘逻辑--------------
    @property(Node)
    protected turnPanel: Node = null;
    @property(Node)
    protected table: Node = null;
    @property(Node)
    protected runBtn: Node = null;
    @property(Button)
    protected hideBtns: Button[] = []; //转盘运行时需要隐藏的节点
    @property(Label)
    protected tipLabel: Label = null;

    private _ang = v3();
    private _labelArr: Label[] = [];
    private _cfg = [];

    public initTable() {
        //每天增加一次免费

        //初始化概率
        if (this._cfg.length == 0) {
            let i = 0;
            for (const key in TurntableCfg) {
                this._cfg[i] = TurntableCfg[key].rate;
                i++;
            }
        }
        //获取label
        if (this._labelArr.length == 0) {
            let arr = this.table.getComponentsInChildren(Label);
            for (let i = 0; i < arr.length; i++) {
                const e = arr[i];
                e.string = TurntableCfg[i].val;
            }
        }

        this.checkFreeNum();
        this.hideBtns.forEach(e => { e.enabled = true });
    }

    public setTable() {
        this.turnPanel.eulerAngles = this._ang;
    }
    //检测免费次数-切换按钮
    private checkFreeNum() {

        let d = StorageSystem.getData();
        let videoTip = this.runBtn.getChildByName('videoIco');
        videoTip.active = d.userAssets.turntableNum <= 0;
        // this.tipLabel.string = d.userAssets.turntableNum.toFixed(0);
    }

    //随机获取指定的奖励
    private getRandItemId() {
        let arr: { id: number, rate: number }[] = [];
        for (let i = 0; i < this._cfg.length; i++) {
            arr.push({ id: i, rate: this._cfg[i] });
        }
        //从小到大排序
        arr.sort((a, b) => a.rate - b.rate);

        let rate = 0;
        let randRate = Math.random();
        let itemId = 0;
        for (let n = 0; n < arr.length; n++) {
            const e = arr[n];
            rate += e.rate;
            if (randRate <= rate) {
                itemId = e.id;
                break;
            }
        }
        console.log('====转盘奖励:' + itemId + ' ' + TurntableCfg[itemId].val);
        return itemId;
    }

    //执行动画/指定转到某个物品
    private runTableAnim(itemId?: number) {
        // this.emit(EventType.Common.AudioEvent.playEffect, GlobalEnum.AudioClip.spin);
        this.hideBtns.forEach(e => { e.enabled = false });

        if (itemId == undefined) {
            itemId = this.getRandItemId();
        }
        // this.resetSpin();
        Tween.stopAllByTarget(this._ang);
        //
        let lastAng = this.turnPanel.eulerAngles.z;
        lastAng = (lastAng + 360) % 360;
        this._ang.set(0, 0, lastAng);
        //计算目标角度    
        let toAng = -(itemId * 45 + 22.5);
        //放大旋转次数
        toAng += 360 * 8;

        tween(this._ang).to(3, { z: toAng }, {
            easing: 'sineInOut', onUpdate: () => {
                this.turnPanel.eulerAngles = this._ang;
            }
        }).call(() => {
            this.runFinished(itemId);
        }).start();
    }
    //动画结束->展示奖励
    private runFinished(itemId: number) {
        this.hideBtns.forEach(e => { e.enabled = true });

        let award = TurntableCfg[itemId].val;
        let goldRateLv = StorageSystem.getData().userAssets.props.GoldRateLv;
        let goldRate = GlobalConfig.RolePropCfg.getGoldRateByLv(goldRateLv);
        award = Math.floor(award * goldRate);

        UISystem.showUI(UIEnum.AwardUI, { awardNum: award });
    }
    // #endregion



}
export enum TableAwardType {
    Times = 0,  //次数    
    Gold, //金币
}
//顺序和item排列一致
export const TurntableCfg = {
    0: { awardType: 1, val: 1000, rate: 0.15 },
    1: { awardType: 1, val: 2000, rate: 0 },
    2: { awardType: 1, val: 500, rate: 0.16 },
    3: { awardType: 1, val: 1500, rate: 0.1 },
    4: { awardType: 1, val: 2000, rate: 0.05 },
    5: { awardType: 1, val: 500, rate: 0.16 },
    6: { awardType: 1, val: 2000, rate: 0 },
    7: { awardType: 1, val: 500, rate: 0.38 },
}