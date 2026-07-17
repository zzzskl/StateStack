# API Reference

> This document is the complete API reference for StateStack. For tutorials and examples, see the [Usage Guide](./usage-guide.md).

---

## `createStateStack(param, runParent?)`

### Definition Mode — Create an Instance

When the parameter contains a `state` field, an instance is created directly.

```
createStateStack(definition: StateStackDefinition<S>, runParent?: () => void): StateStackInstance
```

**`definition` field table:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | `{ status: string[], resultData: object, extra?: object }` | ✓ | State type declaration (not used for initialization, purely documentation) |
| `peek` | `(simplePeek: () => unknown) => unknown` | | Custom peek logic, wrapping the base peek |
| `push` | `(simplePush: (data: unknown) => void, data: unknown) => void` | | Custom push logic |
| `pop` | `(simplePop: () => unknown, simpleWriteResultData: (value: unknown) => void) => void` | | Custom pop logic, can write final result here |
| `statusDispatcher` | `(peek: () => unknown, status: S \| null) => S \| null` | ✓ | Returns the name of the state whose handler should execute; returns `null` to terminate the state machine |
| `init` | `(state: StateSnapshot, push: (data: unknown) => void) => void` | | Initialization function, runs immediately when `createStateStack()` is called |
| `[statusName]` | `(state: StateSnapshot, peek: () => unknown, api: StateAPI<S>) => void` | | State handler function, named by field name |

> `S` is the union type of all strings in `state.status`. Every status name in `S` must have a corresponding handler.

**Parameter notes:**

- `simplePeek` / `simplePush` / `simplePop` — the base stack operations enhanced by the module chain; call these to trigger actual stack behavior
- `simpleWriteResultData` — base result write function, directly overwrites `state.resultData`
- Additional parameters (such as `data`) are passed by `switchStatus`'s `effect.param` or external `ss.push()`

**`runParent` callback:**

When a handler calls `switchStatus` with `{ effect: 'run' }` and no child stack is specified, control is returned to the `runParent` callback and the current loop terminates.

```js
const ss = createStateStack({ /* ... */ }, () => {
    console.log('Control returned to the caller');
});
```

---

### Module Chain Mode — Returns a Curried Function

When the parameter does NOT contain a `state` field, module chain mode is activated.

```
createStateStack(refinement: StateStackRefinementObject, runParent?): CurriedCreateStateStack
```

The returned `CurriedCreateStateStack` can receive further `refinementObject` calls (to keep stacking) or a `StateStackDefinition` (to terminate the chain and create an instance).

```js
const curried = createStateStack({ pop: (prev) => () => { /* ... */ prev(); } });
const instance = curried({ state: { status: [], resultData: {} }, /* ... */ });
```

---

## `refineCreateStateStack(refinementObject)`

Identity function — input equals output. It serves only as a **visual marker** and does not change behavior.

```typescript
function refineCreateStateStack(refinementObject: StateStackRefinementObject): StateStackRefinementObject
```

Purpose:
- Helps readers identify "this is a function overwrite"
- Provides type inference in TypeScript

---

## `StateStackRefinementObject`

An object used in module chain mode to overwrite functions. Each field is a `(prevFunc) => newFunc` style wrapper.

```typescript
interface StateStackRefinementObject {
    pop?:            (prevPop: () => unknown)               => () => unknown;
    push?:           (prevPush: (data: unknown) => void)    => (data: unknown) => void;
    peek?:           (prevPeek: () => unknown)              => () => unknown;
    switchStatus?:   (prevSwitchStatus: (...args: unknown[]) => void) => (...args: unknown[]) => void;
    writeResultData?:(prevWriteResultData: (value: unknown) => void) => (value: unknown) => void;
    writeExtra?:    (prevWriteExtra: (value: unknown) => void)   => (value: unknown) => void;
}
```

---

## `StateStackInstance` — Instance Methods

The instance returned by `createStateStack(...)`.

```typescript
interface StateStackInstance {
    run(): void;
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}
```

| Method | Description |
|--------|-------------|
| `run()` | Starts the state machine. `init` has already run at instance creation; `run()` begins with `statusDispatcher` and loops through `statusDispatcher → handler → effect` until status is `null` or `{effect:'run'}` triggers control transfer |
| `readState()` | Returns the current state snapshot `{ status, resultData }` |
| `push(data)` | Push data from outside the state machine. Data is read by the next handler's `peek()` |
| `destroy()` | Destroy the instance. Idempotent — repeated calls do not throw. After destruction, all methods throw `Error: StateStack has been destroyed` |

---

## `StateSnapshot`

```typescript
interface StateSnapshot {
    status: string | null;
    resultData: Record<string, unknown>;
}
```

Note: the public snapshot returned by `readState()` only includes `status` and `resultData`. The internal state also contains `extra`, but that is not exposed through this interface.

---

## `StateAPI<S>` — Third Parameter of Handlers

The `api` parameter of a state handler provides the following methods. The generic `S` is the union type of declared status names.

```typescript
interface StateAPI<S extends string> {
    writeResultData(value: unknown): void;
    writeExtra(value: unknown): void;
    switchStatus(nextStatus: S | null, effect?: EffectDescriptor): void;
    createChildStateStack(def: Record<string, unknown>, id: string): void;
    childStateStack(id: string): ChildStateStackHandle;
}
```

| Method | Restriction | Description |
|--------|-------------|-------------|
| `switchStatus(nextStatus, effect?)` | **≤1 per cycle** | Switch status + carry an effect descriptor. `{effect:'run'}` triggers control transfer and terminates the loop |
| `writeResultData(value)` | **≤1 per cycle** | Overwrite `state.resultData` |
| `writeExtra(value)` | **≤1 per cycle** | Overwrite `state.extra` |
| `createChildStateStack(def, id)` | None | Create a child stack; `id` is used for later reference |
| `childStateStack(id)` | None | Get a child stack handle |

### Restriction Rules

`switchStatus`, `writeResultData`, and `writeExtra` may each be called at most once per run loop cycle. Exceeding this throws:

```
Error: 函数 #2 在一轮状态周期中调用超过一次
```

> `#n` corresponds to the function order passed to `initTimer`: 0 = writeExtra, 1 = writeResultData, 2 = switchStatus.

### Child Stack Handle

```typescript
interface ChildStateStackHandle {
    readState(): StateSnapshot;
    push(data: unknown): void;
    destroy(): void;
}
```

- `readState()` — read the child stack's current state snapshot
- `push(data)` — push data into the child stack
- `destroy()` — destroy the child stack instance (idempotent)

---

## `EffectDescriptor`

The second parameter of `switchStatus`, carrying a stack operation descriptor.

```typescript
interface EffectDescriptor {
    effect?: 'pop' | 'push' | 'run';
    param?: unknown;
}
```

| Form | Effect |
|------|--------|
| No `effect` | Pure status switch, no stack operation |
| `{ effect: 'push', param: [a, b, c] }` | Pushes `a, b, c` as independent arguments to the push function (auto-unwrapped) |
| `{ effect: 'pop' }` | Pops the stack top. During pop, `simpleWriteResultData` writes the result from the `pop` definition |
| `{ effect: 'run' }` | Control returns to the `runParent` callback and the current loop terminates |
| `{ effect: 'run', param: ['child', id] }` | Runs the specified child stack; execution resumes in the current stack after the child finishes |

Notes:
- For `push`, `param` provides the data to push, formatted as `[arg1, arg2, ...]` (array-wrapped, auto-unwrapped as individual arguments)
- For `run`, `param` identifies the child stack, formatted as `['child', id]` (a two-element array)

---

## Importing Type Definitions

The project ships complete TypeScript type declarations (`index.d.ts`).

```typescript
import { createStateStack, refineCreateStateStack } from '@ffort_233/state-stack';
import type {
    StateStackInstance,
    StateStackDefinition,
    StateStackRefinementObject,
    StateAPI,
    StateHandler,
    EffectDescriptor,
    ChildStateStackHandle,
    StateSnapshot,
    CurriedCreateStateStack,
} from '@ffort_233/state-stack';
```

---

## Error Conditions

| Error Scenario | Error Message |
|----------------|---------------|
| Restricted function called too many times | `函数 #n 在一轮状态周期中调用超过一次` |
| Calling a method on a destroyed instance | `StateStack has been destroyed` |
| Invalid `createStateStack` argument (non-object/null/number etc.) | `createStateStack: 参数必须是 StateStackDefinition（含 state 字段）或 StateStackRefinementObject（不含 state 字段）` |
| Child stack ID not found | `childStateStack id "xxx" not found` |

---

## Further Reading

- [Usage Guide](./usage-guide.md) — Complete examples and tutorials
- [Core Concepts](./core-concepts.md) — Design philosophy of peek, statusDispatcher, and restricted functions
- [Module Chain](./module-chain.md) — Detailed explanation of the function overwriting system
