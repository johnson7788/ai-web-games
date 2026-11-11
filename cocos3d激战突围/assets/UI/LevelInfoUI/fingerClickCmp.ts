import { _decorator, Component, Node, v3, Tween, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('fingerClickCmp')
export class fingerClickCmp extends Component {

    onEnable() {
        this.showAnim();
    }

    pos = v3();
    showAnim() {
        Tween.stopAllByTarget(this.pos);
        this.pos.set(0, 0, 0);
        this.node.setPosition(this.pos);
        let t = 0.25;
        let h = 50;
        tween(this.pos).repeatForever(
            tween(this.pos).
                to(t, { y: h }, { easing: 'sineInOut' }).
                to(t, { y: 0 }, { easing: 'sineInOut' }).
                start()
        ).start();
    }

    update(dt) {
        this.node.setPosition(this.pos);
    }
}

