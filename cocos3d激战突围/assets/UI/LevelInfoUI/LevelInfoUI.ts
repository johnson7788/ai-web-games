import { _decorator, Component, Node, Label } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../Init/Config/GlobalTmpData';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('LevelInfoUI')
export class LevelInfoUI extends BasicUI {

    @property(Label)
    protected lvLabel: Label = null;

    @property(Node)
    protected lvInfo: Node = null;

    private _timeScale = 1.0;
    //
    public onEvents() {
        this.on(EventTypes.GameEvents.GameRun, this.onGameRun, this);
    }

    public show(d?) {
        super.show(d);
        this.setLvInfo();
        this._timeScale = 1.0;

        this.lvInfo.active = false;
    }

    @property(Label)
    protected enemyLabel: Label = null;

    protected update(dt) {
        // this.enemyLabel.string = GlobalTmpData.EnemyNum + '';
    }

    // #region ---------私有--------
    private setLvInfo() {
        this.lvLabel.string = StorageSystem.getData().levelAssets.curLv + '';
    }

    // #endregion

    // #region ----------事件
    protected onGameRun() {
        this.lvInfo.active = true;
    }

    protected onAddRoles() {
        this.emit(EventTypes.RoleEvents.AddRoles, GlobalEnum.IncreaseType.symbol_Add, 1);
    }
    protected onReduceRoles() {
        this.emit(EventTypes.RoleEvents.AddRoles, GlobalEnum.IncreaseType.symbol_Reduce, 1);
    }
    // #endregion

    // #region -----------test---------
    protected onSpdUpClick() {
        this._timeScale += 0.5;
        this.emit(EventTypes.GameEvents.SetGameTimeScale, this._timeScale);
    }
    protected onSpdCutClick() {
        this._timeScale -= 0.5;
        this._timeScale = this._timeScale < 0 ? 0 : this._timeScale;
        this.emit(EventTypes.GameEvents.SetGameTimeScale, this._timeScale);
    }
    protected testWin() {
        this.emit(EventTypes.GameEvents.GameOver, true);
    }

    protected testLose() {
        this.emit(EventTypes.GameEvents.GameOver, false);
    }

    protected testPause() {
        this.emit(EventTypes.GameEvents.GamePause);
    }

    protected testResume() {
        this.emit(EventTypes.GameEvents.GameResume);
    }

    protected testBackHome() {
        UISystem.hideUI(UIEnum.LevelInfoUI);
        this.emit(EventTypes.GameEvents.SetLevelManagerEnable, false); //清除关卡场景
        UISystem.showUI(UIEnum.HomeUI);
    }

    // #endregion ------------
}

