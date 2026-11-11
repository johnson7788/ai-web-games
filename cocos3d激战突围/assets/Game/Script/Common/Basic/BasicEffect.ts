import { _decorator, Component, Node } from 'cc';
import Tools from '../../../../Init/Tools/Tools';
const { ccclass, property } = _decorator;

@ccclass('BasicEffect')
export class BasicEffect {
    node: Node = null;
    isFinish = false;
    constructor(n?: Node) {
        this.node = n;
    }
    init(...d) {

    }

    update(dt) {

    }

    reset() {

    }
    //清除自身参数的所有引用
    clearObj() {
        Tools.clearObj(this);
    }
}

