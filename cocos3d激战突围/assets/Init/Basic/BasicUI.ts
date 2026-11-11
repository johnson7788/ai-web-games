import { _decorator, Component, Node } from 'cc';
import { BasicComponet } from './BasicComponet';
const { ccclass, property } = _decorator;

@ccclass('BasicUI')
export class BasicUI extends BasicComponet {

    public show(d?) {
        this.node.active = true;
        this.onEvents();
    }

    public hide(d?) {
        this.node.active = false;
        this.offEvents();
    };

}

