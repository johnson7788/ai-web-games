import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ExchangeBtns')
export class ExchangeBtns extends Component {

    @property
    offsetX = 167;

    onEnable() {
        //交换位置
        if (Math.random() < 0.5) {
            this.node.children[0].setPosition(this.offsetX, 0, 0);
            this.node.children[1].setPosition(-this.offsetX, 0, 0);
        } else {
            this.node.children[0].setPosition(-this.offsetX, 0, 0);
            this.node.children[1].setPosition(this.offsetX, 0, 0);
        }
    }
}

