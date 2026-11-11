import { _decorator, Component, Node, Widget } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('ModelHorizon')
export class ModelHorizon extends Component {
    _adId = null;
    @property
    adNum = 3;
    onEnable() {
        let wg = this.node.getComponent(Widget);
        wg && wg.updateAlignment();
        EventManager.emit(EventTypes.WXCustomAD.ShowHorizonAd, {
            p: this.node.position, num: this.adNum, cb: (id) => {
                this._adId = id;
            }
        })
    }

    onDisable() {
        EventManager.emit(EventTypes.WXCustomAD.HideAdByAdId, this._adId);
    }

}

