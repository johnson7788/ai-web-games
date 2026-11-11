import { _decorator, Component, Node, Label, clamp } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';

const { ccclass, property } = _decorator;

@ccclass('FinishAwardBoxUI')
export class FinishAwardBoxUI extends BasicUI {

    @property(Node)
    boxLayer: Node = null;

    @property
    maxKeyNum = 3;

    @property(Label)
    curKeyLabel: Label = null;

    hideCb = null;

    onLoad() {
        this.boxLayer.children.forEach(e => {
            e.on(Node.EventType.TOUCH_END, this.onBoxTouched, this);
        })
    }

    _keyNum = 0;
    _awardCfg = [50, 150, 200, 250, 300, 300, 400, 500, 1000];
    _curAwards = [];
    show(hideCb) {
        this.hideCb = hideCb;
        super.show();
        //设置宝箱
        this._curAwards = [];
        this._awardCfg.forEach(e => { this._curAwards.push(e) });

        for (let i = 0; i < this.boxLayer.children.length; i++) {
            const e = this.boxLayer.children[i];
            e.getChildByName('key').active = true;
            e.getChildByName('video').active = false;
            e.getChildByName('open').active = false;
            e.getChildByName('close').active = true;
        }
        this._keyNum = this.maxKeyNum;
        this.curKeyLabel.string = 'x' + this._keyNum.toFixed(0);
    }

    hide() {
        super.hide();

        this.hideCb && this.hideCb();
        this.hideCb = null;
    }

    onBoxTouched(e) {
        let node = e.target;
        let open = node.getChildByName('open');
        if (open.active) return;

        let video = node.getChildByName('video');
        if (video.active) {
            this.emit(EventTypes.SDKEvents.ShowVideo, () => {
                this.saveAward();
                node.getChildByName('open').active = true;
                node.getChildByName('close').active = false;
            })
        } else {
            this._keyNum--;
            this._keyNum = clamp(this._keyNum, 0, this.maxKeyNum);
            this.curKeyLabel.string = 'x' + this._keyNum.toFixed(0);

            this.saveAward();
            node.getChildByName('open').active = true;
            node.getChildByName('close').active = false;
        }

        //刷新
        for (let i = 0; i < this.boxLayer.children.length; i++) {
            const e = this.boxLayer.children[i];
            const key = e.getChildByName('key');
            const video = e.getChildByName('video');
            const open = e.getChildByName('open');
            // const close = e.getChildByName('close');
            if (!open.active) {
                video.active = this._keyNum <= 0;
                key.active = this._keyNum > 0;
            }
        }
    }

    saveAward() {
        let lv = StorageSystem.getData().levelAssets.curLv;
        let goldRate = (lv * 0.2 + 1); //根据关卡递增
        let gold = 0;
        let randId = Math.floor(Math.random() * this._curAwards.length);
        //    
        gold = this._curAwards[randId];
        this._curAwards.splice(randId, 1);

        gold = Math.floor(goldRate * gold);

        StorageSystem.setData((d) => {
            d.userAssets.asset += gold;
        }, true);
        StorageSystem.updateToAssets(true);

        this.emit(EventTypes.GameEvents.ShowTips, '获得' + gold + '金钱');
    }

    onCloseClick() {
        UISystem.hideUI(UIEnum.FinishAwardBoxUI);
    }

}

