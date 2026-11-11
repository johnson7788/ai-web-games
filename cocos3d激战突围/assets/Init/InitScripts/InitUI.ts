import { _decorator, Component, Node, Label } from 'cc';
import EventManager from '../Managers/EventManager';
import { EventTypes } from '../Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('InitUI')
export class InitUI extends Component {

    onLoad() {
        EventManager.on(EventTypes.GameEvents.SetInitUIEnable, this.onSetInitUIEnable, this);
        uniSdk.setOwnerNameLabel(this.node.getChildByName("OwnerLabel").getComponent(Label));
    }

    public show(d?) {
        this.node.active = true;
    }

    public hide(d?) {
        this.node.active = false;
    };

    onSetInitUIEnable(isEnable) {
        if (undefined == isEnable) return;
        isEnable && this.show();
        !isEnable && this.hide();
    }
}

