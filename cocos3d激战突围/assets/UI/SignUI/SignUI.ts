import { _decorator, Component, Node, Label, UIOpacity, color, Sprite, Enum } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { PlatformType, SDKSystem } from '../../Init/SystemSDK/SDKSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('SignUI')
export class SignUI extends BasicUI {

    _hideCb = null;
    public show(d?: { hideCb }) {
        if (d && d.hideCb) {
            this._hideCb = d.hideCb;
        }

        super.show(d);
        this.setItems();
        this.showNativeAd();
    }

    public hide(d?) {
        super.hide(d);
        this._hideCb && this._hideCb();
        this._hideCb = null;
    };

    // #region ----------------按钮---------
    // 关闭
    public onCloseClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        UISystem.hideUI(UIEnum.SignUI);
    }
    public onVideoClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        //视频成功后
        this.emit(EventTypes.SDKEvents.ShowVideo, () => {
            for (let i = 0; i < this._items.length; i++) {
                const e = this._items[i];
                if (e.isChoose || e.isGet && !e.isVideoGet) {
                    e.onClick(true);
                    break;
                }
            }
            StorageSystem.setData((d) => {
                d.userAssets.isDoubleSign = true;
                return d;
            }, true)

            this.normalBtn.active = false;
            this.videoBtn.active = false;
        });
    }
    public onNormalClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        for (let i = 0; i < this._items.length; i++) {
            const e = this._items[i];
            if (e.isChoose) {
                e.onClick(false);
                break;
            }
        }
        this.normalBtn.active = false;
    }

    // #endregion

    // #region ---------------签到逻辑--------

    @property(Node)
    protected normalBtn: Node = null;
    @property(Node)
    protected videoBtn: Node = null;

    @property(Node)
    protected signItems: Node = null;
    private _items: SignItem[] = [];

    private setItems() {
        if (this._items.length <= 0) {
            for (let i = 0; i < this.signItems.children.length; i++) {
                const e = this.signItems.children[i];
                let item = new SignItem(e, i, GlobalConfig.SignCfg[i]);
                this._items.push(item);
            }
        }
        let userAssets = StorageSystem.getData().userAssets;
        let signData = userAssets.signData;
        let signCount = signData.count;
        //判断当天是否签到
        let d1 = new Date(signData.lastTime);
        let d2 = new Date();
        let _isChecked = d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate();
        // _isChecked = false;//test;     
        // signCount = 6; //test;  

        if (!_isChecked) {
            StorageSystem.setData((d) => {
                d.userAssets.isDoubleSign = false;
                return d;
            })
        }

        this.normalBtn.active = !_isChecked;
        this.videoBtn.active = !userAssets.isDoubleSign;
        let isVideoGet = userAssets.isDoubleSign;
        //前一天
        let lastDayId = signCount % 7;

        if (_isChecked && lastDayId == 6) {
            //第7天已签到 当前显示不刷新循环
            for (let n = 0; n < this._items.length; n++) {
                const item = this._items[n];
                item.setData(true, isVideoGet, false);
            }
        } else {
            if (lastDayId == 6) {
                lastDayId = -1;
            }
            //设置数据
            for (let n = 0; n < this._items.length; n++) {
                const item = this._items[n];
                if (n <= lastDayId) {
                    item.setData(true, isVideoGet, false);
                } else {
                    let isChoose = n == (lastDayId + 1) && !_isChecked;
                    item.setData(false, isVideoGet, isChoose)
                }
            }
        }

    }

    //    #endregion


    // #region ---------------第二天显示原生广告--------
    protected showNativeAd() {
        // if (SDKSystem._curPlatform != PlatformType.WXMiniGame) {
        //     let signData = StorageSystem.getData().userAssets.signData;
        //     let signCount = signData.count;
        //     if (signCount >= 0) {
        //         this.emit(EventTypes.SDKEvents.ShowCustomAd, 0);
        //     }
        // }
    }

    // #endregion
}


export class SignItem {
    node: Node = null;
    chooseMark: Node = null;
    getMark: Node = null;
    awardLabel: Label = null;
    awardOpacity: UIOpacity = null;

    isVideoGet = false;
    isGet = false;
    isChoose = false;
    awardNum = 0;
    awardType = 0;
    dayId = 0;

    constructor(node: Node, dayId: number, award: { awardNum: number, type: number }) {
        this.node = node;
        this.chooseMark = node.getChildByName('chooseMark');
        this.getMark = node.getChildByName('getMark');
        this.awardOpacity = node.getChildByName('award').getComponent(UIOpacity);
        this.awardLabel = node.getChildByName('award').getComponentInChildren(Label);

        this.awardNum = award.awardNum;
        this.awardType = award.type;
        this.dayId = dayId;

        this.awardLabel.string = award.awardNum.toFixed(0);

    }
    setData(isGet: boolean, isVideoGet: boolean, isChoose: boolean,) {
        this.isChoose = isChoose;
        this.isGet = isGet;
        this.isVideoGet = isVideoGet;
        this.chooseMark.active = this.isChoose;
        this.getMark.active = this.isGet;
        this.awardOpacity.opacity = this.isGet ? 200 : 255;

    }

    onClick(isVideo: boolean) {
        if ((!this.isGet && this.isChoose) ||
            (isVideo && this.isGet && !this.isVideoGet && !this.isChoose)) {
            this.awardNum *= isVideo ? 2 : 1;
            let delay = 1000;
            switch (this.awardType) {
                case GlobalEnum.AwardType.Asset:
                    //获得奖励
                    StorageSystem.setData((d) => {
                        d.userAssets.asset += this.awardNum;

                        let signCount = d.userAssets.signData.count + 1;
                        d.userAssets.signData.count = signCount;
                        d.userAssets.signData.lastTime = Date.now();
                    }, true);
                    StorageSystem.updateToAssets(true, true);
                    break;
                case GlobalEnum.AwardType.Tip:
                    //获得奖励
                    StorageSystem.setData((d) => {
                        d.userAssets.tipNum += this.awardNum;

                        let signCount = d.userAssets.signData.count + 1;
                        d.userAssets.signData.count = signCount;
                        d.userAssets.signData.lastTime = Date.now();
                    }, true);
                    EventManager.emit(EventTypes.GameEvents.ShowTips, '恭喜获得' + this.awardNum + '现金!');
                    delay = 500;
                    break;
                case GlobalEnum.AwardType.Skin:
                    //获得奖励
                    StorageSystem.setData((d) => {
                        //默认皮肤数量=3
                        let skinId = 1; //飞机皮肤
                        if (d.userAssets.skin.unlock.indexOf(skinId) < 0) {
                            d.userAssets.skin.unlock.push(skinId);
                        }
                        d.userAssets.skin.choose = skinId;

                        let signCount = d.userAssets.signData.count + 1;
                        d.userAssets.signData.count = signCount;
                        d.userAssets.signData.lastTime = Date.now();
                    }, true);
                    delay = 200;

                    EventManager.emit(EventTypes.GameEvents.ShowTips, '恭喜获得新皮肤!');
                    break;
                default:
                    break;
            }

            this.isChoose = false;
            this.isGet = true;
            this.isVideoGet = isVideo;
            this.chooseMark.active = false;
            this.getMark.active = true;
            this.awardOpacity.opacity = 200;

            setTimeout(() => {
                UISystem.hideUI(UIEnum.SignUI);
            }, delay);
        }
    }



}
