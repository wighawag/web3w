export const noop = () => undefined;
// export function run_all(fns) {
// 	fns.forEach(run);
// }
export function subscribe(store, run, invalidate) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(run, invalidate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub; // (support RxJs observable)
}
export function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}
export function get_store_value(store) {
    let value;
    subscribe(store, (_) => (value = _))();
    return value;
}
// export function is_function(thing: any): thing is Function {
// 	return typeof thing === 'function';
// }
//# sourceMappingURL=internals.js.map