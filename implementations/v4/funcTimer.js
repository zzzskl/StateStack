// funcTimer — 受限函数调用计数器
// 调用者接口：
//   import initTimer from "funcTimer"
//   let timer;
//   const [newFuncA, newFuncB, newFuncC] = initTimer(timer, [funcA, funcB, funcC]);
//   const [calltimesA, calltimesB, calltimesC] = timer.checkTimes();

export default function initTimer(timer, funcs) {
    const counts = new Array(funcs.length);
    for (let i = 0; i < funcs.length; i++) {
        counts[i] = 0;
    }

    const restrictedFuncs = funcs.map(function (fn, i) {
        return function () {
            counts[i]++;
            return fn.apply(this, arguments);
        };
    });

    timer.checkTimes = function () {
        return counts.slice();
    };

    return restrictedFuncs;
}
