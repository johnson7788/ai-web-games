import { Prefab, Node, instantiate } from "cc";
import { BasicComponet } from "../Basic/BasicComponet";

/**全局节点对象池 */
export default class GlobalPool {
    private static allPools: { [prefabName: string]: AutoNodePool } = {};
    /**
     * 创建新的对象池
     * @param prefabName 节点名称
     * @param prefab 节点预制资源
     */
    public static createPool(prefabName: string, prefab: Prefab): void {
        if (!this.allPools.hasOwnProperty(prefabName)) {
            this.allPools[prefabName] = new AutoNodePool(prefab);
        }
    }
    /**
     * 获取实例
     * @param nodeName 要获取的节点名称
     * @param data 节点需要的数据
     * @returns {Node} 按传入的数据进行设置的节点实例
     */
    public static get(nodeName: string, data?: any): Node {
        if (!this.allPools[nodeName]) {
            console.warn("未创建对应名称的对象池，获取实例失败：", nodeName);
            return null;
        }
        return this.allPools[nodeName].get(data);
    }
    /**
     * 回收节点
     * @param nodeName 节点名称，与节点要放回的对象池名称对应
     * @param node 回收的节点
     */
    public static put(node: Node, nodeName?: string) {
        if (!node) return;
        if (!nodeName) nodeName = node.name;
        if (!this.allPools[nodeName]) {
            console.warn("未创建对应名称的对象池，将销毁节点：", nodeName);
            let js = node.getComponent(nodeName) as any;
            if (!!js && !!js.unuse) {
                js.unuse();
            }
            node.destroy();
            return;
        }
        this.allPools[nodeName].put(node);
    }
    /**
     * 回收节点的所有子节点
     * @param node 
     * @param sameNode  是否所有子节点为相同名字的节点，为true时可极轻微地加快回收速度
     */
    public static putAllChildren(node: Node, sameNode: boolean = false) {
        if (!node || node.children.length == 0) return;
        if (!!sameNode) {
            let nodeName = node.children[0].name;
            if (!!this.allPools[nodeName]) {
                let pool = this.allPools[nodeName];
                for (let i = node.children.length - 1; i >= 0; --i) {
                    pool.put(node.children[i]);
                }
            } else {
                for (let i = node.children.length - 1; i >= 0; --i) {
                    let js = node.children[i].getComponent(nodeName) as any;
                    if (!!js && !!js.unuse) {
                        js.unuse();
                    }
                    node.children[i].destroy();
                }
            }
        } else {
            for (let i = node.children.length - 1; i >= 0; --i) {
                let child = node.children[i];
                this.put(child);
            }
        }
    }
    /**
     * 清空对象池缓存，未指定名称时将清空所有的对象池
     * @param nodeName 对象池名称
     */
    public static clear(nodeName?: string) {
        if (!!nodeName) {
            if (this.allPools.hasOwnProperty(nodeName)) {
                this.allPools[nodeName].clear();
                delete this.allPools[nodeName];
            }
        } else {
            for (let key in this.allPools) {
                this.allPools[key].clear();
            }
            this.allPools = {};
        }
    }

    /**
     * 预先创建指定数量的对象并存储在对象池中
     * @param nodeName  与预制件名称对应的对象池名称
     * @param count     要创建的对象数量
     */
    public static preCreate(nodeName: string, count: number) {
        if (!!this.allPools[nodeName]) {
            this.allPools[nodeName].preCreate(count);
        } else {
            console.warn("不存在对应名称的对象池，无法预先创建实例：", nodeName);
        }
    }
}

/**
 * 节点对象池，对象池为空时可自动实例化新的对象
 */
export class AutoNodePool {
    private prefab: Prefab;
    private pool: { [key: string]: { cmp: BasicComponet, node: Node } };
    private keyArr: string[] = [];
    /**
     * 节点对象池，对象池为空时可自动实例化新的对象
     * @param prefab 预制
     * @param scriptName 节点挂载的脚本，管理节点进出对象池时的逻辑，必须实现接口IPoolObject
     */
    constructor(prefab: Prefab) {
        this.prefab = prefab;
        if (!prefab.data.getComponent(BasicComponet)) {
            // console.log("预制件" + prefab.data.name + "中不存在脚本: BasicComponet");
        }
        this.pool = {};
        this.keyArr = [];
    }

    /**
     * 获取实例
     * @param data 给实例赋值的数据
     */
    public get(data?: any): Node {
        if (this.keyArr.length > 0) {
            let key = this.keyArr.pop();
            let ele = this.pool[key];
            ele.cmp && ele.cmp.reuse(data);
            ele.node.active = true;
            delete this.pool[key];
            return ele.node;
        } else {
            //创建新的
            let node = instantiate(this.prefab);
            let cmp = node.getComponent(BasicComponet);
            cmp && cmp.init(data);
            node.active = true;
            return node;
        }
    }

    /**
     * 回收节点
     * @param node
     */
    public put(node: Node) {
        if (!node) return;
        let cmp = node.getComponent(BasicComponet);
        if (!!cmp && !!cmp.unuse) {
            cmp.unuse();
        }
        node.removeFromParent();
        node.active = false;

        let key = node.uuid;
        if (this.keyArr.indexOf(key) < 0) {
            this.keyArr.push(key);
            if (!this.pool[key]) {
                this.pool[key] = { cmp: cmp, node: node };
            }
        }
    }

    /**
     * 清空对象池，将销毁所有缓存的实例
     */
    public clear() {
        for (const key in this.pool) {
            let rec = this.pool[key];
            if (!!rec.cmp && !!rec.cmp.unuse) {
                rec.cmp.unuse();
            }
            rec.node.destroy();
        }
        this.pool = {};
        this.keyArr = [];
    }

    /**预先创建指定数量的对象存储在对象池中 */
    public preCreate(count: number) {
        let c = count - this.keyArr.length;
        if (c <= 0) return;
        for (let i = 0; i < c; ++i) {
            let node = instantiate(this.prefab);
            let cmp = node.getComponent(BasicComponet);
            cmp && cmp.init();
            this.put(node);
        }
    }
}
