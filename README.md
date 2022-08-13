<!-- BEGIN:REMOVE_FOR_NPM -->
[![codecov](https://codecov.io/gh/libsabl/async-js/branch/main/graph/badge.svg?token=ZQLWiJV1W9)](https://app.codecov.io/gh/libsabl/async-js/branch/main)
<span class="badge-npmversion"><a href="https://npmjs.org/package/@sabl/async" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@sabl/async.svg" alt="NPM version" /></a></span>

<!-- END:REMOVE_FOR_NPM -->

# @sabl/async

**async** contains several simple utilities for concurrent or async programming in JavaScript and TypeScript. Several of the utilities use the [context pattern](https://github.com/libsabl/patterns/blob/main/patterns/context.md) implemented in [`@sabl/context`](https://npmjs.com/package/@sabl/context) to implement automatic async cancellation. The features in this package are useful both in test and production scenarios. Additional utilities in [`@sabl/async-test`](https://github.com/libsabl/async-test-js) are useful in testing concurrent programs.
    
<!-- BEGIN:REMOVE_FOR_NPM -->
> [**sabl**](https://github.com/libsabl/patterns) is an open-source project to identify, describe, and implement effective software patterns which solve small problems clearly, can be composed to solve big problems, and which work consistently across many programming languages.

## Developer orientation

See [SETUP.md](./docs/SETUP.md), [CONFIG.md](./docs/CONFIG.md).
<!-- END:REMOVE_FOR_NPM -->

## API
 
- [`promise`](#promise)
- [`limit`](#limit)
- [`wait`](#wait)
- [`collect`](#collect)
- [`stream`](#stream)
- [`AsyncPool`](#asyncpool)
 
## `promise`

```ts
function promise<T>(): CallbackPromise<T>;

interface CallbackPromise<T> extends Promise<T> {
  resolve(value: T | PromiseLike<T>): void;
  reject(reason: unknown): void;
} 
```

`promise` returns an actual [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) which also exposes its own `resolve` and `reject` callbacks. This is very helpful for bridging or wrapping event- and callback-based programs to expose APIs as simple Promises that can be `awaited`. In particular, it allows queued requests to be resolved as promises.

### **Example**: an async queue.

```ts
class AsyncQueue<T> {
  readonly #itemQueue: T[] = [];
  readonly #reqQueue: CallbackPromise<T>[] = [];

  // Await the next value available in the queue
  get(): Promise<T> {
    if(this.#itemQueue.length > 0) {
      return Promise.resolve(this.#itemQueue.shift());
    }

    const p = promise<T>();
    this.#reqQueue.push(p);
    return p;
  }

  // Put an item in the queue
  put(item: T): void {
    if(this.#reqQueue.length > 0) {
      this.#reqQueue.shift().resolve(item);
      return;
    }
    this.#itemQueue.push(item);
  }
}
```

## Cancelable `promise`

```ts
function promise<T>(ctx: IContext): CallbackPromise<T>; 
```

`promise` also supports an overload which accepts a [context](https://github.com/libsabl/context-js). If the context is cancelable, and the context is canceled before the promise is resolved, then the promise is automatically rejected with a cancellation error.

The helper function `CanceledError.is` from [`@sabl/context`](https://npmjs.org/package/@sabl/context) checks a rejection reason or error value to detect if the error represents an automatic cancellation.

### **Example revisited**: Async queue with cancelable get:

```ts
class AsyncQueue<T> {
  readonly #itemQueue: T[] = [];
  readonly #reqQueue: CallbackPromise<T>[] = [];

  // Await the next value available in the queue
  get(ctx?: IContext): Promise<T> {
    if(this.#itemQueue.length > 0) {
      return Promise.resolve(this.#itemQueue.shift());
    }

    const p = promise<T>(ctx);
    this.#reqQueue.push(p);

    const wrapped = p.catch((reason) => {
      if(CanceledError.is(reason)) {
        // Request was canceled. Remove from queue
        this.#reqQueue.splice(this.#reqQueue.indexOf(p));
      }
      throw reason;
    })

    return wrapped;
  }

  // Put an item in the queue
  put(item: T): void {
    if(this.#reqQueue.length > 0) {
      this.#reqQueue.shift().resolve(item);
      return;
    }
    this.#itemQueue.push(item);
  }
}
```

## `limit`

```ts
limit<T>(promise: Promise<T>, ms: number): Promise<T>
limit<T>(promise: Promise<T>, deadline: Date): Promise<T>
limit<T>(promise: Promise<T>, ctx: IContext): Promise<T>
```

`limit` awaits an input promise, but rejects it automatically if it has not completed by a timeout determined by any of the following:

- A relative timeout in milliseconds
- An absolute `Date` deadline
- A cancelable context

If `ms` is exactly 0, `limit` will resolve only if `promise` itself is already resolved. If `ms` is negative or `deadline` is passed, `limit` will reject even if `promise` is already resolved.
 
## `collect`

```ts
collect<T>(stream: AsyncIterable<T>): Promise<T[]>
```
 
`collect` accepts an async iterator and returns a Promise that resolves the complete collection when iteration is complete.

```ts
// Given an async iterator
async function* asyncSequence(n, delay): AsyncIterable<number> {
  for(let i = 1; i <= n; n++) {
    await new Promise(resolve => setTimeout(resolve, delay));
    yield i;
  }
}

// We can await the full result set:
const result = await collect(asyncSequence(6, 500));
console.log(result) // [1, 2, 3, 4, 5, 6]
```

## `stream`

```ts
stream<T>(...items: T[]): AsyncIterable<T>
stream<T>(items: Iterable<T>): AsyncIterable<T> 
```

The `stream` method takes a param array of items and returns it as an async iterable, async yielding each item in sequence.

```ts
// From a param array
for await (let n of stream(1, 2, 3, 4)) {
  console.log(n)
}

// From a single array
for await (let n of stream([1, 2, 3, 4])) {
  console.log(n)
}

// From a custom iterable
const iter =  {
  *[Symbol.iterator]() {
    for (let i = 1; i <= 4; i++) yield i;
  },
};
for await (let n of stream(iter)) {
  console.log(n)
}
```

## `AsyncPool`

```ts
function createPool<T>(
  factory: AsyncFactory<T>,
  options?: PoolOptions
): AsyncPool<T>

interface AsyncPool<T> {
  get(ctx?: IContext): Promise<T>;
  release(item: T): void;
  close(fn?: (item: T) => void): Promise<void>;

  setOptions(options: PoolOptions): void;
  stats(): PoolStats;

  on (type: 'error', fn: (action: FactoryEvent, err: unknown) => void): void;
  off(type: 'error', fn: (action: FactoryEvent, err: unknown) => void): void;
}

interface AsyncFactory<T> { 
  create (): Promise<T>; 
  destroy(item: T): Promise<void>; 
  reset? (item: T): boolean;
}

type FactoryEvent = 'create' | 'destroy' | 'reset';
```

`AsyncPool` is a concurrent-safe, asynchronous pool of items. The details of the queueing algorithms are inspired by the [implementation of the `DB` type](https://cs.opensource.google/go/go/+/refs/tags/go1.18.4:src/database/sql/sql.go;l=456) in the golang [`database/sql` package](https://pkg.go.dev/database/sql).

`createPool` is used to create a new pool by providing any implementation of an `AsyncFactory` for a given type.

Client code should also register an event handler for the returned pool's `error` event (see [handling errors](#handling-errors)). 

### **`get(ctx?)`**

`get` requests an item from the pool. It returns a promise that will be resolved when an item becomes available. If a [context]() is provided to `get`, than `get` will reject if the context is canceled before an item becomes available. `get` will also reject if the pool is closed before an item becomes available.

### **`release`**

`release` returns item to the pool. Clients **must** release each item back to the pool when they are done using the item.

### **`close(fn?)`**

`close` rejects any outstanding requests, destroys any pooled items, and causes the pool to immediately reject and future requests. Items that have already been obtained from the pool are not affected, but the caller may provide a callback to `close` which will be invoked on any active items.

The promise returned by `close` will not resolve until all items have been released back to the pool, and all items have been destroyed.

### **FIFO Queue, LIFO Pool**

The queue of requests created by calling `get` are first-in-first-out (FIFO): requests will be resolved in the order they were created.

The pool of idled items is intentionally **last-in**-first-out (LIFO). This allows excess pool items to age out and be destroyed.

### `AyncFactory`

```ts
interface AsyncFactory<T> { 
  create (): Promise<T>; 
  destroy(item: T): Promise<void>; 
  reset? (item: T): boolean;
}
```

As noted above, client code must provide in implementation of `AsyncFactory`. 

|Method|Description|
|-|-|
|`create`|Asynchronously creates a new item|
|`destroy`|Asynchronously destroys an item|
|`reset`|*Optional*. **Synchronously** checks and/or resets the state of an item for reuse, and returns `true` if the item can be reused.|
  
If `reset` is implemented, then, for an item to be reused `reset` **must** return `true`. If `reset` returns `false` or encounters an error, the item will be discarded and destroyed.

#### Factory Errors

Any errors encountered while invoking factory methods will be caught and then emitted by the pool itself with the `error` event. 

### **Options**

```ts
interface PoolOptions { 
  maxLifetime?: number;       // default -1 (unlimited)
  maxIdleTime?: number;       // default -1 (unlimited)
  maxOpenCount?: number;      // default -1 (unlimited)
  maxIdleCount?: number;      // default -1 (unlimited)
  parallelCreate?: boolean;   // default true
  maxCreateFailures?: number; // default 10
}
```

The behavior of the pool can be controlled or even updated live using a `PoolOptions`-shaped object literal. For the four numeric options, any negative value means unlimited. A value of `0` is prohibited for `maxLifetime`, `maxIdleTime`, and `maxOpenCount`, but is allowed for `maxIdleCount`.

```ts
// When creating
const pool = createPool<number[]>({
  async create()   { return [ Math.random() ]; },
  async destroy(n) { console.log(`Destroyed numbers ${n}`)  }
}, { maxLifetime: 600_000 /* 10 minutes */ });

// Updating
pool.setOptions({ parallelCreate: false });
```

The options and their effect are described here:

|Option|Description|On Update|
|-|-|-|
|`maxLifetime`|The maximum lifetime in milliseconds for any item. Expired items are destroyed when they are released back to the pool.|Any pooled items are swept to detect if they are expired relative to the updated `maxLifetime`|
|`maxIdleTime`|The maximum time in milliseconds that an item may remain in the pool before it is destroyed.|Any pooled items are swept to detect if they are expired relative to the updated `maxIdleTime`|
|`maxOpenCount`|The maximum number of items that will be alive at the same time, thus the maximum number of items that can be borrowed from the pool at the same time.|Pooled items are destroyed if they represent extra items relative to the updated `maxOpenCount`.|
|`maxIdleCount`|The maximum number of items that will be retained in the pool.|Pooled items in excess of the updated `maxIdleCount` are destroyed.|
|`parallelCreate`|Whether the pool will create multiple items concurrently. **Default is `true`**. If explicitly set to `false`, the pool will `await` each call to the factory's `create` method before invoking it again.|No immediate action|
|`maxCreateFailures`|The maximum number of consecutive failures when invoking the factory `create` method before the pool is automatically closed. A negative value allows unlimited consecutive failures.|Pool will close if the current count of successive failures is greater than or equal to the new non-negative value of `maxCreateFailures`.|

### **Stats**

Current statistics about the pool can be obtained by calling `stats()`. This will capture the counts at the time of the call.

```ts
interface PoolStats {
  // Settings

  /** The maximum count of items, both in use and idle */
  readonly maxOpenCount: number;

  /** The maximum lifetime in milliseconds for an item */
  readonly maxLifetime: number;

  /** The maximum time in milliseconds for an item to remain  */
  readonly maxIdleTime: number;

  /** The maximum count of items kept idle */
  readonly maxIdleCount: number;

  /** The maximum count of allowed consecutive failures to create a new item */
  readonly maxCreateFailures: number;

  // Item counts

  /** Current number of items, both in use and idle */
  readonly count: number;

  /** Current number of items currently in use */
  readonly inUseCount: number;

  /** Current number of items currently idle */
  readonly idleCount: number;

  // Session stats

  /** Current number of requests currently waiting for an item */
  readonly waitCount: number;

  /** Current number of consecutive failures to create a new item */
  readonly createFailureCount: number;

  /**
   * Total time in milliseconds that all requests have waited
   * for items, for the entire lifetime of the pool. Does not
   * include items that are still waiting
   */
  readonly waitDuration: number;

  /** The total number of items destroyed due to maxIdleCount */
  readonly maxIdleClosed: number;

  /** The total number of items destroyed due to maxIdleTime */
  readonly maxIdleTimeClosed: number;

  /** The total number of items destroyed due to maxLifetime */
  readonly maxLifetimeClosed: number;
}
```

### **Handling errors**

Errors can occur when the pool invokes the provided factory's `create`, `destroy`, or `reset` methods. Any errors encountered will be emitted by raising an `error` event. Clients should subscribe to this event to ensure errors are not left unhandled.

```ts
const badPool = createPool<string>({
  create()   { throw new Error('Error creating') },
  destroy(s) { throw new Error('Error destroying!') }
});

badPool.on('error', (action, err) => {
  console.log(`Pool error for ${action} action: ${err}`);
});
```

### **Behavior on error**

In all cases, errors thrown by calls to the factory's `create`, `destroy`, or `reset` methods will be caught and emitted with in `error` event. In addition, the pool implements the following behaviors:

- `create`

  If an attempt to `create` an item throws an error, the pool will retry. However, if 10 consecutive calls to the factory's `create` method throw an error, the pool will terminated all outstanding requests and close.

- `reset`

  If an attempt to `reset` an item throws an error, the pool will discard (`destroy`) the item even if it would have been pooled otherwise.

- `destroy`

  The item is discarded anyway. Implementations of `destroy` that could throw an error without releasing underlying resources can therefor cause memory leaks. It is the implementer's responsibility to ensure resources are released even if `destroy` throws an error.
