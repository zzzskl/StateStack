// Type definitions for state-stack

/**
 * 状态栈实例
 */
export interface StateStackInstance {
    /** 运行状态机 */
    run(): void;
    /** 读取当前状态快照 */
    readState(): StateSnapshot;
    /** 向栈中推入数据 */
    push(data: unknown): void;
    /** 销毁实例，销毁后所有方法均抛错 */
    destroy(): void;
}

export interface StateSnapshot {
    status: unknown;
    resultData: Record<string, unknown>;
}

/**
 * 状态栈定义对象——createStateStack 的最终参数
 */
export interface StateStackDefinitionObject {
    /** 状态类型描述（仅作声明，不参与初始化） */
    state: {
        status: unknown[];
        resultData: Record<string, unknown>;
        extra?: Record<string, unknown>;
    };
    /** 自定义 peek 实现，参数 simplePeek 是模块链增强后的基础 peek */
    peek: (simplePeek: () => unknown) => unknown;
    /** 自定义 push 实现，参数 (simplePush, data) */
    push: (simplePush: (data: unknown) => void, data: unknown) => void;
    /** 自定义 pop 实现，参数 (simplePop, simpleWriteResultData) */
    pop: (simplePop: () => unknown, simpleWriteResultData: (value: unknown) => void) => void;

    /** 状态分发器，读取当前状态名称 */
    statusDispatcher: (peek: () => unknown, status: unknown) => unknown;

    /** 初始化函数，在 run 开始时执行 */
    init?: (state: StateSnapshot, push: (data: unknown) => void) => void;

    /** 自定义状态处理函数 */
    [statusName: string]: StateHandler | unknown[] | Record<string, unknown> | undefined;
}

/**
 * 状态处理函数——对应 definition 中的每个状态（statusA / statusB / ...）
 */
export interface StateHandler {
    (state: StateSnapshot, peek: () => unknown, api: StateAPI): void;
}

/**
 * 状态 API——状态处理函数中可调用的方法
 */
export interface StateAPI {
    /** 受限的 writeResultData（每轮最多调用一次） */
    writeResultData(value: unknown): void;
    /** 受限的 writeExtra（每轮最多调用一次） */
    writeExtra(value: unknown): void;
    /** 受限的 switchStatus（每轮最多调用一次） */
    switchStatus(nextStatus: unknown, effect?: EffectDescriptor): void;
    /** 创建子栈 */
    createChildStateStack(def: StateStackDefinitionObject, id: string): void;
    /** 获取子栈操作接口 */
    childStateStack(id: string): ChildStateStackHandle;
}

/**
 * effect 描述——switchStatus 的第二个参数
 */
export interface EffectDescriptor {
    effect?: 'pop' | 'push' | 'run';
    param?: unknown;
}

/**
 * 子栈操作接口
 */
export interface ChildStateStackHandle {
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}

/**
 * 模块覆写对象——refineCreateStateStack 的参数
 * 每个字段接收前一个版本的函数，返回包装后的新函数
 */
export interface StateStackRefinementObject {
    pop?: (prevPop: () => unknown) => () => unknown;
    push?: (prevPush: (data: unknown) => void) => (data: unknown) => void;
    peek?: (prevPeek: () => unknown) => () => unknown;
    switchStatus?: (prevSwitchStatus: (...args: unknown[]) => void) => (...args: unknown[]) => void;
    writeResultData?: (prevWriteResultData: (value: unknown) => void) => (value: unknown) => void;
    writeExtra?: (prevWriteExtra: (value: unknown) => void) => (value: unknown) => void;
}

/**
 * 柯里化后的 createStateStack——用于模块链
 */
export interface CurriedCreateStateStack {
    (param: StateStackDefinitionObject): StateStackInstance;
    (param: StateStackRefinementObject): CurriedCreateStateStack;
}

/**
 * 创建状态栈实例
 *
 * @param param - 定义对象或模块覆写对象
 * @param runParent - 控制流回传回调
 */
export declare function createStateStack(
    param: StateStackDefinitionObject,
    runParent?: () => void
): StateStackInstance;
export declare function createStateStack(
    param: StateStackRefinementObject,
    runParent?: () => void
): CurriedCreateStateStack;

/**
 * 模块层装饰器——恒等函数，作为纯视觉标识
 */
export declare function refineCreateStateStack(
    refinementObject: StateStackRefinementObject
): StateStackRefinementObject;
