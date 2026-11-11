import { GlobalEnum } from "./GlobalEnum";

/**
 * 管理全局数据的类
 */
export default class GlobalData {
    protected static data: { [type: number]: any } = {};
    /**
     * 获取全局数据
     * @param type 数据名称
     */
    public static get(type: GlobalEnum.GlobalDataType) {
        return this.data[type];
    }
    /**
     * 设置全局数据，将覆盖原有数据
     * @param type 数据名称
     * @param value 数据内容
     */
    public static set(type: GlobalEnum.GlobalDataType, value: any) {
        this.data[type] = value;
    }
}