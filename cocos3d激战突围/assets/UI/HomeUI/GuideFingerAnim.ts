import { _decorator, Component, Node, v3, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GuideFingerAnim')
export class GuideFingerAnim extends Component {
    start() {
        this.pos.set(this.node.position);
        this.playAnim();
    }
    pos = v3();
    playAnim() {
        let t = 0.5;
        let w = 200;
        tween(this.pos).repeatForever(
            tween(this.pos).
                to(t, { x: w }, { easing: 'sineInOut' }).
                to(t, { x: -w }, { easing: 'sineInOut' }).
                start()
        ).start();
    }

    update(dt) {
        this.node.setPosition(this.pos);
    }
}

