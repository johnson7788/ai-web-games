import { _decorator, Component, Node, Label } from 'cc';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('OnlineAwardCmp')
export class OnlineAwardCmp extends Component {

    @property(Label)
    onLineAward: Label = null;
    _award = 0;
    _cd = 1;

    onLoad() {
        this.onLineAward.string = this._award.toFixed(0);
        this.schedule(this.setAward, this._cd);
    }

    setAward() {
        let goldRateLv = StorageSystem.getData().userAssets.props.GoldRateLv;
        let goldRate = GlobalConfig.RolePropCfg.getGoldRateByLv(goldRateLv);

        this._award += Math.floor(goldRate * GlobalConfig.Award.OnlineAwardMin / 60);
        this.onLineAward.string = this._award.toFixed(0);
    }

    onShowOnLineAwardUI() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        UISystem.showUI(UIEnum.OnlineAwardUI, { awardNum: this._award });
        this._award = 0;
    }

}

