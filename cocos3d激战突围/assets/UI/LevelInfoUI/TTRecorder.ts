import { _decorator, Component, Node, Tween, tween, UIOpacity } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { PlatformType, SDKSystem } from '../../Init/SystemSDK/SDKSystem';
const { ccclass, property } = _decorator;

@ccclass('TTRecorder')
export class TTRecorder extends Component {

    @property(Node)
    runNode: Node = null;
    @property(Node)
    pauseNode: Node = null;

    @property(UIOpacity)
    redPointOpacity: UIOpacity = null;

    isShow = false;
    curt = 0;

    onLoad() {
        if (SDKSystem._curPlatform == PlatformType.PCMiniGame ||
            SDKSystem._curPlatform == PlatformType.TTMiniGame) {
            this.isShow = true;
        } else {
            this.isShow = false;
        }
        this.node.active = false;

        EventManager.on(EventTypes.GameEvents.GameRun, this.onGameRun, this);
        EventManager.on(EventTypes.GameEvents.GameOver, this.onGameOver, this);
        EventManager.on(EventTypes.GameEvents.GamePause, this.onRecordPause, this);
        EventManager.on(EventTypes.GameEvents.GameResume, this.onRunClick, this);

    }

    onEnable() {
        this.curt = 0;
        this.onRunClick();
        this.showRedPoinAnim();
    }

    onRunClick() {
        this.runNode.active = true;
        this.pauseNode.active = false;
        EventManager.emit(EventTypes.SDKEvents.ResumeRecord);
    }

    onGameRun() {
        if (this.isShow) {
            this.node.active = true;
        }
    }

    onGameOver() {
        this.node.active = false;
    }

    onPauseClick() {
        this.onRecordPause();
        if (this.curt < 3) {
            EventManager.emit(EventTypes.GameEvents.ShowTips, '录屏时间少于3秒')
        }
    }

    onRecordPause() {
        this.runNode.active = false;
        this.pauseNode.active = true;
        EventManager.emit(EventTypes.SDKEvents.PauseRecord);
    }


    _opacityAnim = { o: 255 };
    showRedPoinAnim() {
        let t = 0.3;
        Tween.stopAllByTarget(this._opacityAnim);
        this._opacityAnim.o = 255;
        this.redPointOpacity.opacity = this._opacityAnim.o;
        tween(this._opacityAnim).repeatForever(
            tween(this._opacityAnim)
                .to(t, { o: 0 })
                .to(t, { o: 255 })
        ).start();
    }

    update(dt) {
        if (this.redPointOpacity.node.active) {
            this.redPointOpacity.opacity = this._opacityAnim.o;
            this.curt += dt;
        }
    }
}

