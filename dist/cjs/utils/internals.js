"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_store_value = exports.safe_not_equal = exports.subscribe = exports.noop = void 0;
exports.noop = () => undefined;
// export function run_all(fns) {
// 	fns.forEach(run);
// }
function subscribe(store, run, invalidate) {
    if (store == null) {
        return exports.noop;
    }
    const unsub = store.subscribe(run, invalidate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub; // (support RxJs observable)
}
exports.subscribe = subscribe;
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}
exports.safe_not_equal = safe_not_equal;
function get_store_value(store) {
    let value;
    subscribe(store, (_) => (value = _))();
    return value;
}
exports.get_store_value = get_store_value;
// export function is_function(thing: any): thing is Function {
// 	return typeof thing === 'function';
// }
