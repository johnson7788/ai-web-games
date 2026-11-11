
import { _decorator, Component, Node, v3, Widget, UITransform, Enum, UIOpacity, Tween, tween } from 'cc';
const { ccclass, property } = _decorator;
//入场方向
enum EnterDirection {
    None,
    Top,
    Bottom,
    Left,
    Right,
    Center_zoomOut, //放大
    Center_zoomIn,  //缩小
}
//缓动动画
enum EasingType {
    SineIn,
    SineOut,
    SineInOut,
    BackIn,
    BackOut,
    BackInOut,
}
//入场动画
@ccclass('UIAnimtions')
export class UIAnimtions extends Component {
    @property({ type: Enum(EnterDirection) })
    enterDirection: EnterDirection = EnterDirection.None;
    @property({ type: Enum(EasingType), visible() { return this.enterDirection != EnterDirection.None } })
    easingType: EasingType = EasingType.BackInOut;
    @property({ visible() { return this.enterDirection != EnterDirection.None && this.enterDirection != EnterDirection.Center_zoomOut } })
    moveDistRate = 1.5; //移动距离比例
    @property
    delayTime = 0;
    @property
    animTime = 0.5;
    @property
    isOpacityAnim = false;

    @property
    isDelayShowChildren = false;   //在动画完成之前是否隐藏子节点
    @property({ visible() { return this.isDelayShowChildren } })
    delayShowChildrenTime = 0;
    _delayTween = { a: 0 };

    _initPos = v3();
    _initScale = v3();

    _cfg = ['sineIn', 'sineOut', 'sineInOut', 'backIn', 'backOut', 'backInOut'];
    _finishCb = null;
    _cbTween = { a: 0 };

    //记录子节点原本的状态
    _childrenRecs: { isActive: boolean, node: Node }[] = [];
    onLoad() {
        this.init();
        this.recordChildren(true);
    }

    init() {
        this._initPos.set(this.node.position);
        this._initScale.set(this.node.scale);
    }

    recordChildren(isHide = false) {
        //若需要隐藏子节点时 提前隐藏
        this._childrenRecs = [];
        if (this.isDelayShowChildren) {
            for (let i = 0; i < this.node.children.length; i++) {
                const e = this.node.children[i];
                this._childrenRecs.push({ isActive: e.active, node: e });
                //先隐藏
                if (isHide) {
                    e.active = false;
                }
            }
        }
    }

    //外部更改
    seDelayTime(delayTime) {
        this.delayTime = delayTime;
    }

    onEnable() {
        this.showAnim();
    }
    onDisable() {
        //记录隐藏时子节点的状态
        this.recordChildren();
        Tween.stopAllByTarget(this._cbTween);
        Tween.stopAllByTarget(this._toPos);
        Tween.stopAllByTarget(this._toScale);
        Tween.stopAllByTarget(this._delayTween);
        Tween.stopAllByTarget(this._opacity);

    }

    setFinishAnim(cb) {
        this._finishCb = cb;
    }

    _toPos = v3();
    _toScale = v3();
    showAnim() {

        Tween.stopAllByTarget(this._cbTween);
        Tween.stopAllByTarget(this._toPos);
        Tween.stopAllByTarget(this._toScale);
        //方向动画
        if (this.enterDirection != EnterDirection.None) {
            // 显示动画
            let wg = this.node.getComponent(Widget);
            if (wg) {
                wg.enabled = true;
                wg.updateAlignment();
                wg.enabled = false;
                this._toPos.set(this.node.position);
            } else {
                this._toPos.set(this._initPos);
            }

            let trans = this.node.getComponent(UITransform);

            switch (this.enterDirection) {
                case EnterDirection.Top:
                    this.topAnim(trans);
                    break;
                case EnterDirection.Bottom:
                    this.bottomAnim(trans);
                    break;
                case EnterDirection.Left:
                    this.leftAnim(trans);
                    break;
                case EnterDirection.Right:
                    this.rightAnim(trans);
                    break;
                case EnterDirection.Center_zoomIn:
                    this.centerZoomOutAnim(trans);
                    break;
                case EnterDirection.Center_zoomOut:
                    this.centerZoomInAnim(trans);
                    break;
                default:
                    break;
            }
        }
        //透明动画
        if (this.isOpacityAnim) {
            this.opacityAnim();
        }
        //计时回调
        if (this._finishCb) {
            tween(this._cbTween).delay(this.delayTime + this.animTime).call(() => {
                this._finishCb && this._finishCb();
                this._finishCb = null;
            }).start();
        }
        //延迟显示子节点
        Tween.stopAllByTarget(this._delayTween);
        if (this.isDelayShowChildren) {
            tween(this._delayTween).delay(this.delayShowChildrenTime).call(() => {
                for (let i = 0; i < this._childrenRecs.length; i++) {
                    const e = this._childrenRecs[i];
                    e.node.active = e.isActive;
                }
            }).start();
        }
    }
    //位移/缩放动画完成后回调-不包含透明动画
    showAnimFinished() {
        //检测UIStayAnims
        let cmp = this.node.getComponent('UIStayAnimations');
        if (cmp && cmp.enabled && cmp['showAnim']) {
            cmp['showAnim']();
        }
    }

    //从上方入场 
    topAnim(trans: UITransform) {
        let toY = this._toPos.y;
        this._toPos.y += trans.height * this.moveDistRate;
        this.node.setPosition(this._toPos);
        let easing: any = this._cfg[this.easingType];

        tween(this._toPos).delay(this.delayTime).to(this.animTime, { y: toY }, {
            easing: easing, onUpdate: () => {
                this.node.setPosition(this._toPos);
            }
        }).call(() => {
            this.showAnimFinished();
        }).start();


    }
    //下方
    bottomAnim(trans: UITransform) {
        let toY = this._toPos.y;
        this._toPos.y -= trans.height * this.moveDistRate;
        this.node.setPosition(this._toPos);
        let easing: any = this._cfg[this.easingType];

        tween(this._toPos).delay(this.delayTime).to(this.animTime, { y: toY }, {
            easing: easing, onUpdate: () => {
                this.node.setPosition(this._toPos);
            }
        }).call(() => {
            this.showAnimFinished();
        }).start();
    }
    //左方
    leftAnim(trans: UITransform) {
        let toX = this._toPos.x;
        this._toPos.x -= trans.width * this.moveDistRate;
        this.node.setPosition(this._toPos);
        let easing: any = this._cfg[this.easingType];

        tween(this._toPos).delay(this.delayTime).to(this.animTime, { x: toX }, {
            easing: easing, onUpdate: () => {
                this.node.setPosition(this._toPos);
            }
        }).call(() => {
            this.showAnimFinished();
        }).start();
    }
    //右方
    rightAnim(trans: UITransform) {
        let toX = this._toPos.x;
        this._toPos.x += trans.width * this.moveDistRate;
        this.node.setPosition(this._toPos);
        let easing: any = this._cfg[this.easingType];

        tween(this._toPos).delay(this.delayTime).to(this.animTime, { x: toX }, {
            easing: easing, onUpdate: () => {
                this.node.setPosition(this._toPos);
            }
        }).call(() => {
            this.showAnimFinished();
        }).start();
    }

    //中心放大
    centerZoomOutAnim(trans: UITransform) {
        this._toScale.set(0, 0, 0);
        this.node.setScale(this._toScale);
        let easing: any = this._cfg[this.easingType];

        tween(this._toScale).delay(this.delayTime).to(this.animTime, { x: 1, y: 1, z: 1 }, {
            easing: easing, onUpdate: () => {
                this.node.setScale(this._toScale);
            }
        }).call(() => {
            this.showAnimFinished();
        }).start();
    }
    //中心缩小
    centerZoomInAnim(trans: UITransform) {
        this._toScale.set(this.moveDistRate, this.moveDistRate, this.moveDistRate);
        this.node.setScale(this._toScale);
        let easing: any = this._cfg[this.easingType];
        tween(this._toScale).delay(this.delayTime).to(this.animTime, { x: 1, y: 1, z: 1 }, {
            easing: easing, onUpdate: () => {
                this.node.setScale(this._toScale);
            }
        }).call(() => {
            this.showAnimFinished();
        }).start();
    }
    _uiOpacityCmp: UIOpacity = null;
    _opacity = { opacity: 255 };
    //透明动画
    opacityAnim() {
        //有透明度组件时 则执行透明的变化动画
        if (!this._uiOpacityCmp) {
            this._uiOpacityCmp = this.node.getComponent(UIOpacity);
            if (!this._uiOpacityCmp) {
                this._uiOpacityCmp = this.node.addComponent(UIOpacity);
            }
        }
        Tween.stopAllByTarget(this._opacity);
        if (this._uiOpacityCmp) {
            this._opacity.opacity = 0;
            this._uiOpacityCmp.opacity = 0;
            tween(this._opacity).delay(this.delayTime).to(this.animTime, { opacity: 255 }, {
                onUpdate: () => {
                    this._uiOpacityCmp.opacity = this._opacity.opacity;
                }
            }).start();
        }
    }
}

