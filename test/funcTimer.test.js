import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import initTimer from '../src/funcTimer.js';

describe('funcTimer', () => {
    it('应包装函数并返回相同数量', () => {
        const timer = {};
        const fnA = (x) => x + 1;
        const fnB = (x) => x * 2;
        const [wrappedA, wrappedB] = initTimer(timer, [fnA, fnB]);

        assert.equal(typeof wrappedA, 'function');
        assert.equal(typeof wrappedB, 'function');
        assert.equal(wrappedA(3), 4);
        assert.equal(wrappedB(3), 6);
    });

    it('应挂载 checkTimes 方法', () => {
        const timer = {};
        initTimer(timer, [() => {}]);
        assert.equal(typeof timer.checkTimes, 'function');
    });

    it('初始调用次数应为 0', () => {
        const timer = {};
        initTimer(timer, [() => {}, () => {}]);
        const counts = timer.checkTimes();
        assert.deepEqual(counts, [0, 0]);
    });

    it('调用后计数应递增', () => {
        const timer = {};
        const [fnA, fnB] = initTimer(timer, [(x) => x, (x) => x]);

        fnA(1);
        assert.deepEqual(timer.checkTimes(), [1, 0]);

        fnB(2);
        assert.deepEqual(timer.checkTimes(), [1, 1]);

        fnA(3);
        fnA(4);
        assert.deepEqual(timer.checkTimes(), [3, 1]);
    });

    it('checkTimes 应返回快照而非引用', () => {
        const timer = {};
        const [fn] = initTimer(timer, [(x) => x]);

        const counts1 = timer.checkTimes();
        fn();
        const counts2 = timer.checkTimes();

        assert.deepEqual(counts1, [0]);
        assert.deepEqual(counts2, [1]);
        // 修改 counts2 不应影响后续 checkTimes 结果
        counts2[0] = 999;
        assert.deepEqual(timer.checkTimes(), [1]);
    });

    it('应正确转发 this 和 arguments', () => {
        const timer = {};
        const obj = {
            value: 42,
            fn: function (multiplier) {
                return this.value * multiplier;
            },
        };
        const [wrapped] = initTimer(timer, [obj.fn]);
        assert.equal(wrapped.call(obj, 2), 84);
    });

    it('多次 initTimer 应互不干扰', () => {
        const timerA = {};
        const timerB = {};
        const [fnA] = initTimer(timerA, [() => {}]);
        const [fnB] = initTimer(timerB, [() => {}]);

        fnA();
        fnA();
        assert.deepEqual(timerA.checkTimes(), [2]);
        assert.deepEqual(timerB.checkTimes(), [0]);
    });
});
