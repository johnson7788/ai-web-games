import { _decorator, Component, Node, v3, tween, Vec3, v2 } from 'cc';
import { GlobalTmpData } from '../../../Init/Config/GlobalTmpData';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { StorageSystem } from '../../../Init/SystemStorage/StorageSystem';
import { LevelDataTmp } from '../../../Init/SystemStorage/StorageTemp';
import { UIEnum } from '../../../Init/SystemUI/UIEnum';
import { UISystem } from '../../../Init/SystemUI/UISystem';
import { EffectLayer } from '../Common/EffectLayer';
import { BasicLayer } from './Basic/BasicLayer';
import { BasicMountLayer } from './Basic/BasicMountLayer';
import { AudioSystem } from '../../../Init/SystemAudio/AudioSystem';
import { AudioEnum } from '../../../Init/SystemAudio/AudioEnum';
import { MergeEffectLayer } from '../Custom/mergeEffect/MergeEffectLayer';
import { RoleLayer } from '../Custom/RoleLayer';
import { RoadLayer } from '../Custom/road/RoadLayer';
import { CollisionManager } from './VertCollison/CollisionManager';
import { PropsLayer } from '../Custom/prop/PropsLayer';
import GlobalPool from '../../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {
    @property(Node)
    private layerNodeArr: Node[] = []; //需要继承 BasicMountLayer

    @property(Node)
    private perfabsLayer: Node = null; //用于存放游戏当前关卡场景中所有的物体


    private _isPause = false;
    private _isOver = false;
    //记录关卡数据
    private _lvData: LevelDataTmp = null;
    //记录是否运行游戏
    private _isRun = false;

    // #region -------------------生命周期---------------
    protected onLoad() {
        this.onEvents();
        this.initLayers();
        this.initCustomLayers();
    }

    protected onEvents() {
        EventManager.on(EventTypes.GameEvents.GamePause, this.onGamePause, this);
        EventManager.on(EventTypes.GameEvents.GameResume, this.onGameResume, this);
        EventManager.on(EventTypes.GameEvents.GameRun, this.onGameRun, this);
        EventManager.on(EventTypes.GameEvents.GameOver, this.onGameOver, this);
        EventManager.on(EventTypes.GameEvents.SetGameTimeScale, this.onSetGameTimeScale, this);
        EventManager.on(EventTypes.GameEvents.GameLoadFinish, this.onGameLoadFinish, this);
        //
        EventManager.on(EventTypes.TouchEvents.TouchStart, this.onTouchStart, this);
    }

    protected onEnable() {
        this.reset();
        this.startRecord();
        this.setData();
    }

    protected start() {

    }

    protected onDisable() {
        this.resetLayers();
        this.resetCustomLayers();
    }

    /**重置状态 */
    protected reset() {
        this._isPause = false;
        this._isOver = false;
        this._isRun = false;
        GlobalTmpData.timeScale = 1.0;
        GlobalTmpData.reset();

        this.resetLayers();
    }

    protected setData() {

        this._lvData = StorageSystem.getLvData();
        this.setLayersData(this._lvData);
        this.setCustomLayersData(this._lvData);
    }

    protected update(dt) {
        this.updateRunRecord(dt);
        if (this._isPause || this._isOver) return;
        this.updateGameRecord(dt);
        let ft = dt * GlobalTmpData.timeScale;
        this.updateLayers(ft);
        this.updateCustomLayers(ft)
    }
    protected lateUpdate(dt) {
        if (this._isPause || this._isOver) return;
        let ft = dt * GlobalTmpData.timeScale;
        this.lateUpdateLayers(ft);
        this.lateUpdateCustomLayers(ft);
    }
    // #endregion

    // #region -------------------数据统计-----------
    /**数据统计开始 */
    private startRecord() {
        GlobalTmpData.Game.startTime = Date.now();
        GlobalTmpData.Game.totalTime = 0;
        GlobalTmpData.Game.endTime = 0;
    }
    //记录游戏运行时长(包括暂停)
    private updateRunRecord(dt) {
        GlobalTmpData.Game.totalTime += dt;
    }
    //记录游戏时长(不包括暂停)
    private updateGameRecord(dt) {
        if (this._isOver) return;
        GlobalTmpData.Game.gameTime += dt;
    }
    private stopRecord() {
        GlobalTmpData.Game.endTime = Date.now();
    }

    // #endregion

    // #region -------------------挂载层级管理--------------
    //挂载的层级组件
    private mountLayers: BasicMountLayer[] = [];

    /**初始化层级数据 */
    protected initLayers() {
        for (let i = 0; i < this.layerNodeArr.length; i++) {
            const e = this.layerNodeArr[i];
            const cmp = e.getComponent(BasicMountLayer);
            this.mountLayers.push(cmp);
            cmp.initLayer();
        }
    }
    /**重置层级数据 */
    protected resetLayers() {
        for (let i = 0; i < this.mountLayers.length; i++) {
            this.mountLayers[i].reset();
        }
    }
    /**设定层级数据 */
    protected setLayersData(d) {
        for (let i = 0; i < this.mountLayers.length; i++) {
            this.mountLayers[i].setData(d);
        }
    }
    /**更新层级数据 */
    protected updateLayers(dt) {
        for (let i = 0; i < this.mountLayers.length; i++) {
            this.mountLayers[i].customUpdate(dt);
        }
    }
    /**更新层级数据 */
    protected lateUpdateLayers(dt) {
        for (let i = 0; i < this.mountLayers.length; i++) {
            this.mountLayers[i].customLateUpdate(dt);
        }
    }

    // #endregion

    // #region -------------------自定义层级管理--------------
    //自定义的层级组件
    private customLayers: BasicLayer[] = [];
    protected initCustomLayers() {
        /**添加自定义的管理层级 */
        this.customLayers.push(new RoadLayer(this.perfabsLayer));
        this.customLayers.push(new PropsLayer(this.perfabsLayer));
        this.customLayers.push(new CollisionManager(this.perfabsLayer));
        this.customLayers.push(new EffectLayer(this.perfabsLayer));
        this.customLayers.push(new MergeEffectLayer(this.perfabsLayer));
        this.customLayers.push(new RoleLayer(this.perfabsLayer));

        for (let i = 0; i < this.customLayers.length; i++) {
            this.customLayers[i].initLayer();
        }
    }
    protected resetCustomLayers() {
        for (let i = 0; i < this.customLayers.length; i++) {
            this.customLayers[i].reset();
        }
        GlobalPool.putAllChildren(this.perfabsLayer); //test

    }
    protected setCustomLayersData(d?) {
        for (let i = 0; i < this.customLayers.length; i++) {
            this.customLayers[i].setData(d);
        }
    }
    protected updateCustomLayers(dt) {
        for (let i = 0; i < this.customLayers.length; i++) {
            this.customLayers[i].customUpdate(dt);
        }
    }
    protected lateUpdateCustomLayers(dt) {
        for (let i = 0; i < this.customLayers.length; i++) {
            this.customLayers[i].customLateUpdate(dt);
        }
    }
    // #endregion

    // #region -------------------私有方法------

    //运行游戏
    private runGame() {
        if (this._isRun) return;
        this._isRun = true;
        // UISystem.hideUI(UIEnum.HomeUI);
        // EventManager.emit(EventTypes.GameEvents.GameRun);
        // EventManager.emit(EventTypes.GuideEvents.ShowGuideAnim);
        // EventManager.emit(EventTypes.TouchEvents.SetTouchEnable);

        // AudioSystem.playBGM(AudioEnum.lvBgm);
    }


    // #endregion

    // #region -----------------对外方法--------

    // #endregion

    // #region -------------------事件------------

    protected onGameLoadFinish() {
        // this.runGame();

        return;
    }

    protected onTouchStart() {

    }

    /**暂停 */
    protected onGamePause() {
        this._isPause = true;
        GlobalTmpData.Game.isPause = true;
    }
    /**继续 */
    protected onGameResume() {
        this._isPause = false;
        GlobalTmpData.Game.isPause = false;
    }
    protected onSetGameTimeScale(n) {
        if (undefined !== n) {
            GlobalTmpData.timeScale = n;
        }
    }

    /**结束 */
    protected onGameOver(isWin?: boolean) {
        if (this._isOver) return;
        GlobalTmpData.Game.isGameOver = true;
        this._isOver = true;

        UISystem.hideUI(UIEnum.FakeLevelAdUI);
        this.stopRecord();
    }

    protected onGameRun() {
        GlobalTmpData.Game.isGameRun = true;
        console.log('# Game Run #')
        UISystem.showUI(UIEnum.FakeLevelAdUI);
    }
    // #endregion
}

