import { _decorator, Component, Node, v3, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MoveVideoCmp')
export class MoveVideoCmp extends Component {

    @property(Node)
    layer: Node = null;

    @property(Node)
    bar: Node = null;

    @property(Label)
    awardLabel: Label = null;

    lvXArr: number[] = [];
    lvRates = [2, 3, 4, 5];

    isMove = false;
    maxX = 0;
    moveSpdX = 0;
    moveDirec = 1;

    curAwardRate = 1;
    initAward = 0;

    curPos = v3();

    onLoad() {
        this.layer.children.forEach(e => {
            this.lvXArr.push(e.position.x);
        })
        this.maxX = this.lvXArr[this.lvXArr.length - 1];
        this.moveSpdX = this.maxX * 1;
    }

    reset() {
        this.curPos.set(this.maxX / 2);
        this.bar.setPosition(this.curPos);
        this.curAwardRate = 3;
        this.moveDirec = 1;
    }

    setData(initAward: number) {
        this.isMove = true;
        this.initAward = initAward;
    }

    update(dt) {
        if (!this.isMove) return;

        let stepX = this.moveSpdX * dt * this.moveDirec;
        let nextX = stepX + this.curPos.x;
        if (nextX > this.maxX || nextX < 0) {
            this.moveDirec *= -1;
            stepX = this.moveSpdX * dt * this.moveDirec;
            nextX = stepX + this.curPos.x;
        }
        let preIndex = this.lvXArr.length - 1;
        for (let i = preIndex - 1; i >= 0; i--, preIndex--) {
            if (nextX < this.lvXArr[preIndex] && nextX >= this.lvXArr[i]) {
                this.curAwardRate = this.lvRates[i];
                break;
            }
        }

        this.curPos.x = nextX;
        this.curPos.y = -30;
        this.bar.setPosition(this.curPos);

        let sum = Math.floor(this.curAwardRate * this.initAward);
        this.awardLabel.string = sum.toFixed(0);
    }

    stopMove() {
        this.isMove = false;
    }

    resumeMove() {
        this.isMove = true;
    }
}

