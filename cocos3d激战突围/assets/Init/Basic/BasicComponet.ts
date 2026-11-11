import { Component } from 'cc';
import EventManager, { Handler } from '../Managers/EventManager';

export class BasicComponet extends Component {
    //#region --------------------------------对象池调用流程--------------------------------
    /**
     * 初始化数据 只执行一次
     */
    public init(data?: any) {
        this.initSub(data);
        this.onEvents();
        this.setData(data);
    }
    /**初始化子类专属内容 只执行一次*/
    protected initSub(data?: any) { };
    /**注册通过自定义事件管理器管理的事件，*/
    protected onEvents() { };
    /**设置状态、数据等，子类实现 */
    protected setData(data?: any) { };

    /**从对象池中取回实例重新使用时将执行的方法，可重置状态、数据，设置新的状态、数据 */
    public reuse(data?: any) {
        this.reset();
        this.onEvents();
        this.setData(data);
    }
    /**放回对象池时将执行的方法，应当注销事件、计时器等 */
    public unuse() {
        this.reset();
        this.offEvents();
    }
    /**重置状态、数据等，子类实现 */
    public reset() { }

    //#endregion

    //#region --------------------------------事件注册与注销--------------------------------
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

    // #region --------------------------------cc生命周期--------------------------------
    /**自定义的更新方法 */
    public customUpdate(dt: number) {

    }
    /**自定义的late更新方法 需customUpdate之后调用 */
    public customLateUpdate(dt: number) {

    }
    /**对象销毁时自动注销所有事件 */
    public onDestroy() {
        this.offEvents();
    }
    // #endregion
}

