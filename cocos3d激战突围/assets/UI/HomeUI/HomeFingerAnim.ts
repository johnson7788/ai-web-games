import { _decorator, Component, Node, v3, Tween, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HomeFingerAnim')
export class HomeFingerAnim extends Component {
    pos = v3();
    onEnable() {
        Tween.stopAllByTarget(this.pos);
        this.pos.set(0, -50);
        this.node.children[0].setPosition(this.pos);

        tween(this.pos).repeatForever(
            tween(this.pos).
                to(0.3, { y: 0 }, { easing: 'sineIn' }).
                to(0.3, { y: -50 }, { easing: 'sineOut' }).
                start()
        ).start();

    }

    update(dt) {
        this.node.children[0].setPosition(this.pos);
    }
}

