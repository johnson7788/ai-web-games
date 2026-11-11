import { size, v2, v3, Vec3 } from "cc"
import { Role } from "../../Game/Script/Custom/Role";
import Tools from "../Tools/Tools";
import { BossHPInfo, HPInfo, PathInfo, } from "./GlobalClass";

/**整个游戏中 的临时存放数据 任意地方可使用*/
export class GlobalTmpData {
    /**重置 整个游戏 的临时数据 */
    public static reset() {
        // ----------框架数据--------
        this.timeScale = 1.0;
        this.Game.isGameRun = false;
        this.Game.isGameOver = false;
        this.Game.isGuideLv = false;
        this.Game.isGuideFinish = false;
        this.Game.isPause = false;
        // ---------当前游戏-----------
        Tools.clearObj(this.HpData);
        //
        this.ResetRailCount = 0;
        this.HpData = {};

        this.Player.isDeath = false;
        this.Player.isPathEnd = false;
        this.Player.wpos.set(0, 0, 0);
        this.Player.offset.set(0, 0, 0);
        //
        this.UIData.isEnterLv = false;
        //
        this.PathInfo = [];
        //
        this.endFormationRec = {};
        //
        this.normalRoleNum = 0;
    }

    // #region -----------框架中数据-------   
    /**游戏 dt 时间缩放值 */
    public static timeScale = 1.0;

    /**统计游戏数据 */
    public static Game = {
        isGameRun: false,
        isPause: false,
        isGameOver: false,
        isGuideLv: false,
        isGuideFinish: false,
        startTime: 0,       //游戏开始时间(ms)
        totalTime: 0,       //当前关卡累计运行时长(包括暂停)
        gameTime: 0,        //当前关卡累计游戏时长(不包括暂停)
        endTime: 0,         //结束时间
    }

    //#endregion

    // #region -----------当前游戏数据-------
    //剩余数量
    public static ResetRailCount = 0;

    /**存储角色的血量信息 - 用于UI显示*/
    public static HpData: { [uuid: string]: HPInfo } = {}

    //玩家信息 wrotY:弧度
    public static Player = {
        wpos: v3(), offset: v3(), wrotY: 0,
        lineVec: v3(),
        radius: 0.5, isDeath: false,
        //当前阵型包围盒
        formation: {
            minX: 0, maxX: 0,
            minZ: 0, maxZ: 0
        },
        endMarkPos: v3(),
        isPathEnd: false,
    };


    //
    public static UIData = {
        isEnterLv: false,
        onlineTime: 0,
        isShowTurnTableUI: false,
    }
    //当前地图所占的大小
    public static MapSize = v3();

    //路段信息
    public static PathInfo: PathInfo[] = [];
    //敌人数量统计
    public static EnemyNum = 0;
    //小兵数量统计
    public static normalRoleNum = 0;
    //终点的通道路径
    public static endPassPath: Vec3[] = [];

    //终点阵型记录
    public static endFormationRec: { [index: number]: { p: Vec3, role: Role, } } = {};

    //#endregion


}