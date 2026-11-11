import { _decorator, Component, Node, Label, SpriteFrame, Sprite, color } from 'cc';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
import { ShopUI } from './ShopUI';
const { ccclass, property } = _decorator;

@ccclass('ShopItem')
export class ShopItem {
    node: Node = null;
    //
    type = null; //类型    
    cost = 0;    //价格
    //
    chooseMark: Node = null;
    display: Node = null;
    displaySf: Sprite = null;
    costBtn: Node = null;
    costLabel: Label = null;
    videoBtn: Node = null;
    lock: Node = null;
    lockLv: Label = null;
    //
    isChoosed = false;
    isUnLock = false;
    isDisplay = false;

    shopUI: ShopUI = null;

    constructor(node: Node, sf: SpriteFrame, shopUI: ShopUI) {
        this.node = node;
        this.shopUI = shopUI;

        this.chooseMark = this.node.getChildByName('chooseMark');
        this.display = this.node.getChildByName('display');
        this.displaySf = this.display.getComponentInChildren(Sprite);
        this.costBtn = this.node.getChildByName('costBtn');
        this.costLabel = this.costBtn.getComponentInChildren(Label);
        this.videoBtn = this.node.getChildByName('videoBtn');
        this.lock = this.node.getChildByName('lock');
        this.lockLv = this.lock.getComponentInChildren(Label);

        this.displaySf.spriteFrame = sf;
        this.onEvents();
    }

    init(type, cost: number) {
        this.type = type;
        this.cost = cost;
        this.costLabel.string = cost.toFixed(0);
        this.setChooseMark(false);
    }

    reset() {
        this.offEvents();
    }
    //刷新数据
    refreshData(isUnLock: boolean, isDisplay: boolean, lockLv = 0) {
        this.isUnLock = isUnLock;
        this.isDisplay = isDisplay;

        this.lock.active = !isDisplay;
        this.lockLv.string = lockLv.toFixed(0);
        this.videoBtn.active = this.isDisplay && !this.isUnLock;
        this.costBtn.active = false;
        this.displaySf.color = color().fromHEX(isUnLock ? '#FFFFFF' : '#000000');
    }

    onEvents() {
        this.costBtn.on(Node.EventType.TOUCH_END, this.onBuyClick, this);
        this.videoBtn.on(Node.EventType.TOUCH_END, this.onVideoClick, this);
        this.display.on(Node.EventType.TOUCH_START, this.onChoosedClick, this);
    }

    offEvents() {
        this.costBtn.off(Node.EventType.TOUCH_END, this.onBuyClick, this);
        this.videoBtn.off(Node.EventType.TOUCH_END, this.onVideoClick, this);
        this.display.off(Node.EventType.TOUCH_START, this.onChoosedClick, this);
    }

    setChooseMark(isChoosed: boolean) {
        this.isChoosed = isChoosed;
        this.chooseMark.active = isChoosed;
    }

    onChoosedClick() {
        this.shopUI.chooseItem(this.type);

        //判断是否解锁
        if (this.isUnLock) {
            //使用
            let chooseWeapon = StorageSystem.getData().userAssets.chooseWeapon;
            if (chooseWeapon != this.type && this.type != GlobalEnum.WeaponType.Drone) {
                StorageSystem.setData((d) => {
                    d.userAssets.chooseWeapon = this.type;
                    return d;
                }, true);

                //武器
                EventManager.emit(EventTypes.RoleEvents.SetWeapon, this.type);
            }

        }
    }
    //解锁
    unlockItem() {
        this.isUnLock = true;
        StorageSystem.setData((d) => {
            //解锁
            if (d.userAssets.unlockGoods.indexOf(this.type) < 0) {
                d.userAssets.unlockGoods.push(this.type);

                if (this.type == GlobalEnum.WeaponType.Drone) {
                    //无人机
                    EventManager.emit(EventTypes.CurLevelEvents.CreateDrones);
                }
            }
            //展示
            if (d.userAssets.displayGoods.indexOf(this.type) < 0) {
                d.userAssets.displayGoods.push(this.type);
            }

            return d;
        }, true)

        this.costBtn.active = false;
        this.videoBtn.active = false;
    }

    //-----------------
    onBuyClick() {
        let asset = StorageSystem.getData().userAssets.asset;
        if (asset < this.cost) {
            EventManager.emit(EventTypes.GameEvents.ShowTips, '钱不够哦!');
            UISystem.showUI(UIEnum.FreeGoldUI);
            return;
        } else {
            this.unlockItem();
            StorageSystem.setData((d) => {
                d.userAssets.asset -= this.cost;
                return d;
            }, true)
            StorageSystem.updateToAssets(false);
        }

        this.onChoosedClick();
        this.shopUI.setShopData();
    }

    onVideoClick() {
        EventManager.emit(EventTypes.SDKEvents.ShowVideo, () => {
            //观看视频成功
            EventManager.emit(EventTypes.GameEvents.GameResume);
            this.unlockItem();
            this.shopUI.setShopData();
        }, 1)
        this.onChoosedClick();

    }
}

