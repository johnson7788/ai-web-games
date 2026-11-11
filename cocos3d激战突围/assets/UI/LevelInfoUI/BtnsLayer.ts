import { _decorator, Component, Node, UITransform, v3 } from 'cc';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import GlobalPool from '../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('BtnsLayer')
export class BtnsLayer extends Component {

    @property(Node)
    createBtn: Node = null;
    @property(Node)
    deleteBtn: Node = null;
    @property(Node)
    resetBtn: Node = null;
    @property(Node)
    runBtn: Node = null;
    @property(Node)
    skipBtn: Node = null;
    @property(Node)
    tipBtn: Node = null;
    @property(Node)
    tipLayer: Node = null;

    _allBtns: { [type: string]: BtnRec } = {};

    onLoad() {
        this._allBtns[GlobalEnum.LevelBtns.CreateBtn] = new BtnRec(GlobalEnum.LevelBtns.CreateBtn, this.createBtn, TipDirec.Top, this.tipLayer);
        this._allBtns[GlobalEnum.LevelBtns.DeleteBtn] = new BtnRec(GlobalEnum.LevelBtns.DeleteBtn, this.deleteBtn, TipDirec.Top, this.tipLayer);
        this._allBtns[GlobalEnum.LevelBtns.RsetBtn] = new BtnRec(GlobalEnum.LevelBtns.RsetBtn, this.resetBtn, TipDirec.Right, this.tipLayer);
        this._allBtns[GlobalEnum.LevelBtns.RunBtn] = new BtnRec(GlobalEnum.LevelBtns.RunBtn, this.runBtn, TipDirec.Top, this.tipLayer);
        this._allBtns[GlobalEnum.LevelBtns.SkipBtn] = new BtnRec(GlobalEnum.LevelBtns.SkipBtn, this.skipBtn, TipDirec.Left, this.tipLayer);
        this._allBtns[GlobalEnum.LevelBtns.TipBtn] = new BtnRec(GlobalEnum.LevelBtns.TipBtn, this.tipBtn, TipDirec.Left, this.tipLayer);

        this.onEvents();
    }

    onEvents() {
        EventManager.on(EventTypes.UIEvents.ShowBtnTip, this.onShowBtnTip, this);
        EventManager.on(EventTypes.RailEvents.ChangeRailState, this.onChangeRailState, this);
        EventManager.on(EventTypes.RailEvents.ResetRails, this.onResetTips, this);

    }

    onEnable() {
        this.resetBtns();
    }

    resetBtns() {
        for (const key in this._allBtns) {
            const rec = this._allBtns[key];
            rec.reset();
        }
    }

    onShowBtnTip(t: GlobalEnum.LevelBtns) {
        if (this._allBtns[t]) {
            this._allBtns[t].showTip();
        }
    }

    onResetTips() {
        this.resetBtns();
    }

    // #region ----------------按钮流程控制-----------
    onChangeRailState(t: GlobalEnum.RailState) {
        if (t == GlobalEnum.RailState.Running) {
            //运行时-禁用所有删除-创建按钮
            this._allBtns[GlobalEnum.LevelBtns.CreateBtn].btn.active = false;
            this._allBtns[GlobalEnum.LevelBtns.DeleteBtn].btn.active = false;
            this._allBtns[GlobalEnum.LevelBtns.RsetBtn].btn.active = false;
            this._allBtns[GlobalEnum.LevelBtns.RunBtn].btn.active = false;
        }
    }
    // #endregion

}
export enum TipDirec {
    Top,
    Btm,
    Left,
    Right,
}

export class BtnRec {
    btn: Node;
    tip: Node;
    tipDirec: TipDirec;
    parent: Node;
    btnType: GlobalEnum.LevelBtns;

    constructor(t: GlobalEnum.LevelBtns, node: Node, direc: TipDirec, parent: Node) {
        this.btnType = t;
        this.btn = node;
        this.parent = parent;
        this.tipDirec = direc;
        this.btn.on(Node.EventType.TOUCH_END, this.onTouched, this);
    }

    reset() {
        this.btn.active = true;
        if (this.tip) {
            this.tip.active = false;
        }
    }

    showTip() {
        if (!this.tip) {
            let curSize = this.btn.getComponent(UITransform).contentSize;
            this.tip = GlobalPool.get('fingerClick');
            let _s = this.tip.getComponent(UITransform).contentSize;
            let p = v3(this.btn.worldPosition);
            let rot = v3();
            let dist = 10;
            switch (this.tipDirec) {
                case TipDirec.Top:
                    p.y += dist + (curSize.height + _s.height) * 0.5;
                    break;
                case TipDirec.Btm:
                    rot.z = 180;
                    p.y -= dist + (curSize.height + _s.height) * 0.5;
                    break;
                case TipDirec.Left:
                    rot.z += 90;
                    p.x -= dist + (curSize.width + _s.width) * 0.5;
                    break;
                case TipDirec.Right:
                    rot.z -= 90;
                    p.x += dist + (curSize.width + _s.width) * 0.5;
                    break;
                default:
                    break;
            }
            this.tip.parent = this.parent; 1
            p.subtract(this.parent.worldPosition);
            this.tip.setPosition(p);
            this.tip.eulerAngles = rot;
        }

        if (this.tip) {
            this.tip.active = true;
        }
    }

    onTouched() {
        if (this.tip) {
            if (this.tip.active) {
                //发送事件
                EventManager.emit(EventTypes.UIEvents.OnHideBtnTip, this.btnType);
            }
            this.tip.active = false;
        }
    }
}

