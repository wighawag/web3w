"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = exports.writable = exports.readable = void 0;
const internals_1 = require("./internals");
Object.defineProperty(exports, "get", { enumerable: true, get: function () { return internals_1.get_store_value; } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe,
    };
}
exports.readable = readable;
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = internals_1.noop) {
    let stop = null;
    const subscribers = [];
    function set(new_value) {
        if (internals_1.safe_not_equal(value, new_value)) {
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
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = internals_1.noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || internals_1.noop;
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
    return { set, update, subscribe };
}
exports.writable = writable;
