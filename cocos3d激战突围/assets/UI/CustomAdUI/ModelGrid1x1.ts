import { _decorator, Component, Node, Widget } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('ModelGrid1x1')
export class ModelGrid1x1 extends Component {
    _adId = null;
    onEnable() {
        let wg = this.node.getComponent(Widget);
        wg && wg.updateAlignment();
        EventManager.emit(EventTypes.WXCustomAD.ShowGridAd, {
            p: this.node.position, cb: (id) => {
                this._adId = id;
            }
        })
    }

    onDisable() {
        EventManager.emit(EventTypes.WXCustomAD.HideAdByAdId, this._adId);
    }

}

