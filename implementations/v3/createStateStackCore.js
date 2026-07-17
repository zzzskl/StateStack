// createStateStackCore — 核心工厂
// 结构：预处理区 → instanceBuildingScope(四层) → instanceRunningScope

import { createStateStackPrototype } from './Stack.js';
import { transformer } from './funcTransformer.js';
import initTimer from './funcTimer.js';
import { initClosure } from './closureService.js';

export function createStateStackCore(closure, definitionObject, runParent) {
    // ═══════════════════════════════════════════
    // 预处理区
    // ═══════════════════════════════════════════
    const {
        state: stateTypeObject,
        peek: peekDefinition,
        push: pushDefinition,
        pop: popDefinition,
        statusDispatcher,
        init,
    } = definitionObject;

    const knownFields = new Set(['state', 'stackElement', 'peek', 'push', 'pop', 'statusDispatcher', 'init']);
    const statusOperationObject = {};
    const keys = Object.keys(definitionObject);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!knownFields.has(key)) {
            statusOperationObject[key] = definitionObject[key];
        }
    }

    const _statusDispatcher = statusDispatcher;

    // 默认 definition：透传，prev 在第一参数位
    const _defaultDef = function (prev) { return prev.apply(this, Array.prototype.slice.call(arguments, 1)); };
    peekDefinition ||= _defaultDef;
    pushDefinition ||= _defaultDef;
    popDefinition ||= _defaultDef;

    const stateStackPrototype = createStateStackPrototype();

    // ═══════════════════════════════════════════
    // instanceBuildingScope
    // ═══════════════════════════════════════════
    function instanceBuildingScope() {

        // ── variableLayer ──
        const state = stateStackPrototype.state;
        const childStateStackMap = {};
        const checkTimes = {};

        // ── functionLayer1 ──  对应调用者 peek / pop / push 字段的实参
        const simplePeek = transformer(stateStackPrototype.peek, closure.getChain('peek'));
        const simplePop = transformer(stateStackPrototype.pop, closure.getChain('pop'));
        const simplePush = transformer(stateStackPrototype.push, closure.getChain('push'));
        const simpleWriteResultData = transformer(stateStackPrototype.writeResultData, closure.getChain('writeResultData'));

        // 受限函数（initTimer 包装 + 计数，checkTimes 为载体变量）
        const [restrictWriteExtra, restrictWriteResultData, restrictSwitchStatus] = initTimer(checkTimes, [
            transformer(stateStackPrototype.writeExtra, closure.getChain('writeExtra')),
            simpleWriteResultData,
            transformer(
                function (nextStatus, _ref, ef) {
                    ef.value = { nextStatus: nextStatus, effect: _ref };
                },
                closure.getChain('switchStatus')
            )
        ]);

        // ── functionLayer2 ──  对应调用者 statusDispatcher 字段的实参
        function peek() { return peekDefinition(simplePeek); }
        function captureState() {
            return {
                status: state.status,
                resultData: { ...state.resultData },
                childStackState: { ...state.childStackState },
                extra: { ...state.extra },
            };
        }

        // ── functionLayer3 ──  对应调用者 statusA / statusB / … 字段的实参
        function createChildStateStack(_def, _id) {
            throw new Error('createChildStateStack not implemented in this iteration');
        }

        function getchildStateStack(id) {
            const inst = childStateStackMap[id];
            if (!inst) {
                throw new Error('childStateStack id "' + id + '" not found');
            }
            return inst;
        }

        const api = {
            writeResultData: restrictWriteResultData,
            writeExtra: restrictWriteExtra,
            switchStatus: restrictSwitchStatus,
            createChildStateStack: createChildStateStack,
            childStateStack: getchildStateStack,
        };

        // ── functionLayer4 ──  对应调用者 init 字段的实参
        function push(data) { pushDefinition(simplePush, data); }

        // ═══════════════════════════════════════════
        // instanceRunningScope
        // ═══════════════════════════════════════════
        return function instanceRunningScope() {
            if (init) { init(state, push); }

            const statusDispatcher = _statusDispatcher;
            const statusOperation = statusOperationObject;

            function validateStatusOperation(timesBefore, timesAfter) {
                for (let i = 0; i < timesBefore.length; i++) {
                    if (timesAfter[i] - timesBefore[i] > 1) {
                        throw new Error('函数 #' + i + ' 在一轮状态周期中调用超过一次');
                    }
                }
            }

            const endFlag = { value: null };

            // 覆写 api.switchStatus：buildingScope 的 restrictSwitchStatus 只负责计数；
            // runningScope 传入 endFlag，待 run 统一执行 effect。
            api.switchStatus = function (nextStatus, _ref) {
                restrictSwitchStatus(nextStatus, _ref, endFlag);
            };

            function run() {
                while (true) {
                    const curStatus = statusDispatcher(peek, captureState());
                    const handler = statusOperation[curStatus];
                    if (!handler) break;

                    const timesBefore = checkTimes.checkTimes();
                    handler(captureState(), peek, api);
                    const timesAfter = checkTimes.checkTimes();

                    validateStatusOperation(timesBefore, timesAfter);

                    // ── 处理 endFlag ──
                    const ef = endFlag.value;
                    endFlag.value = null;
                    if (!ef) break;

                    state.status = ef.nextStatus;
                    const e = ef.effect;
                    if (e) {
                        if (e.effect === 'pop') popDefinition(simplePop, simpleWriteResultData);
                        else if (e.effect === 'push') push(e.param);
                        else if (e.effect === 'run') {
                            if (e.param && e.param[0] === 'child') {
                                const childInst = childStateStackMap[e.param[1]];
                                if (!childInst) {
                                    throw new Error('childStateStack id "' + e.param[1] + '" not found');
                                }
                                childInst.run();
                                state.childStackState[e.param[1]] = childInst.readState();
                            } else if (runParent) {
                                runParent();
                            }
                        }
                    }

                    if (state.status === null) break;
                }
            }

            // 子栈 runParent = 父栈 run
            createChildStateStack = function (def, id) {
                const child = createStateStackCore(initClosure(), def, run);
                childStateStackMap[id] = child;
                state.childStackState[id] = child.readState();
            };
            getchildStateStack = function (id) {
                const inst = childStateStackMap[id];
                if (!inst) {
                    throw new Error('childStateStack id "' + id + '" not found');
                }
                return {
                    readState: function () { return inst.readState(); },
                    push: function (data) { inst.push(data); },
                    destroy: function () {
                        if (this._destroyed) return;
                        this._destroyed = true;
                        const msg = 'StateStack has been destroyed';
                        this.readState = function () { throw new Error(msg); };
                        this.push = function () { throw new Error(msg); };
                    },
                };
            };
            api.createChildStateStack = createChildStateStack;
            api.childStateStack = getchildStateStack;

            return {
                run: run,
                readState: function () {
                    return { status: state.status, resultData: state.resultData };
                },
                push: push,
                destroy: function () {
                    if (this._destroyed) return;
                    this._destroyed = true;
                    const msg = 'StateStack has been destroyed';
                    this.run = function () { throw new Error(msg); };
                    this.readState = function () { throw new Error(msg); };
                    this.push = function () { throw new Error(msg); };
                },
            };
        }();
    }

    return instanceBuildingScope();
}
