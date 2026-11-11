import { _decorator, Component, Node, v3 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('RotateCmp')
// @executeInEditMode
export class RotateCmp extends Component {
    @property
    angleSpd = -180;
    start() {

    }
    _tmpV3 = v3();
    update(dt: number) {
        this._tmpV3.set(this.node.eulerAngles);
        this._tmpV3.z += this.angleSpd * dt;
        this.node.eulerAngles = this._tmpV3;
    }
}

