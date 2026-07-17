import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStateStack, refineCreateStateStack } from '../src/createStateStack.js';
import type { StateStackDefinition } from '../src/types.js';

type TestStatus = 'start' | 'end';

function makeMinimalDefinition(): StateStackDefinition<TestStatus> {
    return {
        state: { status: ['start', 'end'], resultData: {} },
        peek: (peek: () => unknown) => peek(),
        push: (push: (d: unknown) => void, data: unknown) => push(data),
        pop: (pop: () => unknown) => pop(),
        statusDispatcher: (peek: () => unknown, status: TestStatus | null) => status,
        start: (state, peek, api) => { api.switchStatus('end'); },
        end: (state, peek, api) => { api.switchStatus(null); },
        init: (state, push) => { state.status = 'start'; },
    };
}

describe('createStateStack', () => {
    it('应直接创建实例（definition 模式）', () => {
        const ss = createStateStack(makeMinimalDefinition());
        assert.ok(ss);
        assert.equal(typeof ss.run, 'function');
        assert.equal(typeof ss.readState, 'function');
        assert.equal(typeof ss.push, 'function');
        assert.equal(typeof ss.destroy, 'function');
    });

    it('应创建带简单状态机的实例并正常完成', () => {
        const statusLog: string[] = [];
        const ss = createStateStack({
            state: { status: ['start', 'end'] as const, resultData: {} },
            peek: (peek: () => unknown) => peek(),
            push: (push: (d: unknown) => void, data: unknown) => push(data),
            pop: (pop: () => unknown) => pop(),
            statusDispatcher: (peek: () => unknown, status: 'start' | 'end' | null) => status,
            start: (state, peek, api) => {
                statusLog.push('start');
                api.switchStatus('end', { effect: 'push', param: ['x'] });
            },
            end: (state, peek, api) => {
                statusLog.push('end');
                api.switchStatus('end', { effect: 'run' });
            },
            init: (state, push) => { state.status = 'start'; },
        });
        ss.run();
        assert.deepEqual(statusLog, ['start', 'end']);
        assert.equal(ss.readState().status, 'end');
    });

    it('应共享同一个实例内部状态', () => {
        const ss = createStateStack(makeMinimalDefinition());
        const state1 = ss.readState();
        const state2 = ss.readState();
        assert.deepEqual(state1, state2);
    });

    it('destroy 后调用方法应抛错', () => {
        const ss = createStateStack(makeMinimalDefinition());
        ss.destroy();
        assert.throws(() => ss.run(), /destroyed/);
        assert.throws(() => ss.readState(), /destroyed/);
        assert.throws(() => ss.push('x'), /destroyed/);
    });

    it('destroy 应幂等', () => {
        const ss = createStateStack(makeMinimalDefinition());
        ss.destroy();
        ss.destroy();
        assert.ok(true);
    });

    it('应支持模块链创建', () => {
        const chainedSS = createStateStack(
            refineCreateStateStack({
                pop: (prevPop: () => unknown) => () => { prevPop(); },
            })
        );
        assert.ok(chainedSS);
        assert.equal(typeof chainedSS, 'function');
    });

    it('模块链应正确覆写 pop', () => {
        const popLog: string[] = [];
        const rss = createStateStack(
            refineCreateStateStack({
                pop: (prevPop: () => unknown) => () => {
                    popLog.push('intercepted');
                    prevPop();
                },
            })
        );
        const ss = (rss as any)({
            state: { status: ['start', 'end'] as const, resultData: {} },
            peek: (peek: () => unknown) => peek(),
            push: (push: (d: unknown) => void, data: unknown) => push(data),
            pop: (pop: () => unknown, writeResultData: (v: unknown) => void) => {
                popLog.push('definition-pop');
                pop();
            },
            statusDispatcher: (peek: () => unknown, status: 'start' | 'end' | null) => status,
            start: (state: any, peek: any, api: any) => {
                api.switchStatus('end', { effect: 'pop' });
            },
            end: (state: any, peek: any, api: any) => {
                api.switchStatus('end', { effect: 'run' });
            },
            init: (state: any) => { state.status = 'start'; },
        });
        ss.run();
        assert.deepEqual(popLog, ['definition-pop', 'intercepted']);
    });

    it('refineCreateStateStack 应恒等返回参数', () => {
        const obj = { pop: (prev: any) => prev };
        assert.equal(refineCreateStateStack(obj), obj);
    });

    it('非法参数应抛错', () => {
        assert.throws(() => createStateStack(null as any), /必须/);
        assert.throws(() => createStateStack(undefined as any), /必须/);
        assert.throws(() => createStateStack(42 as any), /必须/);
    });
});
