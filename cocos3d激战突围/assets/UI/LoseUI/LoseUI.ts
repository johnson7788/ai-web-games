import { _decorator, Component, Node, Label, clamp01 } from 'cc';
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
import { MoveVideoCmp } from '../WinUI/MoveVideoCmp';
const { ccclass, property } = _decorator;

@ccclass('LoseUI')
export class LoseUI extends BasicUI {

    public show(d) {
        super.show(d);
        UISystem.hideUI(UIEnum.LevelInfoUI);
        UISystem.showUI(UIEnum.PlayerAssetsUI);
        AudioSystem.playEffect(AudioEnum.Lose);

        if (this.shareBtn) {
            this.shareBtn.active = SDKSystem._curPlatform == PlatformType.TTMiniGame;
        }
        this.showAwards();
        this.showAd();


    }

    //#endregion ----------奖励---------
    @property(MoveVideoCmp)
    moveVideoCmp: MoveVideoCmp = null;

    private _awardNum = 0;
    private showAwards() {
        let goldRateLv = StorageSystem.getData().userAssets.props.GoldRateLv;
        let goldRate = GlobalConfig.RolePropCfg.getGoldRateByLv(goldRateLv);

        this._awardNum = Math.floor(GlobalConfig.Award.LoseAward * goldRate);
        this.moveVideoCmp.setData(this._awardNum);
    }
    private saveAwards() {
        if (this._awardNum > 0) {
            StorageSystem.setData((d) => {
                d.userAssets.asset += this._awardNum;
            }, true);
            StorageSystem.updateToAssets(true, true);
        }

        UISystem.hideUI(UIEnum.LoseUI);
        this.emit(EventTypes.GameEvents.SetLevelManagerEnable, false); //清除关卡场景
        UISystem.showUI(UIEnum.HomeUI);
    }

    //#region 

    // #region --------按钮----------
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
    //- 
    protected onCloseClick() {
        this.saveAwards();
    }

    @property(Node)
    shareBtn: Node = null;
    //分享
    protected onShareClick() {
        EventManager.emit(EventTypes.SDKEvents.ShareRecord, () => {
            this.shareBtn.active = false;
        });
    }

    //#endregion

    // #region --------广告----------
    private showAd() {

    }

    //#endregion
}

