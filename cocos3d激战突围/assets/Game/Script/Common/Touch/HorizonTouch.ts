import { _decorator, Component, Node, Vec2, v3, clamp, v2, Vec3 } from 'cc';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;
/**
 * 控制左右滑动操作
 */
@ccclass('HorizonTouch')
export class HorizonTouch {
    //控制的坐标点3D
    ctrlPos = v3();
    //
    touchDistX = 0;
    curSpdX = 0;
    minX = 0;
    maxX = 0;
    //设置合理的最大最小值
    fitMinX = 0;
    fitMaxX = 0;

    spdX = 70; //参考值
    isTouch = false;
    isMoveFinished = false;
    initPos = v3();

    constructor(initPos: Vec3, minX: number, maxX: number) {
        this.initPos.set(initPos);
        this.ctrlPos.set(initPos);
        this.minX = minX;
        this.maxX = maxX;
        this.fitMaxX = maxX;
        this.fitMinX = minX;

        this.onEvents();
    }
    protected onEvents() {
        EventManager.on(EventTypes.TouchEvents.TouchStart, this.onTouchStart, this);
        EventManager.on(EventTypes.TouchEvents.TouchMove, this.onTouchMove, this);
        EventManager.on(EventTypes.TouchEvents.TouchEnd, this.onTouchEnd, this);

    }
    public reset() {
        this.ctrlPos.set(this.initPos);
        this.touchDistX = 0;
        this.curSpdX = 0;
        this.isTouch = false;
        this.isMoveFinished = false;
    }

    public update(dt) {
        this.move(dt);
        this.fixPos(dt);
    }

    protected tmpPos = v3();
    protected move(dt) {
        this.tmpPos.set(this.ctrlPos);
        if (this.tmpPos.x != this.touchDistX && !this.isMoveFinished) {
            let sign = this.touchDistX > this.tmpPos.x ? 1 : -1;
            //动态调整速度
            let dist = Math.abs(this.touchDistX - this.tmpPos.x);
            let rate = dist / 3;
            rate = clamp(rate, 0.1, 10);
            this.curSpdX = this.spdX * rate;
            // console.log(dist + '  ' + rate);
            let tx = this.curSpdX * sign * dt + this.tmpPos.x;

            if (sign > 0 && tx > this.touchDistX ||
                sign < 0 && tx < this.touchDistX) {
                tx = this.touchDistX;
            }
            this.tmpPos.x = clamp(tx, this.minX, this.maxX);
        }
        this.ctrlPos.set(this.tmpPos);

        if (this.tmpPos.x == this.touchDistX) {
            this.isMoveFinished = true;
        }
    }
    //修正
    protected fixPos(dt) {
        if (this.isTouch || !this.isMoveFinished) return;
        let toX = clamp(this.ctrlPos.x, this.fitMinX, this.fitMaxX);
        this.ctrlPos.x += (toX - this.ctrlPos.x) * 0.1 * 60 * dt;
    }

    //#region 触摸事件--
    protected preDirec = v2(0, 0);  //1:向右/向上 -1:向左/向下
    protected preTouchPos = v2();
    protected prePos = v3();
    protected touchStartPos = v2();
    protected onTouchStart(p: Vec2) {
        this.isTouch = true;
        this.prePos.set(this.ctrlPos);
        this.preTouchPos.set(p);
        this.preDirec.set(0);
        this.touchStartPos.set(p);
    }

    protected onTouchMove(p1, p2) {
        this.isTouch = true;
        this.isMoveFinished = false;
        let subX = p2.x - this.touchStartPos.x;

        this.touchDistX = subX * 0.02 + this.prePos.x;
        this.touchDistX = clamp(this.touchDistX, this.minX, this.maxX);
        this.preTouchPos.set(p2);
    }

    protected onTouchEnd(p1, p2) {
        this.isTouch = false;
    }
    //#endregion

}

