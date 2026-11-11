import { _decorator, Component, Node, v3 } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

enum SwithType {
    Voice,
    Shake,
}

class SettingSwith {
    close: Node = null;
    open: Node = null;
    bar: Node = null;
    isOpen = false;
    offsetX = 0;
    constructor(swh: Node, offsetX: number) {
        this.offsetX = offsetX;
        this.close = swh.getChildByName('close');
        this.open = swh.getChildByName('open');
        this.bar = swh.getChildByName('bar');
        this.setState(false);
    }
    tmpP = v3();
    setState(isOpen = false) {
        this.isOpen = isOpen;
        this.close.active = !isOpen;
        this.open.active = isOpen;
        this.bar.setPosition(this.tmpP.set(isOpen ? -this.offsetX : this.offsetX))
    }
    changeState() {
        this.setState(!this.isOpen);
        return this.isOpen;
    }
}

@ccclass('SettingUI')
export class SettingUI extends BasicUI {

    @property(Node)
    protected voiceSwith: Node = null;
    @property(Node)
    protected shakeSwith: Node = null;
    @property
    protected offsetX = 30;

    private _switchRecs: { [t: number]: SettingSwith } = null;
    private initSwith() {
        if (!this._switchRecs) {
            this._switchRecs = {};
            this._switchRecs[SwithType.Voice] = new SettingSwith(this.voiceSwith, this.offsetX);
            this._switchRecs[SwithType.Shake] = new SettingSwith(this.shakeSwith, this.offsetX);
        }
        let d = StorageSystem.getData();
        //设置当前状态
        this._switchRecs[SwithType.Voice].setState(d.userSetting.AudioSwith);
        this._switchRecs[SwithType.Shake].setState(d.userSetting.ShakeSwith);
    }

    public show(d) {
        super.show(d);
        this.initSwith();
    }

    //#region ---------按钮
    protected onVoiceClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        let isOpen = this._switchRecs[SwithType.Voice].changeState();
        // 同步设置
        AudioSystem.setAudioState(isOpen);
        StorageSystem.setData((d) => {
            d.userSetting.AudioSwith = isOpen
        }, true);
    }
    protected onShakeClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        let isOpen = this._switchRecs[SwithType.Shake].changeState();
        // 同步设置
        StorageSystem.setData((d) => {
            d.userSetting.ShakeSwith = isOpen
        }, true);
    }
    // 关闭
    protected onCloseClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        UISystem.hideUI(UIEnum.SettingUI);
    }
    //#endregion
}

