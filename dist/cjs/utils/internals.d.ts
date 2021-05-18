export declare const noop: () => void;
/** Callback to inform of a value updates. */
export declare type Subscriber<T> = (value: T) => void;
/** Unsubscribes from value updates. */
export declare type Unsubscriber = () => void;
/** Callback to update a value. */
export declare type Updater<T> = (value: T) => T;
/** Cleanup logic callback. */
export declare type Invalidator<T> = (value?: T) => void;
/** Start and stop notification callbacks. */
export declare type StartStopNotifier<T> = (set: Subscriber<T>) => Unsubscriber | void;
/** Readable interface for subscribing. */
export interface Readable<T> {
    /**
     * Subscribe on value changes.
     * @param run subscription callback
     * @param invalidate cleanup callback
     */
    subscribe(run: Subscriber<T>, invalidate?: Invalidator<T>): Unsubscriber;
}
export interface Observable<T> {
    /**
     * Subscribe on value changes.
     * @param run subscription callback
     * @param invalidate cleanup callback
     */
    subscribe(run: Subscriber<T>, invalidate?: Invalidator<T>): {
        unsubscribe: () => void;
    };
}
/** Writable interface for both updating and subscribing. */
export interface Writable<T> extends Readable<T> {
    /**
     * Set value and inform subscribers.
     * @param value to set
     */
    set(value: T): void;
    /**
     * Update value using callback and inform subscribers.
     * @param updater callback
     */
    update(updater: Updater<T>): void;
}
export declare function subscribe<T>(store: Readable<T>, run: Subscriber<T>, invalidate?: Invalidator<T>): () => void;
export declare function safe_not_equal<T, U>(a: T, b: U): boolean;
export declare function get_store_value<T>(store: Readable<T>): T;
//# sourceMappingURL=internals.d.ts.map