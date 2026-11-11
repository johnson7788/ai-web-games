import { _decorator, Component, Node, Tween, tween, UIOpacity, v3 } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('CutEnergyAnim')
export class CutEnergyAnim extends Component {

    onLoad() {
        EventManager.on(EventTypes.UIEvents.ShowCutEnergyAnim, this.onShowCutEnergyAnim, this);
    }

    onEnable() {
        this.touchMask.active = false;
        this.energy.active = false;
    }

    update(dt: number) {

    }

    @property(Node)
    touchMask: Node = null;

    @property(Node)
    energy: Node = null;

    energyOpacity: UIOpacity = null;
    posAnim = v3();
    opAnim = v3();
    //扣除体力动画
    private onShowCutEnergyAnim(cb) {
        this.energy.active = true;
        this.energyOpacity = this.energy.getComponent(UIOpacity);
        this.posAnim.set(0, 0, 0);
        this.opAnim.set(255, 0, 0);

        this.energy.setPosition(this.posAnim);
        this.energyOpacity.opacity = this.opAnim.x;

        Tween.stopAllByTarget(this.posAnim);
        Tween.stopAllByTarget(this.opAnim);

        this.touchMask.active = true;

        let t = 0.5;
        tween(this.posAnim).to(t, { y: 150 }, {
            easing: 'sineOut', onUpdate: () => {
                this.energy.setPosition(this.posAnim);
            }
        },).call(() => {
            this.touchMask.active = false;
            cb && cb();
        }).start();

        tween(this.opAnim).to(t, { x: 0 }, {
            onUpdate: () => {
                this.energyOpacity.opacity = this.opAnim.x;
            }
        },).start();
    }
}

