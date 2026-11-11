import { _decorator, Component, Node, tween, v3, Tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoopScaleAnim')
export class LoopScaleAnim extends Component {
    @property
    loopTime = 0.5;
    @property
    stepScale = 0.15;

    start() {
        this.show();
    }
    scaleAnim = v3();
    show() {
        Tween.stopAllByTarget(this.scaleAnim);
        this.scaleAnim.set(1, 1, 1);
        this.node.setScale(this.scaleAnim);
        tween(this.scaleAnim).repeatForever(
            tween(this.scaleAnim).
                to(this.loopTime / 2, { x: 1 + this.stepScale, y: 1 + this.stepScale }, { easing: 'sineInOut' }).
                to(this.loopTime / 2, { x: 1, y: 1 }, { easing: 'sineInOut' })
        ).start();
    }

    update(dt) {
        this.node.setScale(this.scaleAnim);
    }
}

