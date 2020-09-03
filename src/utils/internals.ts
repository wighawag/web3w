export const noop = (): void => undefined;

/** Callback to inform of a value updates. */
export type Subscriber<T> = (value: T) => void;

/** Unsubscribes from value updates. */
export type Unsubscriber = () => void;

/** Callback to update a value. */
export type Updater<T> = (value: T) => T;

/** Cleanup logic callback. */
export type Invalidator<T> = (value?: T) => void;

/** Start and stop notification callbacks. */
export type StartStopNotifier<T> = (set: Subscriber<T>) => Unsubscriber | void;

// /** One or more `Readable`s. */
// type Stores = Readable<any> | [Readable<any>, ...Array<Readable<any>>];

// /** One or more values from `Readable` stores. */
// type StoresValues<T> = T extends Readable<infer U> ? U :
// 	{ [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

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
  subscribe(
    run: Subscriber<T>,
    invalidate?: Invalidator<T>
  ): {
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

// export function run_all(fns) {
// 	fns.forEach(run);
// }
export function subscribe<T>(store: Readable<T>, run: Subscriber<T>, invalidate?: Invalidator<T>): () => void {
  if (store == null) {
    return noop;
  }
  const unsub = store.subscribe(run, invalidate);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (unsub as any).unsubscribe ? () => (unsub as any).unsubscribe() : unsub; // (support RxJs observable)
}
export function safe_not_equal<T, U>(a: T, b: U): boolean {
  return a != a ? b == b : (a as unknown) !== (b as unknown) || (a && typeof a === 'object') || typeof a === 'function';
}
export function get_store_value<T>(store: Readable<T>): T {
  let value: T | undefined;
  subscribe(store, (_) => (value = _))();
  return value as T;
}
// export function is_function(thing: any): thing is Function {
// 	return typeof thing === 'function';
// }
