import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BasicRec')
export class BasicRec {
    static RECID = 0;
    _curId = 0;
    node: Node = null;

    constructor(...d) {
        this._curId = BasicRec.RECID++;
    }

    init(...d) {

    }

    update(dt) {

    }

    reset() {

    }
}

