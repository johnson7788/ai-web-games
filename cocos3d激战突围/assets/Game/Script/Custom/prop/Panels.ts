import { _decorator, Component, Node, Enum, MeshRenderer, v2, v4, Vec3, v3, tween, Tween, rect, Intersection2D, Vec2 } from 'cc';
import { GlobalConfig } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup } from '../../Common/VertCollison/CollisionManager';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;

@ccclass('Panels')
export class Panels extends BasicProp {
    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.Increase;

    _panelId = 0;
    _isMove = false;

    @property(Node)
    red: Node = null;
    @property(Node)
    blue: Node = null;

    @property(MeshRenderer)
    symbolMsr: MeshRenderer = null;
    @property(MeshRenderer)
    labelMsr: MeshRenderer[] = []

    onEvents() {
        this.on(EventTypes.CurLevelEvents.HideIncreaceProp, this.onHidePanel, this);
    }

    initSub() {
        this.initAnim();
        this.initLabel();
    }

    setData(data) {
        super.setData(data);
        this.initAnim();
        this.setLabel(data);
        this._panelId = data.id;
        this._isMove = data.isMove;
    }

    reset() {
        this.resetAnim();
        this.resetLabel();
        super.reset();
    }

    customUpdate(dt) {
        super.customUpdate(dt);
        this.updateAnim(dt);
    }

    //#region -----------------数字---------
    symbolType: GlobalEnum.IncreaseType;
    symbolCfg = {
        '+': GlobalEnum.IncreaseType.symbol_Add,
        '-': GlobalEnum.IncreaseType.symbol_Reduce,
        'x': GlobalEnum.IncreaseType.symbol_Multip,
        '/': GlobalEnum.IncreaseType.symbol_Division,
    };
    symbolUvZ = {
        '+': 0,
        '-': 0.25,
        'x': 0.5,
        '/': 0.75,
    }
    num = 0;

    initLabel() {

    }
    tmpV4 = v4();

    setLabel(d: { symbol: string, num: number }) {
        this.blue.active = d.symbol == '+' || d.symbol == 'x';
        this.red.active = d.symbol == '-' || d.symbol == '/';

        this.symbolType = this.symbolCfg[d.symbol];
        this.num = d.num;
        //符号
        let mat = this.symbolMsr.getMaterialInstance(0);
        let symHandle = mat.passes[0].getHandle('tilingOffset');

        this.tmpV4.set(0.25, 1, this.symbolUvZ[d.symbol], 0);
        mat.passes[0].setUniform(symHandle, this.tmpV4);

        //数字
        let numStr = d.num.toFixed(0);
        let num0, num1;
        num0 = +numStr[0];
        let mat0 = this.labelMsr[0].getMaterialInstance(0);
        mat0.setProperty('tilingOffset', v4(0.1, 1, num0 * 0.1, 0));

        this.labelMsr[1].node.active = false;
        if (numStr.length > 1) {
            this.labelMsr[1].node.active = true;
            num1 = +numStr[1];
            let mat1 = this.labelMsr[1].getMaterialInstance(0);
            mat1.setProperty('tilingOffset', v4(0.1, 1, num1 * 0.1, 0));
        }

    }

    resetLabel() {
    }

    //#endregion

    //#region ---------------------动画--------
    pos: Vec3 = v3();
    _isAnim = false;
    initAnim() {
        this._isAnim = false;
        this.pos.set(this.node.position);
    }

    resetAnim() {
        this._isAnim = false;
    }
    updateAnim(dt) {

    }

    showMoveDownAnim() {
        if (this._isAnim) return;
        this._isAnim = true;
        Tween.stopAllByTarget(this.pos);
        tween(this.pos).to(0.5, { y: -3 }, {
            onUpdate: () => {
                this.node && this.node.setPosition(this.pos);
            }
        }).start()
    }
    //#endregion

    //#region ---------------------碰撞----------
    tmpP = v3();
    isTriggerUsed = false;
    setCollider() {
        this.pos.set(this.node.worldPosition);  //默认
        this.collider = new BasicCollider<BasicProp>(this.cldGroup, this, true);
        //判断是否旋转90/270
        this.tmpP.set(this.cldSize.width, 0, this.cldSize.height);
        Vec3.rotateY(this.tmpP, this.tmpP, Vec3.ZERO, this.node.eulerAngles.y * 0.01745);
        this.cldSize.set(Math.abs(this.tmpP.x), Math.abs(this.tmpP.z));

        this.collider.setRectSize(this.cldSize);
        this.collider.setRectPos(this.pos);
        this.collider.updateGridInfo(true);
        this.collider.isCircleCollider = this.isCircleCollider;
    }

    resetCollider() {
        super.resetCollider();
        this.isTriggerUsed = false;
    }

    checkRadius = GlobalConfig.Player.checkRadius;
    tmpP2 = v2();
    checkCollistion() {
        //触发器
        if (!this.isTriggerUsed && this.collider) {
            // this.collider && this.collider.checkPosFast(this.pos, this.onTriggerEnter.bind(this));
            this.tmpP.set(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset);
            this.tmpP2.set(this.tmpP.x, this.tmpP.z);
            if (Intersection2D.rectCircle(this.collider.selfRect, this.tmpP2, this.checkRadius)) {
                this.onTriggerEnter();
            }
        }
    }

    onTriggerEnter() {
        if (this.isTriggerUsed) return;
        this.isTriggerUsed = true;
        this.showMoveDownAnim();
        //触发效果
        this.emit(EventTypes.RoleEvents.AddRoles, this.symbolType, this.num);
        this.emit(EventTypes.CurLevelEvents.HideIncreaceProp, this._panelId);
    }

    //#endregion

    //#region -------------------事件---------------
    onHidePanel(id) {
        if (id == this._panelId && !this.isTriggerUsed) {
            this.isTriggerUsed = true;
            this.showMoveDownAnim();
        }
    }
    //#endregion
}


