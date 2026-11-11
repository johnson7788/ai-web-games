import { _decorator, Component, Node, Vec3, UIOpacity, v3, tween, Prefab, instantiate } from 'cc';
import GlobalPool from '../../Init/Tools/GlobalPool';
import Tools from '../../Init/Tools/Tools';
const { ccclass, property } = _decorator;

@ccclass('Smook2dCmp')
export class Smook2dCmp extends Component {
    _smookeRecs: { [uuid: string]: SmokeItem } = {};
    @property(Prefab)
    smoke: Prefab = null;

    onLoad() {

    }
    _cd = 0.4;
    _curt = 0;
    update(dt: number) {
        this._curt += dt;
        if (this._curt >= this._cd) {
            this._curt = 0;
            this.createSmook();
        }

        for (const key in this._smookeRecs) {
            const rec = this._smookeRecs[key];
            if (!rec.isFinish) {
                rec.update(dt);
            } else {
                rec.reset();
                delete this._smookeRecs[key];
            }
        }

    }

    createSmook() {
        // let e = GlobalPool.get('smoke' + (Math.random() < 0.5 ? 1 : 2));
        let e = instantiate(this.smoke);
        e.parent = this.node;
        e.setPosition(0, 0, 0);
        let cmp = new SmokeItem(e);
        this._smookeRecs[e.uuid] = cmp;
    }

}

export class SmokeItem {
    node: Node;
    opacity: UIOpacity;
    p = v3();
    s = v3();
    o = { a: 0 };
    isFinish = false;
    _delay = 2;
    _enterOt = 0.05;
    _hideOt = 0.1;
    _curt = 0;

    constructor(node: Node) {
        this.node = node;
        this.opacity = node.getComponent(UIOpacity);
        this.node.setPosition(0, 0, 0);
        this.p.set(0, 0, 0);
        this.s.set(0.2, 0.2, 0.2);
        this.node.setScale(this.s);
        this.o.a = 0;
        this.opacity.opacity = this.o.a;
        this._curt = 0;
        this._enterOt = this._delay * 0.1;
        this._hideOt = this._delay * 0.2;
        this.showAnim();
    }

    showAnim() {
        let toX = Math.random() * 20 - 50;
        tween(this.p).to(this._delay, { x: toX, y: 100 }).call(() => { this.isFinish = true; }).start();
        tween(this.s).to(this._delay, { x: 1, y: 1 }, { easing: 'sineOut' }).start();
        tween(this.o).to(this._enterOt, { a: 255 }).delay(this._delay - this._enterOt - this._hideOt).to(this._hideOt, { a: 0 }).start();

    }
    tmpP = v3();
    update(dt) {
        if (!this.isFinish) {
            this.tmpP.set(this.node.parent.worldPosition).add(this.p);
            this.node.setWorldPosition(this.tmpP);
            this.node.setScale(this.s);
            this.opacity.opacity = this.o.a;
        }
    }

    reset() {
        GlobalPool.put(this.node);
        Tools.clearObj(this);
    }
}
