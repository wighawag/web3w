function noop() {}
function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

// global queue
const subscriber_queue = [];
export function writable(value, start) {
    if (!start) { start = noop; }
	let stop;
	const subscribers = [];

	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) { // store is ready
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

	function update(fn){
		set(fn(value));
	}

	function subscribe(run, invalidate) {
        if (!invalidate) { invalidate = noop; }
		const subscriber = [run, invalidate];
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
			if (subscribers.length === 0) {
				stop();
				stop = null;
			}
		};
	}

	return { set, update, subscribe };
}

export class Store {

  constructor(value, start) {
    this.value = value;
    this._start = start || noop;
	  this._stop = undefined;
	  this._subscribers = [];
  }

  set(new_value) {
		if (safe_not_equal(this.value, new_value)) {
			this.value = new_value;
			if (this._stop) { // store is ready
				const run_queue = !subscriber_queue.length;
				for (let i = 0; i < this._subscribers.length; i += 1) {
					const s = this._subscribers[i];
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
  
  update(fn){
		this.set(fn(value));
	}
  subscribe(run, invalidate) {
    if (!invalidate) { invalidate = noop; }
    const subscriber = [run, invalidate];
    this._subscribers.push(subscriber);
    if (this._subscribers.length === 1) {
      this._stop = this.start(set) || noop;
    }
    run(value);

    return () => {
      const index = this._subscribers.indexOf(subscriber);
      if (index !== -1) {
        this._subscribers.splice(index, 1);
      }
      if (this._subscribers.length === 0) {
        this._stop();
        this._stop = null;
      }
    };
  }
}
