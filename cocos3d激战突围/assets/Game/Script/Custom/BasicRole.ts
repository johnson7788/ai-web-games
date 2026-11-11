import { _decorator, Component, Node, v3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BasicRole')
export class BasicRole {
    curPos = v3();
    hp = 0;
    //攻击相关方法
    onAtk() {

    }
    byHit(n) {

    }
}

