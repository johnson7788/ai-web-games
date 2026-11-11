import { _decorator, Node, } from 'cc';
import EventManager, { Handler } from '../../../../Init/Managers/EventManager';
const { ccclass, property } = _decorator;
/**用于自定义层级创建 不能直接挂载到节点 */
@ccclass('BasicLayer')
export class BasicLayer {
    //当前层级对应的节点
    protected node: Node = null;

    constructor(node?: Node) {
        this.node = node;
    }
    /**
    * 初始化数据-levelmanager 自动调用
    */
    public initLayer() {
        this.init();
        this.onEvents();
    }

    // #region -------------------------------层级生命周期------------
    /**初始化 只执行一次*/
    protected init() {

    };
    /**注册通过自定义事件管理器管理的事件  */
    protected onEvents() {

    };
    /**设置状态、数据等, */
    public setData(data?: any) {

    };
    /**重置状态、数据等，子类实现 ,注销事件*/
    public reset() {

    }
    //游戏中 update
    public customUpdate(dt: number) {

    }
    public customLateUpdate(dt: number) {

    }
    // #endregion

    // #region -------------------------------事件注册与注销-----------
    /**
     * 记录所有事件类型与对应回调函数的字典，销毁脚本时，根据此字典注销其事件
     * key:事件类型枚举值
     * value:事件类型对应的回调函数数组
     */
    private events: { [type: number]: Handler[] } = {};
    /**
     * 记录所有只触发一次的事件类型与对应回调函数的字典
     * key:事件类型枚举值
     * value:事件类型对应的回调函数数组
     */
    private onceEvents: { [type: number]: Handler[] } = {};
    /**
     * 注册事件 并记录起来 方便自动注销
     * @param {number} type 事件类型枚举值
     * @param {Function} cb 回调函数
     * @param {Object} target 函数所属对象
     */
    public on(type: number, cb: Function, target: Object) {
        let h: Handler = EventManager.on(type, cb, target);
        if (!!h) {
            if (!this.events.hasOwnProperty(type)) {
                this.events[type] = [];
            }
            this.events[type].push(h);
        }
    }
    /**
     * 注册只触发一次的事件
     * @param {number} type 事件类型枚举值
     * @param {Function} cb 回调函数
     * @param {Object} target 函数所属对象
     */
    public once(type: number, cb: Function, target: Object) {
        let h: Handler = EventManager.once(type, cb, target);
        if (!!h) {
            if (!this.onceEvents.hasOwnProperty(type)) {
                this.onceEvents[type] = [];
            }
            this.onceEvents[type].push(h);
        }
    }
    /**
     * 发送事件
     * @param {number} type 事件类型枚举值
     * @param {any} data 传给回调函数的参数
     */
    public emit(type: number, d1?: any, d2?: any) {
        if (undefined === d1) {
            EventManager.emit(type);
        } else if (undefined === d2) {
            EventManager.emit(type, d1);
        } else {
            EventManager.emit(type, d1, d2);
        }
        if (this.onceEvents.hasOwnProperty(type)) delete this.onceEvents[type];
    }
    /**
     * 注销事件
     * @param type 
     * @param cb 
     * @param target 
     */
    public off(type: number, cb: Function, target: Object) {
        let events = this.events[type];
        if (!!events) {
            for (let i = events.length - 1; i >= 0; --i) {
                if (events[i].cb === cb && events[i].target === target) {
                    EventManager.off(type, events[i]);
                    events.splice(i, 1);
                }
            }
        }
        events = this.onceEvents[type];
        if (!!events) {
            for (let i = events.length - 1; i >= 0; --i) {
                if (events[i].cb === cb && events[i].target === target) {
                    EventManager.off(type, events[i]);
                    events.splice(i, 1);
                }
            }
        }
    }
    /**
     * 注销脚本中注册的所有事件
     */
    public offEvents() {
        for (let key in this.events) {
            EventManager.offGroup(key, this.events[key]);
        }
        this.events = {};
        for (let key in this.onceEvents) {
            EventManager.offGroup(key, this.onceEvents[key]);
        }
        this.onceEvents = {};
    }
    //#endregion

}

