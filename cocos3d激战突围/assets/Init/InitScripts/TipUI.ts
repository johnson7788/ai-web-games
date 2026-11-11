import { _decorator, Component, Node, Label, v3, Tween, tween } from 'cc';
import EventManager from '../Managers/EventManager';
import { EventTypes } from '../Managers/EventTypes';
const { ccclass, property } = _decorator;

//全局提示UI
@ccclass('TipUI')
export class TipUI extends Component {
    @property(Node)
    protected tipNode: Node = null;
    protected tipLabel: Label = null;

    protected onLoad() {
        this.tipLabel = this.tipNode.getComponentInChildren(Label);
        this.tipLabel.string = '';
        this.tipNode.active = false;
        EventManager.on(EventTypes.GameEvents.ShowTips, this.onShowTips, this);
    }

    protected onShowTips(tip: string) {
        this.tipLabel.string = tip;
        this.tipNode.active = false;
        this.tipNode.active = true;
        this._cut = 0;
    }
    private _cd = 2;
    private _cut = 0;
    protected update(dt) {
        if (this.tipNode.active) {
            this._cut += dt;
            if (this._cut >= this._cd) {
                this._cut = 0;
                this.tipNode.active = false;
            }
        }

    }

}

