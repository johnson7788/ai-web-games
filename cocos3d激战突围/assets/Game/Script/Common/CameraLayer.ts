import { _decorator, Component, Node, Vec3, v3, Camera, Tween, tween } from 'cc';
import GlobalData from '../../../Init/Config/GlobalData';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { LevelDataTmp } from '../../../Init/SystemStorage/StorageTemp';
import GlobalPool from '../../../Init/Tools/GlobalPool';
import { BasicMountLayer } from './Basic/BasicMountLayer';
const { ccclass, property } = _decorator;

@ccclass('CameraLayer')
export class CameraLayer extends BasicMountLayer {
    //当前节点的初始坐标
    private _initPos = v3();
    private _initRot = v3();
    private _initRothoHeight = 3;

    //跟随的坐标对象
    private _followPos: Vec3 = null;
    //相机本身
    private _cameraSelf: Node = null;
    //
    private _cameraCmp: Camera = null;

    /**初始化 只执行一次*/
    protected init() {
        this._initPos.set(this.node.position);
        this._initRot.set(this.node.eulerAngles);
        this._cameraSelf = this.node.children[0];

        this._cameraCmp = this._cameraSelf.getComponent(Camera);
        GlobalData.set(GlobalEnum.GlobalDataType.Camera3D, this._cameraCmp);
    };

    protected onEvents() {
        EventManager.on(EventTypes.CameraEvents.SetCameraPos, this.onSetCameraPos, this);
        EventManager.on(EventTypes.CameraEvents.SetFollowPos, this.onSetFollowPos, this);
        EventManager.on(EventTypes.CameraEvents.SetCameraSelfRot, this.onSetCameraSelfRot, this);
        EventManager.on(EventTypes.CameraEvents.SetCameraSelfPos, this.onSetCameraSelfPos, this);
        EventManager.on(EventTypes.CameraEvents.SetCameraSelfOffset, this.onSetCameraSelfOffset, this);
        EventManager.on(EventTypes.CameraEvents.SetCameraOrthoHeightOffset, this.onSetCameraOrthoHeightOffset, this);

    };

    /**设置状态、数据等, */
    public setData(data?: LevelDataTmp) {

    };
    /**重置状态、数据等，子类实现 */
    public reset() {
        this._followPos = null;
        this.node.setPosition(this._initPos);
    }

    public customUpdate(dt: number) {
        this.followCamera(dt);
    }

    public customLateUpdate(dt: number) {

    }

    // #region ----------------相机layer跟随------------
    private _tmpPos = v3();
    protected followCamera(dt) {
        if (this._followPos) {
            this._tmpPos.set(this.node.position);
            this._tmpPos.lerp(this._followPos, 0.1);
            this.node.setPosition(this._tmpPos);
        }
    }

    // #endregion


    // #endregion

    // #region -----------------事件-----------------
    protected onSetCameraPos(p) {
        p && this.node.setPosition(p);
    }
    /**设置跟随的坐标对象-引用 */
    protected onSetFollowPos(p) {
        this._followPos = p;
    }
    //设置相机本身坐标
    protected onSetCameraSelfPos(p: Vec3) {
        this._cameraSelf.setPosition(p);
    }
    //设置相机本身坐标偏移-相对初始坐标
    protected onSetCameraSelfOffset(offset: Vec3) {
        // this._cameraSelf.setPosition(this._tmpPos.set(this._initPos).add(offset));
        this._cameraSelf.setPosition(offset);
    }
    //设置相机正交视角的视野高度偏移
    protected onSetCameraOrthoHeightOffset(offsetH: number) {
        this._cameraCmp.orthoHeight = this._initRothoHeight + offsetH;
    }
    //设置相机本身旋转
    protected onSetCameraSelfRot(rot: Vec3) {
        this._cameraSelf.eulerAngles = rot;
    }

    // #endregion

}

