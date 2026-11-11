import { _decorator, Component, Node, EventTouch, v2, Vec2, size, UITransform } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import GlobalData from '../../Init/Config/GlobalData';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('LevelController')
export class LevelController extends BasicUI {
    /**触摸开关 */
    protected isEnableTouch: boolean = true;
    /**屏幕尺寸 */
    private _halfCvsSize = size();

    protected onLoad() {
        //系统触摸事件
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected onEvents() {
        this.on(EventTypes.TouchEvents.SetTouchEnable, this.onSetTouchState, this);
    }

    public show(d?) {
        super.show(d);
        this.reset();
        const cvs = GlobalData.get(GlobalEnum.GlobalDataType.Canvas) as Node;
        this._halfCvsSize.set(cvs.getComponent(UITransform).contentSize);
        this._halfCvsSize.width *= 0.5;
        this._halfCvsSize.height *= 0.5;
    }

    public reset() {
        this.isEnableTouch = true;
    }

    //#region 触摸事件
    /**设置是否可触摸 */
    protected onSetTouchState(isEnable = true) {
        this.isEnableTouch = isEnable;
        console.log(isEnable ? '开启' : '关闭', '触摸');
    }

    private _tmpV1 = v2();
    private _tmpV2 = v2();
    protected onTouchStart(e: EventTouch) {
        if (!this.isEnableTouch) return;
        e.getUILocation(this._tmpV1); //初始touch位置        
        this._tmpV1.x -= this._halfCvsSize.width;
        this._tmpV1.y -= this._halfCvsSize.height;
        this.emit(EventTypes.TouchEvents.TouchStart, this._tmpV1);
        //
        this.emit(EventTypes.TouchEvents.TouchStartObj, e);
    }
    protected onTouchMove(e: EventTouch) {
        if (!this.isEnableTouch) return;
        e.getPreviousLocation(this._tmpV1)  //上一帧touch位置
        e.getUILocation(this._tmpV2);       //当前touch位置
        this._tmpV1.x -= this._halfCvsSize.width;
        this._tmpV1.y -= this._halfCvsSize.height;
        this._tmpV2.x -= this._halfCvsSize.width;
        this._tmpV2.y -= this._halfCvsSize.height;
        this.emit(EventTypes.TouchEvents.TouchMove, this._tmpV1, this._tmpV2);
        this.emit(EventTypes.TouchEvents.TouchMoveObj, e);
    }
    protected onTouchEnd(e: EventTouch) {
        if (!this.isEnableTouch) return;
        e.getStartLocation(this._tmpV1); //初始touch位置
        e.getUILocation(this._tmpV2);    //当前touch位置
        this._tmpV1.x -= this._halfCvsSize.width;
        this._tmpV1.y -= this._halfCvsSize.height;
        this._tmpV2.x -= this._halfCvsSize.width;
        this._tmpV2.y -= this._halfCvsSize.height;
        this.emit(EventTypes.TouchEvents.TouchEnd, this._tmpV1, this._tmpV2);
        this.emit(EventTypes.TouchEvents.TouchEndObj, e);
    }
    //#endregion
}

