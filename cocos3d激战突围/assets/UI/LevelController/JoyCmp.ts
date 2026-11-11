import { _decorator, Component, Node, Vec2, v3, UIOpacity, Vec3 } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('JoyCmp')
export class JoyCmp extends Component {
    @property(Node)
    protected bar: Node = null;

    uiOpacity: UIOpacity = null;
    protected onLoad() {
        this.uiOpacity = this.node.getComponent(UIOpacity);

        EventManager.on(EventTypes.TouchEvents.TouchStart, this.onTouchStart, this);
        EventManager.on(EventTypes.TouchEvents.TouchMove, this.onTouchMove, this);
        EventManager.on(EventTypes.TouchEvents.TouchEnd, this.onTouchEnd, this);
        EventManager.on(EventTypes.GameEvents.GameOver, this.onGameOver, this);
    }

    // #region --------触摸--------
    private _startPos = v3();
    private _tmpPos = v3();
    protected onTouchStart(p: Vec2) {
        this._tmpPos.set(p.x, p.y);
        this._startPos.set(p.x, p.y);
        this.node.setPosition(this._tmpPos);
        this.uiOpacity.opacity = 255;
        this.bar.setPosition(Vec3.ZERO);
    }
    protected onTouchMove(p1: Vec2, p2: Vec2) {
        this._tmpPos.set(p2.x - this._startPos.x, p2.y - this._startPos.y);
        let len = this._tmpPos.length();
        len = len > 75 ? 75 : len;
        this._tmpPos.normalize().multiplyScalar(len);
        this.bar.setPosition(this._tmpPos);

    }
    protected onTouchEnd(p1: Vec2, p2: Vec2) {
        this.uiOpacity.opacity = 0;
    }
    //#endregion

    protected onGameOver() {
        this.uiOpacity.opacity = 0;
    }
}

