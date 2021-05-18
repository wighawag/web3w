import { get_store_value } from './internals';
import { StartStopNotifier, Readable, Writable } from './internals';
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
export declare function readable<T>(value: T, start: StartStopNotifier<T>): Readable<T>;
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
export declare function writable<T>(value: T, start?: StartStopNotifier<T>): Writable<T>;
/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 * @param store readable
 */
export { get_store_value as get };
//# sourceMappingURL=store.d.ts.map