import { _decorator, Component, Node } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('TipAnimCmp')
export class TipAnimCmp extends Component {
    @property(Node)
    animNode: Node = null;
    _isTouched = false;
    onLoad() {
        this.animNode.active = false;
        EventManager.on(EventTypes.GuideEvents.ShowGuideAnim, this.onShowGuideAnim, this);
        EventManager.on(EventTypes.TouchEvents.TouchStart, this.onTouchStart, this);
    }

    onEnable() {
        // this.animNode.active = !this._isTouched;
    }

    onShowGuideAnim() {
        this.animNode.active = !this._isTouched;
    }

    onTouchStart() {
        if (!this.animNode.active) return;
        this.animNode.active = false;
        this._isTouched = true;
    }


}

