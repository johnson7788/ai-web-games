import { _decorator, Component, Node, Vec3, Camera, Animation, v3 } from 'cc';
import GlobalData from '../../Init/Config/GlobalData';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../Init/Config/GlobalTmpData';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import GlobalPool from '../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('Effect2dLayer')
export class Effect2dLayer extends Component {
    cameraUI: Camera = null;
    effectRecs: { [uuid: string]: Effect2D } = {};
    @property(Node)
    preEffectLayer: Node = null; //置顶特效

    onLoad() {
        this.cameraUI = GlobalData.get(GlobalEnum.GlobalDataType.Camera3D);
        EventManager.on(EventTypes.EffectEvents.show3DTo2DEffect, this.onShow2DEffect, this);
        EventManager.on(EventTypes.EffectEvents.showUIEffect, this.onshowUIEffect, this);
    }

    onEnable() {
        this.reset();
    }

    reset() {
        for (const key in this.effectRecs) {
            const rec = this.effectRecs[key];
            rec.reset();
        }
        this.effectRecs = {};
        GlobalPool.putAllChildren(this.node);
        GlobalPool.putAllChildren(this.preEffectLayer);
    }

    update(dt: number) {
        for (const key in this.effectRecs) {
            const rec = this.effectRecs[key];
            if (rec && !rec.isFinish) {
                rec.update(dt);
            } else {
                rec.reset();
                delete this.effectRecs[key];
            }
        }
    }

    onShow2DEffect(d: { t: GlobalEnum.Effect2DType, p: Vec3, f?: Vec3 }) {
        if (GlobalTmpData.Game.isGameOver) return
        let e = GlobalPool.get(d.t);
        e.parent = this.node;
        let cmp = new EffectRec();
        cmp.init(this.cameraUI, e, d.p, d.f);
        this.effectRecs[e.uuid] = cmp;
    }
    onshowUIEffect(d: { t: GlobalEnum.Effect2DType, p: Vec3, }) {
        if (GlobalTmpData.Game.isGameOver) return
        let e = GlobalPool.get(d.t);
        e.parent = this.preEffectLayer;
        let cmp = new UIEffectRec()
        cmp.init(e, d.p);
        this.effectRecs[e.uuid] = cmp;
    }

}

export class Effect2D {
    isFinish = false;
    init(...d) { }
    reset() { }
    update(dt) { }
}

//3d->2d
export class EffectRec extends Effect2D {
    pos3d = v3();
    fromPos3d = v3();
    node: Node = null;
    camera: Camera = null;
    anim: Animation = null;
    finishTime = 0;
    curt = 0;
    isFinish = false;
    isRot = false;

    init(c: Camera, node: Node, p: Vec3, f?: Vec3) {
        this.camera = c;
        this.pos3d.set(p);
        this.node = node;
        this.anim = this.node.getComponent(Animation);
        let _scale = this.anim.getState(this.anim.clips[0].name).speed || 1;
        this.finishTime = this.anim.clips[0].duration / _scale;
        this.curt = 0;
        this.anim.play();
        this.isRot = !!f;
        !!f && this.fromPos3d.set(f);
        this.setPos();
    }

    reset() {
        this.anim.stop();
        GlobalPool.put(this.node);
    }
    _tmpPos = v3();
    _tmpPos2 = v3();
    setPos() {
        this.camera.convertToUINode(this.pos3d, this.node.parent, this._tmpPos);
        this.node.setPosition(this._tmpPos);
        //角度
        if (this.isRot) {
            this.camera.convertToUINode(this.fromPos3d, this.node.parent, this._tmpPos2);
            this._tmpPos.subtract(this._tmpPos2);
            let rZ = Math.atan2(this._tmpPos.y, this._tmpPos.z) * 57.3;
            this._tmpPos2.set(0, 0, rZ - 90);
            this.node.eulerAngles = this._tmpPos2;
        }
    }

    update(dt) {
        if (this.isFinish) return;
        this.curt += dt;
        if (this.curt >= this.finishTime) {
            this.isFinish = true;
        }
        this.setPos();
    }
}

//2d
export class UIEffectRec extends Effect2D {
    node: Node = null;
    anim: Animation = null;
    finishTime = 0;
    curt = 0;
    isFinish = false;
    init(node: Node, p: Vec3) {
        this.node = node;
        this.anim = this.node.getComponent(Animation);
        let _scale = this.anim.getState(this.anim.clips[0].name).speed || 1;
        this.finishTime = this.anim.clips[0].duration / _scale;
        this.curt = 0;
        this.anim.play();
        this.node.setPosition(p);
    }

    reset() {
        this.anim.stop();
        GlobalPool.put(this.node);
    }

    update(dt) {
        if (this.isFinish) return;
        this.curt += dt;
        if (this.curt >= this.finishTime) {
            this.isFinish = true;
        }
    }
}
