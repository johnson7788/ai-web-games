import { _decorator, Component, Node, ProgressBar, Label } from 'cc';
import EventManager from '../Managers/EventManager';
import { EventTypes } from '../Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('InitProgressBar')
export class InitProgressBar extends Component {
    @property(ProgressBar)
    progressBar: ProgressBar = null;
    @property(Label)
    progressLabel: Label = null;

    onLoad() {
        EventManager.on(EventTypes.GameEvents.InitLoadFinished, this.onInitLoadFinished, this);
    }

    onEnable() {
        this.progressBar.progress = 0;
        this.progressLabel.string = '0';
        this.curWt = 0;
        this.isWait = false;
    }
    spd = 0.15;
    waitTime = 1;
    curWt = 0;
    isWait = false;
    update(dt: number) {
        if (this.isWait) {
            this.curWt += dt;
            if (this.curWt > this.waitTime) {
                this.curWt = 0;
                this.isWait = false;
                this.progressBar.progress = 0;
            }
        } else {
            let step = this.spd * dt;
            this.progressBar.progress += step;
            if (this.progressBar.progress >= 1) {
                this.progressBar.progress = 1;
                this.isWait = true;
            }
            this.progressLabel.string = (this.progressBar.progress * 100).toFixed(0);
        }
    }

    onInitLoadFinished() {
        this.isWait = true;
        this.progressBar.progress = 1;
        this.progressLabel.string = (this.progressBar.progress * 100).toFixed(0);
    }
}

