import { _decorator, Component, Node, Tween, tween, v3, Vec3 } from 'cc';
import GlobalPool from '../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('AssetAnimCmp')
export class AssetAnimCmp extends Component {

    @property(Node)
    protected layer: Node = null;
    @property(Node)
    protected mask: Node = null;

    protected _assetItem: SingleAsset[] = [];
    protected _isFinish = false;
    protected _finishCb = null;

    protected onLoad() {
        for (let i = 0; i < 20; i++) {
            let e = GlobalPool.get('assetItem');
            e.parent = this.layer;
            this._assetItem.push(new SingleAsset(e));
        }
        this.mask.active = false;
    }

    //入口
    public showAnim(fromPos: Vec3, toPos: Vec3, isMask = false, _finishCb?) {
        this.mask.active = isMask;
        this._isFinish = false;
        this._finishCb = _finishCb;
        this.node.active = true;
        this.node.setPosition(fromPos);

        let _toPos = v3(toPos);
        _toPos.subtract(this.node.position);

        for (let i = 0; i < this._assetItem.length; i++) {
            const e = this._assetItem[i];
            e.showAnim(_toPos);
        }

    }

    protected hide() {
        this.node.active = false;
        this.mask.active = false;
    }

    protected animFinish() {
        this._finishCb && this._finishCb();
        this._finishCb = null;
        this.hide();
    }

    protected update(dt) {
        if (!this._isFinish) {
            let count = 0;

            for (let i = 0; i < this._assetItem.length; i++) {
                const e = this._assetItem[i];
                e.update(dt);
                if (!e.node.active) {
                    count++;
                }
            }

            this._isFinish = count == this._assetItem.length;
            if (this._isFinish) {
                this.animFinish();
            }
        }
    }

}

export class SingleAsset {
    public static _ID = 0;
    node: Node = null;
    id = 0;

    constructor(n: Node) {
        this.node = n;
        this.node.active = false;
        this.id = SingleAsset._ID++;
    }

    protected _pos = v3();
    protected _toPos = v3();
    protected _isAnim = false;

    protected _scale = v3();

    showAnim(toPos: Vec3) {
        this._pos.set(Vec3.ZERO);
        this.node.setPosition(this._pos);

        this._toPos.x = Math.random() * 400 - 200;
        this._toPos.y = Math.random() * 150 + 50;
        Tween.stopAllByTarget(this._pos);
        this._isAnim = true;
        this.node.active = true;

        let time1 = Math.random() * 0.3 + 0.5;
        let time2 = Math.random() * 0.3 + 0.5;
        //散开
        tween(this._pos).to(time1, { x: this._toPos.x }).start();

        tween(this._pos).
            to(time1 * 0.7, { y: this._toPos.y + 100 }, { easing: 'sineOut' }).
            to(time1 * 0.3, { y: this._toPos.y }, { easing: 'sineIn' }).
            call(() => {
                this._toPos.set(toPos);
                //聚拢
                tween(this._pos).to(time2, { y: this._toPos.y }, { easing: 'sineInOut' }).start();
                tween(this._pos).to(time2, { x: this._toPos.x }).call(() => {
                    this._isAnim = false;
                    this.node.active = false;
                }).start();
            }).start();

        //缩放
        this._scale.set(0.2, 0.2, 0.2);
        Tween.stopAllByTarget(this._scale);
        tween(this._scale).
            to(time1, { x: 1, y: 1, z: 1 }).
            delay(time2 * 0.5).
            to(time2 * 0.5, { x: 0.2, y: 0.2, z: 0.2 }).
            start();
    }

    update(dt) {
        if (this._isAnim) {
            this.node.setPosition(this._pos);
            this.node.setScale(this._scale);
        }
    }


}

