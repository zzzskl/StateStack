// funcTransformer — 函数复合模块
// 将 simplest 级别的原始函数，经过 overwriteChain 逐层复合，得到 simple 级别的加强函数
//
// overwriteChain 是一个数组，每个元素都是 (prevFunc) => newFunc 类型
// transformer(originalFunc, overwriteChain) 对 chain 做 reduce 得到最终复合函数

export function transformer(originalFunc, overwriteChain) {
    if (!overwriteChain || overwriteChain.length === 0) {
        return originalFunc;
    }
    return overwriteChain.reduce((prevFunc, fn) => fn(prevFunc), originalFunc);
}
