import { _decorator, Component, Node, Widget } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('ModelVertical1X3')
export class ModelVertical1X3 extends Component {
    _adId = null;
    @property
    adNum = 3;
    onEnable() {
        let wg = this.node.getComponent(Widget);
        wg && wg.updateAlignment();
        EventManager.emit(EventTypes.WXCustomAD.ShowVerticalAd, {
            p: this.node.position, num: this.adNum, cb: (id) => {
                this._adId = id;
            }
        })
    }

    onDisable() {
        EventManager.emit(EventTypes.WXCustomAD.HideAdByAdId, this._adId);
    }

}

