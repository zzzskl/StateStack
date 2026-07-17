import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStateStack, refineCreateStateStack } from '../src/createStateStack.js';

function makeMinimalDefinition() {
    return {
        state: { status: [], resultData: {} },
        peek: (peek) => peek(),
        push: (push, data) => push(data),
        pop: (pop) => pop(),
        statusDispatcher: (peek, status) => status,
        init: (state, push) => { state.status = null; },
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
        var statusLog = [];
        const ss = createStateStack({
            state: { status: [], resultData: {} },
            peek: (peek) => peek(),
            push: (push, data) => push(data),
            pop: (pop) => pop(),
            statusDispatcher: (peek, status) => status,
            start: (state, peek, api) => {
                statusLog.push('start');
                api.switchStatus('end', { effect: 'push', param: ['x'] });
            },
            end: (state, peek, api) => {
                statusLog.push('end');
                api.switchStatus(null, { effect: 'pop' });
            },
            init: (state, push) => { state.status = 'start'; },
        });

        ss.run();
        assert.deepEqual(statusLog, ['start', 'end']);
        assert.equal(ss.readState().status, null);
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
        ss.destroy(); // 第二次不应抛错
        assert.ok(true);
    });

    it('应支持模块链创建', () => {
        const popLog = [];
        const chainedSS = createStateStack(
            refineCreateStateStack({
                pop: (prevPop) => () => {
                    popLog.push('intercepted');
                    prevPop();
                },
            })
        )(makeMinimalDefinition());

        assert.ok(chainedSS);
        assert.equal(typeof chainedSS.run, 'function');
    });

    it('模块链应正确覆写 pop', () => {
        const popLog = [];
        const rss = createStateStack(
            refineCreateStateStack({
                pop: (prevPop) => () => {
                    popLog.push('intercepted');
                    prevPop();
                },
            })
        );

        const ss = rss({
            state: { status: [], resultData: {} },
            peek: (peek) => peek(),
            push: (push, data) => push(data),
            pop: (pop, writeResultData) => {
                popLog.push('definition-pop');
                pop();
            },
            statusDispatcher: (peek, status) => status,
            start: (state, peek, api) => {
                api.switchStatus(null, { effect: 'pop' });
            },
            init: (state, push) => { state.status = 'start'; },
        });

        ss.run();
        // 定义层 pop 包裹 refined simplePop，所以定义层先执行
        assert.deepEqual(popLog, ['definition-pop', 'intercepted']);
    });

    it('refineCreateStateStack 应恒等返回参数', () => {
        const obj = { pop: () => {} };
        assert.equal(refineCreateStateStack(obj), obj);
    });

    it('非法参数应抛错', () => {
        assert.throws(() => createStateStack(null), /必须/);
        assert.throws(() => createStateStack(undefined), /必须/);
        assert.throws(() => createStateStack(42), /必须/);
    });
});
