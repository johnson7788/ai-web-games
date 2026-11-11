import { _decorator, Component, Node, Label } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('FreeEnergyUI')
export class FreeEnergyUI extends BasicUI {

    private _awardNum = 0;
    hideCb = null;


    @property(Label)
    awardLabel: Label = null;

    public show(hideCb) {
        this.hideCb = hideCb;
        super.show();

        let goldRateLv = StorageSystem.getData().userAssets.props.GoldRateLv;
        let goldRate = GlobalConfig.RolePropCfg.getGoldRateByLv(goldRateLv);

        this._awardNum = Math.floor(GlobalConfig.Award.VideoAward * goldRate);

        this.awardLabel.string = this._awardNum.toFixed(0);
        EventManager.emit(EventTypes.GameEvents.GamePause);
    }

    public hide(d) {
        super.hide(d);
        EventManager.emit(EventTypes.GameEvents.GameResume);
        this.hideCb && this.hideCb();
        this.hideCb = null;
    }

    private saveAwards() {
        StorageSystem.setData((d) => {
            d.userAssets.asset += this._awardNum;
        }, true);
        StorageSystem.updateToAssets(true);
    }

    protected onCloseClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);

        UISystem.hideUI(UIEnum.FreeGoldUI);
    }

    protected onVideoClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        //视频成功之后
        this.emit(EventTypes.SDKEvents.ShowVideo, () => {
            this.saveAwards();
            UISystem.hideUI(UIEnum.FreeGoldUI);
        })
    }

}

