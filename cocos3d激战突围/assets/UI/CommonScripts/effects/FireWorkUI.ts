import { _decorator, Component, Node, v3, Vec3, Animation } from 'cc';
import GlobalPool from '../../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('FireWorkUI')
export class FireWorkUI extends Component {
    @property(Node)
    pos: Node = null;
    @property(Node)
    layer: Node = null;

    itemName = 'Effect_IS_fireworks_001';

    recs: { [uuid: string]: FireWorkItem } = {};
    posArr: Vec3[] = [];
    showCd = 0.5;
    curt = 0;

    onLoad() {
    }

    onEnable() {
        for (const key in this.recs) {
            const rec = this.recs[key];
            rec && rec.anim && rec.anim.stop();
        }
        this.recs = {};
        GlobalPool.putAllChildren(this.layer);
        this.pos.children.forEach(e => {
            this.posArr.push(v3(e.position));
        })
        this.curt = 0;
    }

    createItems() {
        let scale = v3();
        let n = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < n; i++) {
            setTimeout(() => {
                if (this.node && this.node.activeInHierarchy) {
                    let node = GlobalPool.get(this.itemName);
                    scale.x = scale.y = Math.random() * 1 + 1;
                    node.setScale(scale);
                    node.setPosition(this.posArr[Math.floor(Math.random() * this.posArr.length)]);
                    node.parent = this.layer;
                    let cmp = new FireWorkItem(node);
                    this.recs[node.uuid] = cmp;
                    this.showCd = 0.2 + Math.random() * 0.5;
                    this.curt = 0;
                }
            }, 100 * i);
        }
    }

    update(dt) {
        this.curt += dt;
        if (this.curt >= this.showCd) {
            this.curt = 0;
            this.createItems();
        }

        for (const key in this.recs) {
            const rec = this.recs[key];
            if (rec.isFinish) {
                GlobalPool.put(rec.node);
                delete this.recs[key];
            } else {
                rec.update(dt);
            }
        }
    }

}

export class FireWorkItem {
    node: Node;
    anim: Animation;
    curt = 0;
    during = 0;
    isFinish = false;
    constructor(node: Node) {
        this.anim = node.getComponent(Animation);
        this.anim.stop();
        this.anim.play();
        this.during = this.anim.clips[0].duration;
    }

    update(dt) {
        this.curt += dt;
        if (this.curt > this.during) {
            this.isFinish = true;
        }
    }

}
