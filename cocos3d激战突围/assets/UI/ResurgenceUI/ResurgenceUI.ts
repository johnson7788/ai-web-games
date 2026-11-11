import { _decorator, Component, Node, Label, Sprite, clamp01 } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { SDKSystem, PlatformType } from '../../Init/SystemSDK/SDKSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('ResurgenceUI')
export class ResurgenceUI extends BasicUI {

    @property(Node)
    videoBtn: Node = null;

    @property(Node)
    shareBtn: Node = null;

    @property(Node)
    shareBtn2: Node = null;

    public show(d?) {
        super.show(d);
        // this.resetTime();

        if(uniSdk.Global.isVivogame || uniSdk.Global.isOppogame) {
            uniSdk.showCustomAd(0, null, ()=>{
                uniSdk.showBanner();
            }, this);
        }

        switch (SDKSystem._curPlatform) {
            case PlatformType.PCMiniGame:
            case PlatformType.TTMiniGame:
                this.initTT();
                break;
            case PlatformType.WXMiniGame:
                //宝箱页面
                this.initWX();
                break;

            default:
                this.initTT();
                break;
        }
    }

    public hide(d?) {
        super.hide(d);
    };

    public update(dt) {
        // this.updateTime(dt);
    }

    //#region -------------WX-----------
    public initWX() {
        this.videoBtn.active = true;
        this.shareBtn.active = false;
        this.shareBtn2.active = false;
    }

    //#endregion

    //#region -------------TT-----------
    public initTT() {
        let n = StorageSystem.getData().userAssets.shareResuergenceNum;

        this.videoBtn.active = false;
        this.shareBtn.active = false;
        this.shareBtn2.active = false;
        //只有安卓
        if (n < 3 && uniSdk.BrowersUtils.isAndroid()) {
            //概率出分享
            if (Math.random() < 0.5) {
                this.videoBtn.active = true;
            } else {
                this.shareBtn.active = true;
                this.shareBtn2.active = true;
            }
        } else {
            //只弹视频
            this.videoBtn.active = true;
            this.shareBtn.active = false;
            this.shareBtn2.active = false;
        }
        this.isClickShare = false;
    }

    //#endregion

    // #region ----------------按钮---------
    // 关闭
    public onCloseClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        this._isFinish = true;
        this.emit(EventTypes.RoleEvents.CanceResurgence);
        UISystem.hideUI(UIEnum.ResurgenceUI);
    }
    //视频
    public onResurgenceClick() {
        //倒计时暂停
        this._isFinish = true;
        AudioSystem.playEffect(AudioEnum.BtnClick);

        this.emit(EventTypes.SDKEvents.ShowVideo, {
            success: () => {
                //观看视频成功
                this.emit(EventTypes.RoleEvents.Resurgence);
                UISystem.hideUI(UIEnum.ResurgenceUI);
            },
            fail: () => {
                this._isFinish = false;
                this.emit(EventTypes.GameEvents.GamePause);
            },
            cancel: () => {
                this._isFinish = false;
                this.emit(EventTypes.GameEvents.GamePause);
            },
        }, 3)
    }

    // TT分享录屏
    isClickShare = false;
    public shareBtnClick() {
        if (this.isClickShare) return;
        this.isClickShare = true;
        console.log('点击分享')
        //停止录屏
        this.emit(EventTypes.SDKEvents.StopRecord);
        setTimeout(() => {
            this.isClickShare = false;
            //分享
            this.emit(EventTypes.SDKEvents.ShareRecord,
                () => {
                    StorageSystem.setData((d) => {
                        d.userAssets.shareResuergenceNum++;
                        return d;
                    }, true);
                    //重新录制
                    this.emit(EventTypes.SDKEvents.StartRecord);

                    //观看视频成功 复活
                    this.emit(EventTypes.RoleEvents.Resurgence);
                    UISystem.hideUI(UIEnum.ResurgenceUI);
                },)
        }, 100);
    }

    // #endregion

    // #region -------------倒计时-------------
    @property(Sprite)
    protected progressSprite: Sprite = null;

    @property(Label)
    protected timeLabel: Label = null;
    private _curt = 0;
    private _isFinish = false;
    private _secend = 0;
    public resetTime() {
        this._curt = 5.99;
        this._secend = 5;
        this._isFinish = false;
        this.timeLabel.string = '5';
        this.progressSprite.fillRange = 1;
    }

    public updateTime(dt) {
        if (!this._isFinish) {
            this._curt -= dt;
            let _secend = Math.floor(this._curt);
            if (_secend <= 0) {
                this._isFinish = true;
                this.onFinish();
            } else {
                if (this._secend != _secend) {
                    this._secend = _secend;
                    //激活动画
                    this.timeLabel.node.active = false;
                    this.timeLabel.node.active = true;
                    //                     
                    console.log('_secend: ', _secend)
                }
                this.timeLabel.string = this._secend.toFixed(0);
            }
            this.progressSprite.fillRange = clamp01(this._secend / 5);
        }
    }

    private onFinish() {
        UISystem.hideUI(UIEnum.ResurgenceUI);
        //进入取消复活
        this.emit(EventTypes.RoleEvents.CanceResurgence);
    }

    // #endregion
}

