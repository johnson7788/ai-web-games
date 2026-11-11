import { _decorator, Component, Node, UI, Label, Game, clamp01, Sprite, clamp } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { GlobalTmpData } from '../../Init/Config/GlobalTmpData';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { SDKSystem, PlatformType } from '../../Init/SystemSDK/SDKSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
import { TurntableUI } from '../TurntableUI/TurntableUI';
import { MoveVideoCmp } from './MoveVideoCmp';
const { ccclass, property } = _decorator;

@ccclass('WinUI')
export class WinUI extends BasicUI {

    public show() {
        super.show();
        UISystem.hideUI(UIEnum.LevelInfoUI);
        // UISystem.showUI(UIEnum.PlayerAssetsUI);
        AudioSystem.playEffect(AudioEnum.Win);

        if(uniSdk.Global.isVivogame || uniSdk.Global.isOppogame) {
            uniSdk.showCustomAd(0, null, ()=>{
                uniSdk.showBanner();
            }, this);
        }

        //
        this.showAwards();
        this.showAd();
        if (this.shareBtn) {
            this.shareBtn.active = SDKSystem._curPlatform == PlatformType.TTMiniGame;
        }
        this.showPopAwardUI();

    }


    // #region --------奖励--------- 
    @property(MoveVideoCmp)
    moveVideoCmp: MoveVideoCmp = null;

    private _awardNum = 0;
    private showAwards() {
        const data = StorageSystem.getData();
        let goldRateLv = data.userAssets.props.GoldRateLv;
        let goldRate = GlobalConfig.RolePropCfg.getGoldRateByLv(goldRateLv);

        this._awardNum = Math.floor((GlobalConfig.Award.WinAward + (data.levelAssets.curLv - 1) * GlobalConfig.Award.WinLvStep) * goldRate);
        this.moveVideoCmp.setData(this._awardNum);
    }

    private saveAwards() {
        if (this._awardNum > 0) {
            StorageSystem.setData((d) => {
                d.userAssets.asset += this._awardNum;
            }, true);
            StorageSystem.updateToAssets(true, true);
        }

        UISystem.hideUI(UIEnum.WinUI);
        this.emit(EventTypes.GameEvents.SetLevelManagerEnable, false); //清除关卡场景
        UISystem.showUI(UIEnum.HomeUI);
    }
    //  #endregion

    // #region --------按钮--------- 

    //多倍领取
    protected onVideoClick() {
        this.moveVideoCmp.stopMove();
        this.emit(EventTypes.SDKEvents.ShowVideo, {
            success: () => {
                //观看视频成功
                this._awardNum *= this.moveVideoCmp.curAwardRate;
                this.onCloseClick();
            },
            fail: () => {
                this.moveVideoCmp.resumeMove();
            },
            cancel: () => {
                this.moveVideoCmp.resumeMove();
            },
        })
    }
    //直接关闭-普通领取
    protected onCloseClick() {
        this.saveAwards();
    }


    @property(Node)
    shareBtn: Node = null;

    //分享按钮
    protected onShareClick() {
        EventManager.emit(EventTypes.SDKEvents.ShareRecord, () => {
            this.shareBtn.active = false;
        });
    }

    // #endregion

    // #region --------弹出奖励----
    count = 0;
    showPopAwardUI() {
        this.count++;
        GlobalTmpData.UIData.isShowTurnTableUI = false;

        switch (SDKSystem._curPlatform) {
            case PlatformType.WXMiniGame:
                if (this.count % 3 == 0) {
                    GlobalTmpData.UIData.isShowTurnTableUI = true;
                }
                break;
            case PlatformType.TTMiniGame:
                if (this.count % 2 == 0) {
                    GlobalTmpData.UIData.isShowTurnTableUI = true;
                }
                break;
            default:
                break;
        }


    }

    // #endregion

    // #region --------广告----------
    private showAd() {

    }

    //#endregion
}


