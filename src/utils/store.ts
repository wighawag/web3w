import {noop, safe_not_equal, get_store_value} from './internals';
import {Subscriber, Invalidator, StartStopNotifier, Readable, Writable, Unsubscriber, Updater} from './internals';

/** Pair of subscriber and invalidator. */
type SubscribeInvalidateTuple<T> = [Subscriber<T>, Invalidator<T>];

const subscriber_queue: any[] = [];

/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
export function readable<T>(value: T, start: StartStopNotifier<T>): Readable<T> {
  return {
    subscribe: writable(value, start).subscribe,
  };
}

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
export function writable<T>(value: T, start: StartStopNotifier<T> = noop): Writable<T> {
  let stop: Unsubscriber | null = null;
  const subscribers: Array<SubscribeInvalidateTuple<T>> = [];

  function set(new_value: T): void {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        // store is ready
        const run_queue = !subscriber_queue.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s = subscribers[i];
          s[1]();
          subscriber_queue.push(s, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }

  function update(fn: Updater<T>): void {
    set(fn(value));
  }

  function subscribe(run: Subscriber<T>, invalidate: Invalidator<T> = noop): Unsubscriber {
    const subscriber: SubscribeInvalidateTuple<T> = [run, invalidate];
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set) || noop;
    }
    run(value);

    return () => {
      const index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
      if (subscribers.length === 0 && stop !== null) {
        stop();
        stop = null;
      }
    };
  }

  return {set, update, subscribe};
}

/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 * @param store readable
 */
export {get_store_value as get};
