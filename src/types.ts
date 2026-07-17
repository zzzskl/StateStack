// ============================================================================
// types.ts — StateStack 完整类型定义
// 基于 experiments/ts-prototype 已验证的模式
// ============================================================================

// ── 基础数据结构 ──

/** 状态快照，handler 的 state 参数 */
export interface StateSnapshot {
    status: string | null;
    resultData: Record<string, unknown>;
}

/** effect 描述符，switchStatus 的第二参数 */
export interface EffectDescriptor {
    effect?: 'pop' | 'push' | 'run';
    param?: unknown;
}

// ── 子栈 ──

/** 子栈操作句柄 */
export interface ChildStateStackHandle {
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}

// ── StateAPI ──

/** handler 的 api 参数（公开签名） */
export interface StateAPI<S extends string> {
    writeResultData(value: unknown): void;
    writeExtra(value: unknown): void;
    switchStatus(nextStatus: S | null, effect?: EffectDescriptor): void;
    createChildStateStack(def: Record<string, unknown>, id: string): void;
    childStateStack(id: string): ChildStateStackHandle;
}

// ── Handler ──

/** 状态处理函数 */
export type StateHandler<S extends string> = (
    state: StateSnapshot,
    peek: () => unknown,
    api: StateAPI<S>
) => void;

// ── 定义对象（核心） ──

/** 已知字段（非 handler 的保留字段） */
export interface KnownFields<S extends string> {
    /** 状态类型声明（纯文档约定，不参与运行时初始化） */
    state: {
        status: S[];
        resultData: Record<string, unknown>;
        extra?: Record<string, unknown>;
    };
    /** 自定义 peek */
    peek?: (simplePeek: () => unknown) => unknown;
    /** 自定义 push */
    push?: (simplePush: (data: unknown) => void, data: unknown) => void;
    /** 自定义 pop */
    pop?: (simplePop: () => unknown, simpleWriteResultData: (value: unknown) => void) => void;
    /** 状态分发器：(peek, status) → 下一状态名 */
    statusDispatcher: (peek: () => unknown, status: S | null) => S | null;
    /** 初始化函数 */
    init?: (state: StateSnapshot, push: (data: unknown) => void) => void;
    /** 栈元素结构（纯文档约定） */
    stackElement?: Record<string, unknown>;
}

/**
 * 状态栈定义对象。
 * `state` 字段的 `status` 数组声明所有状态名，每个状态名对应一个 handler。
 */
export type StateStackDefinition<S extends string> =
    KnownFields<S> &
    { [K in S]: StateHandler<S> };

// ── 实例 ──

/** StateStack 实例 */
export interface StateStackInstance {
    run(): void;
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}

// ── 模块链 ──

/** 模块覆写对象 */
export interface RefinementObject {
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
    (ref: RefinementObject): CurriedCreateStateStack;
}

// ══════════════════════════════════════════════════════════════
// 内部类型（不对外暴露，仅供 core 实现使用）
// ══════════════════════════════════════════════════════════════

/** api 的中间态（buildingScope 创建时的宽松签名） */
export interface MutableStateAPI {
    writeResultData: (value: unknown) => void;
    writeExtra: (value: unknown) => void;
    switchStatus: (...args: unknown[]) => void;
    createChildStateStack: (...args: unknown[]) => void;
    childStateStack: (...args: unknown[]) => unknown;
}

/** 调用计数器载体 */
export interface Timer {
    checkTimes(): number[];
}

/** 内部状态（包含未公开的字段） */
export interface InternalState {
    status: string | null;
    resultData: Record<string, unknown>;
    extra: Record<string, unknown>;
}

/** endFlag 数据结构 */
export interface EndFlagRecord {
    nextStatus: unknown;
    effect?: EffectDescriptor | null;
}

/** endFlag 容器（可变引用模式） */
export interface EndFlag {
    value: EndFlagRecord | null;
}
