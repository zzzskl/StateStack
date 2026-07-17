import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import initTimer from '../src/funcTimer.js';
import type { Timer } from '../src/types.js';

describe('funcTimer', () => {
    it('应包装函数并返回相同数量', () => {
        const timer = {} as Timer;
        const fnA = (x: number) => x + 1;
        const fnB = (x: number) => x * 2;
        const [wrappedA, wrappedB] = initTimer(timer, [fnA, fnB]);

        assert.equal(typeof wrappedA, 'function');
        assert.equal(typeof wrappedB, 'function');
        assert.equal(wrappedA(3), 4);
        assert.equal(wrappedB(3), 6);
    });

    it('应挂载 checkTimes 方法', () => {
        const timer = {} as Timer;
        initTimer(timer, [() => {}]);
        assert.equal(typeof timer.checkTimes, 'function');
    });

    it('初始调用次数应为 0', () => {
        const timer = {} as Timer;
        initTimer(timer, [() => {}, () => {}]);
        const counts = timer.checkTimes();
        assert.deepEqual(counts, [0, 0]);
    });

    it('调用后计数应递增', () => {
        const timer = {} as Timer;
        const [fnA, fnB] = initTimer(timer, [(x: unknown) => x, (x: unknown) => x]);

        fnA(1);
        assert.deepEqual(timer.checkTimes(), [1, 0]);

        fnB(2);
        assert.deepEqual(timer.checkTimes(), [1, 1]);

        fnA(3);
        fnA(4);
        assert.deepEqual(timer.checkTimes(), [3, 1]);
    });

    it('checkTimes 应返回快照而非引用', () => {
        const timer = {} as Timer;
        const [fn] = initTimer(timer, [(x: unknown) => x]);

        const counts1 = timer.checkTimes();
        fn(undefined);
        const counts2 = timer.checkTimes();

        assert.deepEqual(counts1, [0]);
        assert.deepEqual(counts2, [1]);
        counts2[0] = 999;
        assert.deepEqual(timer.checkTimes(), [1]);
    });

    it('应正确转发 this 和 arguments', () => {
        const timer = {} as Timer;
        const obj = {
            value: 42,
            fn: function (this: any, multiplier: number) {
                return this.value * multiplier;
            },
        };
        const [wrapped] = initTimer(timer, [obj.fn]);
        assert.equal(wrapped.call(obj, 2), 84);
    });

    it('多次 initTimer 应互不干扰', () => {
        const timerA = {} as Timer;
        const timerB = {} as Timer;
        const [fnA] = initTimer(timerA, [() => {}]);
        const [fnB] = initTimer(timerB, [() => {}]);

        fnA();
        fnA();
        assert.deepEqual(timerA.checkTimes(), [2]);
        assert.deepEqual(timerB.checkTimes(), [0]);
    });
});
