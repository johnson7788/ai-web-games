import { _decorator, Component, Node, Label } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('OnlineAwardUI')
export class OnlineAwardUI extends BasicUI {

    _hideCb = null;

    public show(d?: { awardNum: number, }) {
        super.show(d);
        this.setAward(d);
    }

    public hide(d?) {
        super.hide(d);
    };

    public onCloseClick() {
        UISystem.hideUI(UIEnum.OnlineAwardUI);
        StorageSystem.setData((d) => {
            d.userAssets.asset += Math.floor(this.awardNum);
        }, true);
        StorageSystem.updateToAssets(true, false);
    }

    public onVidoClick() {
        //观看视频
        this.emit(EventTypes.SDKEvents.ShowVideo, () => {
            //观看视频成功
            UISystem.hideUI(UIEnum.OnlineAwardUI);
            StorageSystem.setData((d) => {
                d.userAssets.asset += Math.floor(this.awardNum * 2);
            }, true);
            StorageSystem.updateToAssets(true, false);
        },)

    }

    // #region ------设置数据------
    private awardNum = 0;
    @property(Label)
    protected awardLabel: Label = null;

    private setAward(d: { awardNum: number }) {
        this.awardNum = d.awardNum || 0;
        this.awardLabel.string = d.awardNum.toFixed(0);
    }

    // #endregion

}

