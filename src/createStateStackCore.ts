// createStateStackCore.ts — 核心工厂
// 结构：预处理区 → instanceBuildingScope(四层) → instanceRunningScope

import { createStateStackPrototype } from './Stack.js';
import { transformer } from './funcTransformer.js';
import initTimer from './funcTimer.js';
import { initClosure } from './closureService.js';
import type {
    StateSnapshot,
    StateAPI,
    StateHandler,
    StateStackDefinition,
    StateStackInstance,
    RefinementObject,
    CurriedCreateStateStack,
    Timer,
    EndFlag,
    InternalState,
    EffectDescriptor,
    MutableStateAPI,
} from './types.js';

export function createStateStackCore<S extends string>(
    closure: ReturnType<typeof initClosure>,
    definitionObject: StateStackDefinition<S>,
    runParent?: () => void
): StateStackInstance {

    // ═══════════════════════════════════════════
    // 预处理区
    // ═══════════════════════════════════════════
    let {
        state: stateTypeObject,
        peek: peekDefinition,
        push: pushDefinition,
        pop: popDefinition,
        statusDispatcher,
        init,
    } = definitionObject;

    const knownFields = new Set(['state', 'stackElement', 'peek', 'push', 'pop', 'statusDispatcher', 'init']);
    const statusOperationObject: Record<string, StateHandler<S>> = {};
    const keys = Object.keys(definitionObject);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!knownFields.has(key)) {
            statusOperationObject[key] = (definitionObject as Record<string, StateHandler<S>>)[key];
        }
    }

    const _statusDispatcher = statusDispatcher;

    // 默认 definition：透传，prev 在第一参数位
    type AnyFunc = (...args: any[]) => any;
    const _defaultDef = function (this: any, prev: AnyFunc) {
        return prev.apply(this, Array.prototype.slice.call(arguments, 1) as any);
    };
    (peekDefinition as AnyFunc | undefined) ||= _defaultDef;
    (pushDefinition as AnyFunc | undefined) ||= _defaultDef;
    (popDefinition as AnyFunc | undefined) ||= _defaultDef;

    const stateStackPrototype = createStateStackPrototype();

    // ═══════════════════════════════════════════
    // instanceBuildingScope
    // ═══════════════════════════════════════════
    function instanceBuildingScope(): StateStackInstance {

        // ── variableLayer ──
        const state = stateStackPrototype.state as InternalState;
        const childStateStackMap: Record<string, StateStackInstance> = {};
        const checkTimes: Timer = {} as Timer;

        // ── functionLayer1 ──
        const simplePeek = transformer(stateStackPrototype.peek, closure.getChain('peek'));
        const simplePop = transformer(stateStackPrototype.pop, closure.getChain('pop'));
        const simplePush = transformer(stateStackPrototype.push, closure.getChain('push'));
        const simpleWriteResultData = transformer(stateStackPrototype.writeResultData, closure.getChain('writeResultData'));

        // 受限函数（initTimer 包装 + 计数）
        const [restrictWriteExtra, restrictWriteResultData, restrictSwitchStatus] = initTimer(checkTimes, [
            transformer(stateStackPrototype.writeExtra, closure.getChain('writeExtra')),
            simpleWriteResultData,
            transformer(
                function (nextStatus: unknown, _ref: unknown, ef: EndFlag) {
                    ef.value = { nextStatus: nextStatus, effect: _ref as (EffectDescriptor | null) };
                },
                closure.getChain('switchStatus')
            )
        ]);

        // ── functionLayer2 ──
        function peek(): unknown { return peekDefinition!(simplePeek); }
        function captureState(): StateSnapshot {
            return {
                status: state.status,
                resultData: { ...state.resultData },
            };
        }

        // ── functionLayer3 ──
        let createChildStateStack: (def: any, id: string) => void = function (_def, _id) {
            throw new Error('createChildStateStack not implemented in this iteration');
        }

        let getchildStateStack: (id: string) => any = function (id) {
            const inst = childStateStackMap[id];
            if (!inst) {
                throw new Error('childStateStack id "' + id + '" not found');
            }
            return inst;
        }

        const api: MutableStateAPI = {
            writeResultData: restrictWriteResultData,
            writeExtra: restrictWriteExtra,
            switchStatus: restrictSwitchStatus,
            createChildStateStack: createChildStateStack as any, // 内部窄签名 → 宽接口
            childStateStack: getchildStateStack as any,
        };

        // ── functionLayer4 ──
        function push(data: unknown): void { (pushDefinition as AnyFunc)(simplePush, data); }

        // ═══════════════════════════════════════════
        // instanceRunningScope
        // ═══════════════════════════════════════════
        return (function instanceRunningScope(): StateStackInstance {
            if (init) { init(state, push); }

            const sDispatcher = _statusDispatcher;
            const statusOperation = statusOperationObject;

            function validateStatusOperation(timesBefore: number[], timesAfter: number[]) {
                for (let i = 0; i < timesBefore.length; i++) {
                    if (timesAfter[i] - timesBefore[i] > 1) {
                        throw new Error('函数 #' + i + ' 在一轮状态周期中调用超过一次');
                    }
                }
            }

            const endFlag: EndFlag = { value: null };

            // 覆写 api.switchStatus
            const origRestrictSwitchStatus = restrictSwitchStatus;
            api.switchStatus = function (nextStatus: unknown, _ref: unknown) {
                origRestrictSwitchStatus(nextStatus, _ref, endFlag);
            } as any;

            function run() {
                while (true) {
                    const curStatus = sDispatcher(peek, state.status as S | null);
                    const handler = statusOperation[curStatus as string];
                    if (!handler) break;

                    const timesBefore = checkTimes.checkTimes();
                    handler(captureState(), peek, api as unknown as StateAPI<S>);
                    const timesAfter = checkTimes.checkTimes();

                    validateStatusOperation(timesBefore, timesAfter);

                    // ── 处理 endFlag ──
                    const ef = endFlag.value;
                    endFlag.value = null;
                    if (!ef) break;

                    state.status = ef.nextStatus as string | null;
                    const e = ef.effect;
                    if (e) {
                        if (e.effect === 'pop') {
                            (popDefinition as AnyFunc)(simplePop, simpleWriteResultData);
                        } else if (e.effect === 'push') {
                            (push as any)(...(e.param as any[]));
                        } else if (e.effect === 'run') {
                            if (e.param && (e.param as any[])[0] === 'child') {
                                const childInst = childStateStackMap[(e.param as any[])[1]];
                                if (!childInst) {
                                    throw new Error('childStateStack id "' + (e.param as any[])[1] + '" not found');
                                }
                                childInst.run();
                            } else if (runParent) {
                                runParent();
                            }
                            break;
                        }
                    }

                    if (state.status === null) break;
                }
            }

            // 子栈 runParent = 父栈 run
            createChildStateStack = function (def: any, id: string) {
                const child = createStateStackCore(initClosure(), def, run) as any;
                childStateStackMap[id] = child;
            };
            getchildStateStack = function (id: string) {
                const inst = childStateStackMap[id];
                if (!inst) {
                    throw new Error('childStateStack id "' + id + '" not found');
                }
                return {
                    readState: function () { return inst.readState(); },
                    push: function (data: unknown) { inst.push(data); },
                    destroy: function (this: any) {
                        if (this._destroyed) return;
                        this._destroyed = true;
                        const msg = 'StateStack has been destroyed';
                        this.readState = function () { throw new Error(msg); };
                        this.push = function () { throw new Error(msg); };
                    },
                };
            };
            api.createChildStateStack = createChildStateStack as any;
            api.childStateStack = getchildStateStack as any;

            return {
                run: run,
                readState: function () {
                    return { status: state.status, resultData: state.resultData };
                },
                push: push,
                destroy: function (this: any) {
                    if (this._destroyed) return;
                    this._destroyed = true;
                    const msg = 'StateStack has been destroyed';
                    this.run = function () { throw new Error(msg); };
                    this.readState = function () { throw new Error(msg); };
                    this.push = function () { throw new Error(msg); };
                },
            };
        })();
    }

    return instanceBuildingScope();
}
