// Type definitions for @ffort_233/state-stack
// Auto-generated from src/types.ts — do not edit manually

// ══════════════════════════════════════════════════════════════
// 基础类型
// ══════════════════════════════════════════════════════════════

/** 状态快照 */
export interface StateSnapshot {
    status: string | null;
    resultData: Record<string, unknown>;
}

/** effect 描述符 */
export interface EffectDescriptor {
    effect?: 'pop' | 'push' | 'run';
    param?: unknown;
}

// ══════════════════════════════════════════════════════════════
// 子栈
// ══════════════════════════════════════════════════════════════

/** 子栈操作句柄 */
export interface ChildStateStackHandle {
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}

// ══════════════════════════════════════════════════════════════
// StateAPI（泛型：状态名 S）
// ══════════════════════════════════════════════════════════════

/** handler 的 api 参数 */
export interface StateAPI<S extends string = string> {
    writeResultData(value: unknown): void;
    writeExtra(value: unknown): void;
    /** 切换到声明过的状态（或 null 终止） */
    switchStatus(nextStatus: S | null, effect?: EffectDescriptor): void;
    createChildStateStack(def: Record<string, unknown>, id: string): void;
    childStateStack(id: string): ChildStateStackHandle;
}

// ══════════════════════════════════════════════════════════════
// Handler（泛型：状态名 S）
// ══════════════════════════════════════════════════════════════

/** 状态处理函数 */
export interface StateHandler<S extends string = string> {
    (state: StateSnapshot, peek: () => unknown, api: StateAPI<S>): void;
}

// ══════════════════════════════════════════════════════════════
// 定义对象（泛型：状态名 S）
// ══════════════════════════════════════════════════════════════

/** 状态类型声明字段 */
export interface StateTypeDeclaration {
    status: string[];
    resultData: Record<string, unknown>;
    extra?: Record<string, unknown>;
}

/**
 * 状态栈定义对象。
 * S 是 `state.status` 数组中声明的所有状态名的联合类型。
 * 每个 S 中的状态名必须有对应的 handler 函数。
 */
export interface StateStackDefinition<S extends string = string> {
    /** 状态类型声明（纯文档约定，不参与运行时初始化） */
    state: StateTypeDeclaration;
    /** 自定义 peek */
    peek?: (simplePeek: () => unknown) => unknown;
    /** 自定义 push */
    push?: (simplePush: (data: unknown) => void, data: unknown) => void;
    /** 自定义 pop */
    pop?: (simplePop: () => unknown, simpleWriteResultData: (value: unknown) => void) => void;
    /** 状态分发器：(peek, status) → 下一状态名 */
    statusDispatcher: (peek: () => unknown, status: S | null) => S | null;
    /** 初始化函数（createStateStack() 调用时立即执行） */
    init?: (state: StateSnapshot, push: (data: unknown) => void) => void;
    /** 栈元素结构（纯文档约定） */
    stackElement?: Record<string, unknown>;
    /** 状态处理函数（每个 S 中的状态名对应一个 handler） */
    [statusName: string]: StateHandler<S> | string[] | Record<string, unknown> | undefined;
}

// ══════════════════════════════════════════════════════════════
// 实例
// ══════════════════════════════════════════════════════════════

/** StateStack 实例 */
export interface StateStackInstance {
    run(): void;
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}

// ══════════════════════════════════════════════════════════════
// 模块链
// ══════════════════════════════════════════════════════════════

/** 模块覆写对象 */
export interface StateStackRefinementObject {
    pop?: (prevPop: () => unknown) => () => unknown;
    push?: (prevPush: (data: unknown) => void) => (data: unknown) => void;
    peek?: (prevPeek: () => unknown) => () => unknown;
    switchStatus?: (prevSwitchStatus: (...args: unknown[]) => void) => (...args: unknown[]) => void;
    writeResultData?: (prevWriteResultData: (value: unknown) => void) => (value: unknown) => void;
    writeExtra?: (prevWriteExtra: (value: unknown) => void) => (value: unknown) => void;
}

/** 柯里化的 createStateStack（模块链模式返回值） */
export interface CurriedCreateStateStack {
    <S extends string>(def: StateStackDefinition<S>): StateStackInstance;
    (ref: StateStackRefinementObject): CurriedCreateStateStack;
}

// ══════════════════════════════════════════════════════════════
// 函数声明
// ══════════════════════════════════════════════════════════════

/**
 * 创建状态栈实例
 *
 * @param def 定义对象（含 state 字段）→ 创建实例
 * @param runParent 控制流回传回调
 */
export function createStateStack<S extends string>(
    def: StateStackDefinition<S>,
    runParent?: () => void
): StateStackInstance;

/**
 * 创建状态栈模块链
 *
 * @param refinement 模块覆写对象（不含 state 字段）→ 返回柯里化函数
 * @param runParent 控制流回传回调
 */
export function createStateStack(
    refinement: StateStackRefinementObject,
    runParent?: () => void
): CurriedCreateStateStack;

/**
 * 模块层装饰器 — 恒等函数，纯视觉标识
 */
export function refineCreateStateStack(
    refinementObject: StateStackRefinementObject
): StateStackRefinementObject;
