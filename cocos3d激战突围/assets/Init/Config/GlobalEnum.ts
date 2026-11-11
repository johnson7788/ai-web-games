
export namespace GlobalEnum {
    //#region -------------------------框架部分--------------------------
    //全局变量名称
    export enum GlobalDataType {
        Index = 0,
        Canvas,  //canvas Node
        CameraUI, //Camera 类型
        Camera3D, //Camera 类型
    }

    //#endregion 

    //#region -------------------------自定义部分------------------------
    export enum RoadType {
        DirecRoad,
        TurnRoad,
    }

    //移动方向-顺时针
    export enum MoveDirec {
        Front = 0, //-Z方向
        Right, //+X
        Back,  //+Z
        Left,  //-X
    }

    //奖励类型
    export enum AwardType {
        Asset = 0,  //钱-金币等
        Tip,
        Skin,
    }

    export enum LevelBtns {
        CreateBtn,
        DeleteBtn,
        RsetBtn,
        RunBtn,
        SkipBtn,
        TipBtn,
    }

    /**2D特效类型 */
    export enum Effect2DType {
        GetGold = 'GetGold',
    }

    export enum ThrowBullets {
        grenadesThrow = 'grenadesThrow', //手榴弹
    }

    /**3D特效类型 */
    export enum Effect3dType {

        //
        Effect_IS_buff_get_001 = 'Effect_IS_buff_get_001',
        Effect_IS_buff_prop_001 = 'Effect_IS_buff_prop_001',
        //
        Effect_jz_bomb_boom = 'Effect_jz_bomb_boom',
        Effect_jz_fireball_boom = 'Effect_jz_fireball_boom',
        Effect_jz_grenade_boom = 'Effect_jz_grenade_boom',
        Effect_jz_mine_boom = 'Effect_jz_mine_boom',
        Effect_jz_rocketboom = 'Effect_jz_rocketboom',

        //
        fireEffect = 'fireEffect', //火焰溅射
        fireWork = 'fireWork',      //焰火
    }

    /**自定义附加属性 */
    export enum ExtralProp {

    }

    //合并效果预制体名称
    export enum MergeEffectType {
        MergeEffect = 'mergeEffect',
        MergeFrameAnim = 'mergeFrameAnim', //test
        //阴影
        MergeShadow = 'mergeShadow',
        //手枪子弹
        MergePistolBullet = 'mergePistolBullet',
        //短枪子弹
        MergeShotgunBullet = 'mergeShotgunBullet',
        //喷火枪子弹
        MergeFireGunBullet = 'mergeFireGunBullet',
        //机关枪枪子弹
        MergeMachineGunBullet = 'mergeMachineGunBullet',

        //无人机
        MergeDroneBullet = 'mergeDroneBullet',

        //火箭烟雾
        MergeRocketSmook = 'mergeRocketSmook',

        //角色死亡
        MergeRoleDeath = 'mergeRoleDeath',
        //敌人受击
        MergeEnemyByHit = 'mergeEnemyByHit',
        //火焰残余效果
        MergeFireEffect = 'mergeFireEffect',
    }
    //合并效果的类型
    export enum MergeType {
        Boom0,
        Quad,
    }

    //玩家动作剪辑
    export enum PlayerClip {
        idle = 'idle',
        win = 'win',
        standShoot = 'standShoot',
        shootBack = 'shootBack',
        throwBack = 'throwBack',
        throwStand = 'throwStand',
    }
    //玩家动作剪辑
    export enum EnemyClip {
        run = 'run',
        rush = 'rush',
        death = 'death',
        idle = 'idle',
    }
    //敌人类型预制名称 与 EnemyType对应
    export enum EnemyPrefabs {
        Normal = 'enemyNormal',     //普通兵
        Bomb = 'enemyBomb',         //炸弹
        Ninja = 'enemyNinja',       //刺客
        Giant = 'enemyGiant',       //巨人 --
        Boss = 'enemyBoss',         //boss --
    }
    //敌人类型
    export enum EnemyType {
        Normal = 0, //普通兵
        Bomb,       //炸弹
        Ninja,      //刺客
        Giant,      //巨人
        Boss,
    }

    //场景道具类型
    export enum PropType {
        Weapon,     //武器
        Trap,       //陷阱
        Increase,   //增加
    }
    /**武器类型 - 与预制名称一致*/
    export enum WeaponType {
        Pistol,             //手枪
        Shotgun,            //短枪
        FireGun,            //喷火枪
        MachineGun,         //机关枪
        Grenades,           //手榴弹
        Drone,              //无人机
    }

    /**增加分数类型 */
    export enum IncreaseType {
        symbol_Add,         // +
        symbol_Reduce,      // -
        symbol_Multip,      // *
        symbol_Division     // /
    }
    /**陷阱 */
    export enum TrapType {
        ElectricSaw,        //圆形电锯
        Spininess,          //地刺
        Hammer,             //锤子
        Rocket,             //导弹
        FortBarbette,       //炮台
        UpperAirNail,       //高空钉
        LandMine,           //地雷
        //
        Increase,           //人数
    }

    //#endregion
}

