"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define("errors", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MODULE_ERROR = exports.CHAIN_CONFIG_NOT_AVAILABLE = exports.CHAIN_NO_PROVIDER = void 0;
    exports.CHAIN_NO_PROVIDER = 6000;
    exports.CHAIN_CONFIG_NOT_AVAILABLE = 6001;
    exports.MODULE_ERROR = 1000;
});
define("utils/internals", ["require", "exports"], function (require, exports) {
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
});
// export function is_function(thing: any): thing is Function {
// 	return typeof thing === 'function';
// }
define("utils/store", ["require", "exports", "utils/internals"], function (require, exports, internals_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.get = exports.writable = exports.readable = void 0;
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
});
/* eslint-disable @typescript-eslint/no-explicit-any */
define("utils/builtin", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getVendor = exports.fetchEthereum = exports.getEthereum = void 0;
    function getEthereum() {
        if (typeof window !== 'undefined') {
            const windowAsAny = window;
            if (windowAsAny.ethereum) {
                return windowAsAny.ethereum;
            }
            else if (windowAsAny.web3) {
                return windowAsAny.web3.currentProvider;
            }
        }
        return null;
    }
    exports.getEthereum = getEthereum;
    function fetchEthereum() {
        // TODO test with document.readyState !== 'complete' || document.readyState === 'interactive'
        return new Promise((resolve) => {
            if (document.readyState !== 'complete') {
                document.onreadystatechange = function () {
                    if (document.readyState === 'complete') {
                        document.onreadystatechange = null;
                        resolve(getEthereum());
                    }
                };
            }
            else {
                resolve(getEthereum());
            }
        });
    }
    exports.fetchEthereum = fetchEthereum;
    function getVendor(ethereum) {
        if (!ethereum) {
            return undefined;
        }
        else if (ethereum.isMetaMask) {
            return 'Metamask';
        }
        else if (navigator.userAgent.indexOf('Opera') != -1 ||
            navigator.userAgent.indexOf('OPR/') != -1) {
            return 'Opera';
        }
        else {
            return 'unknown';
        }
        // TODO
    }
    exports.getVendor = getVendor;
});
define("utils/index", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timeout = void 0;
    function timeout(time, p, config) {
        return new Promise((resolve, reject) => {
            let _timedOut = false;
            const timer = setTimeout(() => {
                _timedOut = true;
                if (!config) {
                    reject(new Error('TimedOut'));
                }
                else {
                    if (typeof config === 'function') {
                        resolve(config());
                    }
                    else {
                        reject(config.error || config);
                    }
                }
            }, time);
            p.then((v) => {
                if (!_timedOut) {
                    clearTimeout(timer);
                    resolve(v);
                } // TODO else console.log
            }).catch((e) => {
                if (!_timedOut) {
                    clearTimeout(timer);
                    reject(e);
                } // TODO else console.log
            });
        });
    }
    exports.timeout = timeout;
});
define("utils/ethers", ["require", "exports", "utils/internals"], function (require, exports, internals_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.proxyWeb3Provider = exports.proxyContract = void 0;
    function proxyContract(contractToProxy, name, observers) {
        const actualObservers = observers
            ? Object.assign({ onContractTxRequested: internals_2.noop, onContractTxCancelled: internals_2.noop, onContractTxSent: internals_2.noop }, observers) : {
            onContractTxRequested: internals_2.noop,
            onContractTxCancelled: internals_2.noop,
            onContractTxSent: internals_2.noop,
        };
        const { onContractTxRequested, onContractTxCancelled, onContractTxSent } = actualObservers;
        const proxies = {};
        const functionsInterface = contractToProxy.interface.functions;
        const nameToSig = {};
        for (const sig of Object.keys(functionsInterface)) {
            nameToSig[functionsInterface[sig].name] = sig;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contract = {};
        for (const key of Object.keys(contractToProxy)) {
            // TODO populate when contract become available
            contract[key] = contractToProxy[key];
        }
        contract.functions = {};
        for (const key of Object.keys(contractToProxy.functions)) {
            contract.functions[key] = contractToProxy.functions[key];
        }
        // TODO remove:
        // contract._original = contractToProxy;
        function proxyCall(functions, methodName) {
            let callProxy = proxies[methodName];
            if (!callProxy) {
                let methodInterface = contractToProxy.interface.functions[methodName];
                if (!methodInterface) {
                    methodInterface = contractToProxy.interface.functions[nameToSig[methodName]];
                }
                callProxy = new Proxy(functions[methodName], {
                    // TODO empty object (to populate later when contract is available ?)
                    apply: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
                        const numArguments = argumentsList.length;
                        let overrides;
                        if (numArguments === methodInterface.inputs.length + 1 &&
                            typeof argumentsList[numArguments - 1] === 'object') {
                            overrides = argumentsList[numArguments];
                        }
                        let outcome;
                        if (overrides) {
                            outcome = overrides.outcome;
                            delete overrides.outcome;
                        }
                        onContractTxRequested({ name, method: methodName, overrides, outcome });
                        let tx;
                        try {
                            tx = yield method.bind(functions)(...argumentsList);
                        }
                        catch (e) {
                            onContractTxCancelled({
                                name,
                                method: methodName,
                                overrides,
                                outcome,
                            }); // TODO id to identify?
                            throw e;
                        }
                        onContractTxSent({
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            hash: tx.hash,
                            name,
                            method: methodName,
                            overrides,
                            outcome,
                        });
                        return tx;
                    }),
                });
                proxies[methodName] = callProxy;
            }
            return callProxy;
        }
        const functionsProxy = new Proxy(contract.functions, {
            get: (functions, methodName) => {
                return proxyCall(contractToProxy.functions, methodName); // TODO empty
            },
        });
        return new Proxy(contract, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: (obj, prop) => {
                if (prop === 'functions') {
                    return functionsProxy;
                }
                else if (contractToProxy.functions[prop]) {
                    return proxyCall(contractToProxy.functions, prop);
                }
                else if (prop === '_proxiedContract') {
                    return contractToProxy;
                }
                else if (prop === 'toJSON') {
                    // TODO test
                    return () => ({
                        address: contractToProxy.address,
                        abi: contractToProxy.interface.fragments,
                    });
                }
                else {
                    return obj[prop]; // TODO prototype access ?
                }
            },
        });
    }
    exports.proxyContract = proxyContract;
    function proxySigner(signer, applyMap, { onTxRequested, onTxCancelled, onTxSent, onSignatureRequested, onSignatureCancelled, onSignatureReceived, }) {
        applyMap = Object.assign({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sendTransaction: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
                onTxRequested(argumentsList[0]);
                let tx;
                try {
                    tx = (yield method.bind(thisArg)(...argumentsList));
                }
                catch (e) {
                    onTxCancelled(argumentsList[0]);
                    throw e;
                }
                onTxSent(tx);
                return tx;
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            signMessage: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
                onSignatureRequested(argumentsList[0]);
                let signature;
                try {
                    signature = (yield method.bind(thisArg)(...argumentsList));
                }
                catch (e) {
                    onSignatureCancelled(argumentsList[0]);
                    throw e;
                }
                onSignatureReceived(signature);
                return signature;
            }),
        }, applyMap);
        const proxies = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function getProxy(methodName, handler) {
            let proxy = proxies[methodName];
            if (!proxy) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                proxy = new Proxy(signer[methodName], handler);
                proxies[methodName] = proxy;
            }
            return proxy;
        }
        return new Proxy(signer, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: (obj, prop) => {
                const applyFunc = applyMap[prop];
                if (applyFunc) {
                    return getProxy(prop, {
                        apply: applyFunc,
                    });
                }
                else {
                    return obj[prop];
                }
            },
        });
    }
    function proxyUncheckedJsonRpcSigner(signer, observers) {
        return proxySigner(signer, {}, observers);
    }
    function proxyJsonRpcSigner(signer, observers) {
        return proxySigner(signer, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connectUnchecked: (method, thisArg, argumentsList) => {
                const signer = method.bind(thisArg)(...argumentsList);
                return proxyUncheckedJsonRpcSigner(signer, observers);
            },
        }, observers);
    }
    function proxyWeb3Provider(provider, observers) {
        const actualObservers = observers
            ? Object.assign({ onTxRequested: internals_2.noop, onTxCancelled: internals_2.noop, onTxSent: internals_2.noop, onSignatureRequested: internals_2.noop, onSignatureCancelled: internals_2.noop, onSignatureReceived: internals_2.noop }, observers) : {
            onTxRequested: internals_2.noop,
            onTxCancelled: internals_2.noop,
            onTxSent: internals_2.noop,
            onSignatureRequested: internals_2.noop,
            onSignatureCancelled: internals_2.noop,
            onSignatureReceived: internals_2.noop,
        };
        const getSignerProxy = new Proxy(provider.getSigner, {
            // TODO wallet.connect on demand if not Ready // error out if not accepted // special state ?
            apply: (getSigner, thisArg, argumentsList) => {
                const signer = getSigner.bind(provider)(...argumentsList);
                return proxyJsonRpcSigner(signer, actualObservers);
            },
        });
        return new Proxy(provider, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: (obj, prop) => {
                if (prop === 'getSigner') {
                    return getSignerProxy;
                }
                else if (prop === 'signMessage') {
                    return getSignerProxy;
                }
                else if (prop === 'sendTransaction') {
                    return getSignerProxy;
                }
                else if (prop === 'connectUnchecked') {
                    return getSignerProxy;
                }
                else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return obj[prop];
                }
            },
        });
    }
    exports.proxyWeb3Provider = proxyWeb3Provider;
});
define("index", ["require", "exports", "@ethersproject/contracts", "@ethersproject/providers", "utils/store", "utils/builtin", "utils/index", "utils/ethers", "named-logs", "errors"], function (require, exports, contracts_1, providers_1, store_1, builtin_1, index_js_1, ethers_1, named_logs_1, errors_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const console = named_logs_1.logs('web3w:index');
    const isBrowser = typeof window != 'undefined';
    const $builtin = {
        state: 'Idle',
        probing: false,
        available: undefined,
        error: undefined,
        vendor: undefined,
    };
    const $balance = {
        state: 'Idle',
        fetching: false,
        stale: undefined,
        amount: undefined,
        error: undefined,
        blockNumber: undefined,
    };
    const $chain = {
        state: 'Idle',
        connecting: false,
        loadingData: false,
        contracts: {},
        error: undefined,
    };
    const $wallet = {
        state: 'Idle',
        connecting: false,
        unlocking: false,
        address: undefined,
        options: undefined,
        selected: undefined,
        pendingUserConfirmation: undefined,
        error: undefined,
    };
    function store(data) {
        const result = store_1.writable(data);
        result.data = data;
        return result;
    }
    const $transactions = [];
    const walletStore = store($wallet);
    const transactionsStore = store($transactions);
    const builtinStore = store($builtin);
    const chainStore = store($chain);
    const balanceStore = store($balance);
    function addTransaction(tx) {
        $transactions.push(tx);
        transactionsStore.set($transactions);
    }
    function set(store, obj) {
        for (const key of Object.keys(obj)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyObj = obj;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyStore = store;
            if (anyStore.data[key] && typeof anyObj[key] === 'object') {
                for (const subKey of Object.keys(anyObj[key])) {
                    // TODO recursve
                    anyStore.data[key][subKey] = anyObj[key][subKey];
                }
            }
            else {
                anyStore.data[key] = anyObj[key];
            }
        }
        try {
            console.debug(JSON.stringify(store.data, null, '  '));
        }
        catch (e) {
            console.error(e, store.data);
        }
        store.set(store.data);
    }
    // function reset<T>(store: WritableWithData<T>, fields: string[]) {
    //   if (typeof fields === 'string') {
    //     fields = [fields];
    //   }
    //   const anyStore = store as any;
    //   for (const field of fields) {
    //     const current = anyStore.data[field];
    //     if (typeof current === 'object') {
    //       anyStore.data[field] = {status: undefined};
    //     } else {
    //       anyStore.data[field] = undefined;
    //     }
    //   }
    //   store.set(store.data);
    // }
    // //////////////////////////////////////////////////////////////////////////////
    let _listenning = false;
    let _ethersProvider;
    let _web3Provider;
    let _builtinEthersProvider;
    let _builtinWeb3Provider;
    let _chainConfigs;
    let _currentModule;
    let _options;
    function onChainChanged(chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (chainId === '0xNaN') {
                console.warn('onChainChanged bug (return 0xNaN), metamask bug?');
                if (!_web3Provider) {
                    throw new Error('no web3Provider to get chainId');
                }
                chainId = yield providerSend(_web3Provider, 'eth_chainId');
            }
            const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
            console.debug('onChainChanged', { chainId, chainIdAsDecimal }); // TODO
            set(chainStore, {
                contracts: undefined,
                addresses: undefined,
                state: 'Connected',
                chainId: chainIdAsDecimal,
                notSupported: undefined,
            });
            if ($wallet.address) {
                yield loadChain(chainIdAsDecimal, $wallet.address);
            }
        });
    }
    function hasAccountsChanged(accounts) {
        return accounts[0] !== $wallet.address;
        // TODO multi account support ?
    }
    function onAccountsChanged(accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!hasAccountsChanged(accounts)) {
                console.debug('false account changed', accounts);
                return;
            }
            console.debug('onAccountsChanged', { accounts }); // TODO
            const address = accounts[0];
            if (address) {
                set(walletStore, { address, state: 'Ready' });
                if ($chain.state === 'Connected') {
                    if ($chain.chainId) {
                        yield loadChain($chain.chainId, address);
                    }
                    else {
                        throw new Error('no chainId while connected');
                    }
                }
            }
            else {
                set(walletStore, { address, state: 'Locked' });
            }
            // TODO balance
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function providerSend(provider, method, params) {
        var _a;
        if (provider.request) {
            return provider.request({ method, params });
        }
        const sendAsync = (_a = provider.sendAsync) === null || _a === void 0 ? void 0 : _a.bind(provider);
        if (sendAsync) {
            return new Promise((resolve, reject) => {
                sendAsync({ method, params }, (error, response) => {
                    if (error) {
                        reject(error);
                    }
                    else if (response.error) {
                        reject(response.error);
                    }
                    else {
                        resolve(response.result);
                    }
                });
            });
        }
        throw new Error('provider not supported');
    }
    function wait(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    function pollChainChanged(web3Provider, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            while (_listenning) {
                const chainId = yield providerSend(web3Provider, 'eth_chainId');
                const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
                if (_listenning && $chain.chainId !== chainIdAsDecimal) {
                    try {
                        callback(chainId);
                    }
                    catch (e) {
                        console.error(e);
                        // TODO error in chain.error
                    }
                }
                yield wait(3000);
            }
        });
    }
    function pollAccountsChanged(web3Provider, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            while (_listenning) {
                let accounts = [];
                try {
                    accounts = yield providerSend(web3Provider, 'eth_accounts');
                }
                catch (e) { }
                console.debug({ accounts }); // TODO remove
                if (_listenning && hasAccountsChanged(accounts)) {
                    // TODO multi account support ?
                    try {
                        callback(accounts);
                    }
                    catch (e) {
                        console.error(e);
                        // TODO error in wallet.error
                    }
                }
                yield wait(3000);
            }
        });
    }
    function listenForChanges() {
        if (_web3Provider && !_listenning) {
            _listenning = true;
            if (_web3Provider.on) {
                _web3Provider.on('chainChanged', onChainChanged);
                _web3Provider.on('accountsChanged', onAccountsChanged);
                // still poll has accountsChanged does not seem to be triggered all the time (metamask bug?)
                pollAccountsChanged(_web3Provider, onAccountsChanged);
            }
            else {
                // TODO handle race condition : should not double poll
                pollChainChanged(_web3Provider, onChainChanged);
                pollAccountsChanged(_web3Provider, onAccountsChanged);
            }
        }
    }
    function stopListeningForChanges() {
        _listenning = false;
        if (_web3Provider && _listenning) {
            console.debug('stop listenning for changes...');
            _web3Provider.removeListener && _web3Provider.removeListener('chainChanged', onChainChanged);
            _web3Provider.removeListener && _web3Provider.removeListener('accountsChanged', onAccountsChanged);
        }
    }
    function onConnect({ chainId }) {
        const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
        console.debug('onConnect', { chainId, chainIdAsDecimal }); // TODO
    }
    function onDisconnect(error) {
        console.debug('onDisconnect', { error }); // TODO
    }
    function listenForConnection() {
        if (_web3Provider) {
            console.debug('listenning for connection...');
            _web3Provider.on && _web3Provider.on('connect', onConnect);
            _web3Provider.on && _web3Provider.on('disconnect', onDisconnect);
        }
    }
    function stopListeningForConnection() {
        if (_web3Provider) {
            console.debug('stop listenning for connection...');
            _web3Provider.removeListener && _web3Provider.removeListener('connect', onConnect);
            _web3Provider.removeListener && _web3Provider.removeListener('disconnect', onDisconnect);
        }
    }
    function isHex(value) {
        return typeof value === 'string' && value.length > 2 && value.slice(0, 2).toLowerCase() === '0x';
    }
    function toDecimal(value) {
        if (isHex(value)) {
            return '' + parseInt(value.slice(2));
        }
        return value;
    }
    function toHex(value) {
        if (isHex(value)) {
            return value;
        }
        return '0x' + parseInt(value).toString(16);
    }
    function requestUserAttention(type) {
        if ($wallet.pendingUserConfirmation) {
            $wallet.pendingUserConfirmation.push(type);
        }
        else {
            $wallet.pendingUserConfirmation = [type];
        }
        set(walletStore, { pendingUserConfirmation: $wallet.pendingUserConfirmation });
    }
    function cancelUserAttention(type) {
        if ($wallet.pendingUserConfirmation) {
            const index = $wallet.pendingUserConfirmation.indexOf(type);
            if (index >= 0) {
                $wallet.pendingUserConfirmation.splice(index, 1);
                if ($wallet.pendingUserConfirmation.length === 0) {
                    $wallet.pendingUserConfirmation = undefined;
                }
                set(walletStore, { pendingUserConfirmation: $wallet.pendingUserConfirmation });
            }
        }
    }
    const _observers = {
        onTxRequested: (transaction) => {
            console.debug('onTxRequested', { transaction });
            requestUserAttention('transaction');
        },
        onTxCancelled: (transaction) => {
            console.debug('onTxCancelled', { transaction });
            cancelUserAttention('transaction');
        },
        onTxSent: (transaction) => {
            console.debug('onTxSent', { transaction });
            cancelUserAttention('transaction');
        },
        onSignatureRequested: (message) => {
            console.debug('onSignatureRequested', { message });
            requestUserAttention('signature');
        },
        onSignatureCancelled: (message) => {
            console.debug('onSignatureCancelled', { message });
            cancelUserAttention('signature');
        },
        onSignatureReceived: (signature) => {
            console.debug('onSignatureReceived', { signature });
            cancelUserAttention('signature');
        },
        onContractTxRequested: ({ name, method, overrides, outcome, }) => {
            console.debug('onContractTxRequest', { name, method, overrides, outcome });
        },
        onContractTxCancelled: ({ name, method, overrides, outcome, }) => {
            console.debug('onContractTxCancelled', { name, method, overrides, outcome });
        },
        onContractTxSent: ({ hash, name, method, overrides, outcome, }) => {
            console.debug('onContractTxSent', { hash, name, method, overrides, outcome });
            if (hash) {
                addTransaction({ hash, name, method, overrides, outcome });
            }
        },
    };
    const LOCAL_STORAGE_SLOT = '_web3w_previous_wallet_type';
    function recordSelection(type) {
        localStorage.setItem(LOCAL_STORAGE_SLOT, type);
    }
    function fetchPreviousSelection() {
        return localStorage.getItem(LOCAL_STORAGE_SLOT);
    }
    function setupChain(address) {
        return __awaiter(this, void 0, void 0, function* () {
            if (_ethersProvider === undefined) {
                const error = {
                    code: errors_1.CHAIN_NO_PROVIDER,
                    message: `no provider setup yet`,
                };
                set(chainStore, {
                    error,
                    connecting: false,
                    loadingData: false,
                    contracts: undefined,
                    addresses: undefined,
                    state: 'Idle',
                });
                throw new Error(error.message);
            }
            set(chainStore, { connecting: true });
            const { chainId: chainIdAsNumber } = yield _ethersProvider.getNetwork();
            const chainId = String(chainIdAsNumber);
            set(chainStore, {
                chainId,
                connecting: false,
                loadingData: false,
                contracts: undefined,
                addresses: undefined,
                state: 'Connected',
            });
            yield loadChain(chainId, address);
        });
    }
    function loadChain(chainId, address) {
        return __awaiter(this, void 0, void 0, function* () {
            if (_ethersProvider === undefined) {
                const error = {
                    code: errors_1.CHAIN_NO_PROVIDER,
                    message: `no provider setup yet`,
                };
                set(chainStore, {
                    error,
                    connecting: false,
                    loadingData: false,
                    contracts: undefined,
                    addresses: undefined,
                    state: 'Idle',
                });
                throw new Error(error.message);
            }
            set(chainStore, { loadingData: true });
            const contractsToAdd = {};
            const addresses = {};
            let contractsInfos = {};
            let chainConfigs = _chainConfigs;
            if (typeof chainConfigs === 'function') {
                chainConfigs = yield chainConfigs(chainId);
            }
            if (chainConfigs) {
                if (chainConfigs.chainId) {
                    const chainConfig = chainConfigs;
                    if (chainId === chainConfig.chainId || chainId == toDecimal(chainConfig.chainId)) {
                        contractsInfos = chainConfig.contracts;
                    }
                    else {
                        const error = {
                            code: errors_1.CHAIN_CONFIG_NOT_AVAILABLE,
                            message: `chainConfig only available for ${chainConfig.chainId} , not available for ${chainId}`,
                        };
                        set(chainStore, {
                            error,
                            chainId,
                            notSupported: true,
                            connecting: false,
                            loadingData: false,
                            state: 'Connected',
                        });
                        throw new Error(error.message); // TODO remove ?
                    }
                }
                else {
                    const multichainConfigs = chainConfigs;
                    const chainConfig = multichainConfigs[chainId] || multichainConfigs[toHex(chainId)];
                    if (!chainConfig) {
                        const error = { code: errors_1.CHAIN_CONFIG_NOT_AVAILABLE, message: `chainConfig not available for ${chainId}` };
                        set(chainStore, {
                            error,
                            chainId,
                            notSupported: true,
                            connecting: false,
                            loadingData: false,
                            state: 'Connected',
                        });
                        throw new Error(error.message); // TODO remove ?
                    }
                    else {
                        contractsInfos = chainConfig.contracts;
                    }
                }
                for (const contractName of Object.keys(contractsInfos)) {
                    const contractInfo = contractsInfos[contractName];
                    if (contractInfo.abi) {
                        contractsToAdd[contractName] = ethers_1.proxyContract(new contracts_1.Contract(contractInfo.address, contractInfo.abi, _ethersProvider.getSigner(address)), contractName, _observers);
                    }
                    addresses[contractName] = contractInfo.address;
                }
            }
            set(chainStore, {
                state: 'Ready',
                loadingData: false,
                connecting: false,
                chainId,
                addresses,
                contracts: contractsToAdd,
            }); // TODO None ?
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function select(type, moduleConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            if ($wallet.selected && ($wallet.state === 'Ready' || $wallet.state === 'Locked')) {
                yield logout();
            }
            let typeOrModule = type;
            if (!typeOrModule) {
                if (_options.length === 0) {
                    typeOrModule = 'builtin';
                }
                else if (_options.length === 1) {
                    typeOrModule = _options[0];
                }
                else {
                    const message = `No Wallet Type Specified, choose from ${$wallet.options}`;
                    // set(walletStore, {error: {message, code: 1}}); // TODO code
                    throw new Error(message);
                }
            }
            if (typeOrModule == 'builtin' && $builtin.state === 'Ready' && !$builtin.available) {
                const message = `No Builtin Wallet`;
                // set(walletStore, {error: {message, code: 1}}); // TODO code
                throw new Error(message);
            } // TODO other type: check if module registered
            set(walletStore, {
                address: undefined,
                connecting: true,
                selected: type,
                state: 'Idle',
                error: undefined,
            });
            _ethersProvider = undefined;
            _web3Provider = undefined;
            if (typeOrModule === 'builtin') {
                _currentModule = undefined;
                yield probeBuiltin(); // TODO try catch ?
                _ethersProvider = _builtinEthersProvider;
                _web3Provider = _builtinWeb3Provider;
            }
            else {
                let module;
                if (typeof typeOrModule === 'string') {
                    if (_options) {
                        for (const choice of _options) {
                            if (typeof choice !== 'string' && choice.id === type) {
                                module = choice;
                            }
                        }
                    }
                }
                else {
                    module = typeOrModule;
                    type = module.id;
                }
                if (!module) {
                    const message = `no module found ${type}`;
                    set(walletStore, {
                        error: { message, code: 1 },
                        selected: undefined,
                        connecting: false,
                    }); // TODO code
                    throw new Error(message);
                }
                try {
                    const { web3Provider } = yield module.setup(moduleConfig); // TODO pass config in select to choose network
                    _web3Provider = web3Provider;
                    _ethersProvider = ethers_1.proxyWeb3Provider(new providers_1.Web3Provider(_web3Provider), _observers);
                    _currentModule = module;
                }
                catch (e) {
                    if (e.message === 'USER_CANCELED') {
                        set(walletStore, { connecting: false, selected: undefined });
                    }
                    else {
                        set(walletStore, {
                            error: { code: errors_1.MODULE_ERROR, message: e.message },
                            selected: undefined,
                            connecting: false,
                        });
                    }
                    throw e;
                }
            }
            if (!_ethersProvider) {
                const message = `no provider found for wallet type ${type}`;
                set(walletStore, {
                    error: { message, code: 1 },
                    selected: undefined,
                    connecting: false,
                }); // TODO code
                throw new Error(message);
            }
            listenForConnection();
            let accounts;
            try {
                if (type === 'builtin' && $builtin.vendor === 'Metamask') {
                    accounts = yield index_js_1.timeout(2000, _ethersProvider.listAccounts(), {
                        error: `Metamask timed out. Please reload the page (see <a href="https://github.com/MetaMask/metamask-extension/issues/7221">here</a>)`,
                    }); // TODO timeout checks (metamask, portis)
                }
                else {
                    // TODO timeout warning
                    accounts = yield index_js_1.timeout(20000, _ethersProvider.listAccounts());
                }
            }
            catch (e) {
                set(walletStore, { error: e, selected: undefined, connecting: false });
                throw e;
            }
            // console.debug({accounts});
            recordSelection(type);
            const address = accounts && accounts[0];
            if (address) {
                set(walletStore, {
                    address,
                    state: 'Ready',
                    connecting: undefined,
                });
                listenForChanges();
                yield setupChain(address);
            }
            else {
                listenForChanges();
                set(walletStore, {
                    address: undefined,
                    state: 'Locked',
                    connecting: undefined,
                });
            }
        });
    }
    let probing;
    function probeBuiltin() {
        if (probing) {
            return probing;
        }
        probing = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if ($builtin.state === 'Ready') {
                return resolve();
            }
            set(builtinStore, { probing: true });
            try {
                const ethereum = yield builtin_1.fetchEthereum();
                if (ethereum) {
                    ethereum.autoRefreshOnNetworkChange = false;
                    _builtinWeb3Provider = ethereum;
                    _builtinEthersProvider = ethers_1.proxyWeb3Provider(new providers_1.Web3Provider(ethereum), _observers);
                    set(builtinStore, {
                        state: 'Ready',
                        vendor: builtin_1.getVendor(ethereum),
                        available: true,
                        probing: false,
                    });
                }
                else {
                    set(builtinStore, {
                        state: 'Ready',
                        vendor: undefined,
                        available: false,
                        probing: false,
                    });
                }
            }
            catch (e) {
                set(builtinStore, {
                    error: e.message || e,
                    vendor: undefined,
                    available: undefined,
                    probing: false,
                });
                return reject(e);
            }
            resolve();
        }));
        return probing;
    }
    // function autoSelect() {
    //   if (!$wallet.options || $wallet.options.length === 0 || ($wallet.options.length === 1 && $wallet.options[0] === "builtin")) {
    //    // try to get account directly if possible (TODO: need to handle Opera quircks, also Brave)
    //     return select({
    //       provider: builtinProvider,
    //       type: "builtin"
    //     });
    //   }
    // }
    function connect(type, moduleConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            yield select(type, moduleConfig);
            if ($wallet.state === 'Locked') {
                return unlock();
            }
            return true;
        });
    }
    function acknowledgeError(field) {
        if (!field) {
            // TODO think more
        }
        else if (field === 'builtin') {
            // TODO
        }
        // TODO other:
        logout();
    }
    function logout() {
        return __awaiter(this, void 0, void 0, function* () {
            stopListeningForChanges();
            stopListeningForConnection();
            if (_currentModule) {
                yield _currentModule.logout();
                _currentModule = undefined;
            }
            set(walletStore, {
                state: 'Idle',
                address: undefined,
                connecting: false,
                unlocking: undefined,
                selected: undefined,
                error: undefined,
            });
            set(balanceStore, {
                state: 'Idle',
                amount: undefined,
                error: undefined,
                blockNumber: undefined,
            });
            set(chainStore, {
                contracts: undefined,
                state: 'Idle',
                notSupported: undefined,
                chainId: undefined,
                error: undefined,
            });
            recordSelection('');
        });
    }
    let unlocking;
    function unlock() {
        if (unlocking) {
            return unlocking;
        }
        let resolved = false;
        const p = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            // TODO Unlocking to retry // TODO add timeout
            if ($wallet.state === 'Locked') {
                set(walletStore, { unlocking: true });
                let accounts;
                try {
                    accounts = yield (_ethersProvider === null || _ethersProvider === void 0 ? void 0 : _ethersProvider.send('eth_requestAccounts', []));
                    accounts = accounts || [];
                }
                catch (e) {
                    accounts = [];
                }
                if (accounts.length > 0) {
                    const address = accounts[0];
                    set(walletStore, {
                        address,
                        state: 'Ready',
                        unlocking: undefined,
                    });
                    yield setupChain(address); // TODO try catch ?
                }
                else {
                    set(walletStore, { unlocking: false });
                    unlocking = undefined;
                    resolved = true;
                    return resolve(false);
                }
                unlocking = undefined;
                resolved = true;
                return resolve(true);
            }
            else {
                resolved = true;
                return reject(new Error(`Not Locked`));
            }
        }));
        if (!resolved) {
            unlocking = p;
        }
        return p;
    }
    // /////////////////////////////////////////////////////////////////////////////////
    exports.default = (config) => {
        config = Object.assign({}, (config || {}));
        config.builtin = config.builtin || { autoProbe: false };
        const { debug, chainConfigs, builtin } = config;
        _chainConfigs = chainConfigs;
        if (debug && typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.$wallet = $wallet;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.$transactions = $transactions;
        }
        _options = config.options || [];
        set(walletStore, {
            state: 'Idle',
            options: _options.map((m) => {
                if (typeof m === 'object') {
                    if (!m.id) {
                        throw new Error('options need to be string or have an id');
                    }
                    return m.id;
                }
                return m;
            }),
        });
        set(builtinStore, {
            state: 'Idle',
        });
        set(chainStore, {
            state: 'Idle',
        });
        set(balanceStore, {
            state: 'Idle',
        });
        if (isBrowser) {
            if (config.autoSelectPrevious) {
                const type = fetchPreviousSelection();
                if (type && type !== '') {
                    select(type);
                }
            }
            if (builtin.autoProbe) {
                probeBuiltin();
            }
        }
        return {
            transactions: {
                subscribe: transactionsStore.subscribe,
            },
            balance: {
                subscribe: balanceStore.subscribe,
            },
            chain: {
                subscribe: chainStore.subscribe,
            },
            builtin: {
                subscribe: builtinStore.subscribe,
                probe: probeBuiltin,
            },
            wallet: {
                subscribe: walletStore.subscribe,
                connect,
                unlock,
                acknowledgeError,
                logout,
                get address() {
                    return $wallet.address;
                },
                get provider() {
                    return _ethersProvider;
                },
                get web3Provider() {
                    return _web3Provider;
                },
                get chain() {
                    return $chain;
                },
                get contracts() {
                    return $chain.contracts;
                },
                get balance() {
                    return $balance.amount;
                },
            },
        };
    };
});
// export function watch(web3Provider: any): void {
//   async function checkAccounts(accounts) {
//     if ($wallet.status === 'Locked' || $wallet.status === 'Unlocking') {
//       // TODO SettingUpWallet ?
//       return; // skip as Unlock / post-Unlocking will fetch the account
//     }
//     // log.info('checking ' + accounts);
//     if (accounts && accounts.length > 0) {
//       const account = accounts[0];
//       if ($wallet.address) {
//         if (account.toLowerCase() !== $wallet.address.toLowerCase()) {
//           reloadPage('accountsChanged', true);
//         }
//       } else {
//         // if($wallet.readOnly) { // TODO check if it can reach there ?
//         //     _ethSetup = eth._setup(web3Provider);
//         // }
//         let initialBalance;
//         if (_fetchInitialBalance) {
//           initialBalance = await _ethSetup.provider.getBalance(account);
//         }
//         log.info('now READY');
//         _set({
//           address: account,
//           status: 'Ready',
//           readOnly: undefined,
//           initialBalance,
//         });
//       }
//     } else {
//       if ($wallet.address) {
//         // if($wallet.readOnly) {  // TODO check if it can reach there ?
//         //     _ethSetup = eth._setup(web3Provider);
//         // }
//         _set({
//           address: undefined,
//           status: 'Locked',
//           readOnly: undefined,
//         });
//       }
//     }
//   }
//   function checkChain(newChainId) {
//     // log.info('checking new chain ' + newChainId);
//     if ($wallet.chainId && newChainId != $wallet.chainId) {
//       log.info('from ' + $wallet.chainId + ' to ' + newChainId);
//       reloadPage('networkChanged');
//     }
//   }
//   async function watchAccounts() {
//     if ($wallet.status === 'WalletToChoose' || $wallet.status === 'Locked' || $wallet.status === 'Unlocking') {
//       return; // skip as Unlock / post-Unlocking will fetch the account
//     }
//     let accounts;
//     try {
//       // log.trace('watching accounts...');
//       accounts = await eth.fetchAccounts();
//       // log.trace(`accounts : ${accounts}`);
//     } catch (e) {
//       log.error('watch account error', e);
//     }
//     await checkAccounts(accounts);
//   }
//   async function watchChain() {
//     let newChainId;
//     try {
//       // log.trace('watching chainId...');
//       newChainId = await eth.fetchBuiltinChainId();
//       // log.trace(`newChainId : ${newChainId}`);
//     } catch (e) {
//       log.error('watch account error', e);
//     }
//     checkChain(newChainId);
//   }
//   if (web3Provider) {
//     // TODO only if builtin is chosen // can use onNetworkChanged / onChainChanged / onAccountChanged events for specific web3 provuder setup
//     try {
//       web3Provider.once('accountsChanged', checkAccounts);
//       web3Provider.once('networkChanged', checkChain);
//       web3Provider.once('chainChanged', checkChain);
//     } catch (e) {
//       log.info('no web3Provider.once');
//     }
//   }
//   // TODO move that into the catch block except for Metamask
//   // still need to watch as even metamask do not emit the "accountsChanged" event all the time: TODO report bug
//   setInterval(watchAccounts, 1000);
//   // still need to watch chain for old wallets
//   setInterval(watchChain, 2000);
// }
define("utils/web", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isPrivateWindow = void 0;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    function chrome76Detection() {
        return __awaiter(this, void 0, void 0, function* () {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const { quota } = yield navigator.storage.estimate();
                if (quota && quota < 120000000)
                    return true;
                else
                    return false;
            }
            else {
                return false;
            }
        });
    }
    function isNewChrome() {
        const pieces = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);
        if (pieces == null || pieces.length != 5) {
            return undefined;
        }
        const major = pieces.map((piece) => parseInt(piece, 10))[1];
        if (major >= 76) {
            return true;
        }
        return false;
    }
    /// from https://github.com/jLynx/PrivateWindowCheck (see https://stackoverflow.com/questions/2860879/detecting-if-a-browser-is-using-private-browsing-mode/55231766#55231766)
    function isPrivateWindow() {
        return new Promise(function (resolve) {
            if (typeof window === 'undefined') {
                resolve(false);
                return;
            }
            try {
                const isSafari = navigator.vendor &&
                    navigator.vendor.indexOf('Apple') > -1 &&
                    navigator.userAgent &&
                    navigator.userAgent.indexOf('CriOS') == -1 &&
                    navigator.userAgent.indexOf('FxiOS') == -1;
                if (isSafari) {
                    //Safari
                    let e = false;
                    if (window.safariIncognito) {
                        e = true;
                    }
                    else {
                        try {
                            window.openDatabase(null, null, null, null);
                            window.localStorage.setItem('test', 1);
                            resolve(false);
                        }
                        catch (t) {
                            e = true;
                            resolve(true);
                        }
                        void !e && ((e = !1), window.localStorage.removeItem('test'));
                    }
                }
                else if (navigator.userAgent.includes('Firefox')) {
                    //Firefox
                    const db = indexedDB.open('test');
                    db.onerror = function () {
                        resolve(true);
                    };
                    db.onsuccess = function () {
                        resolve(false);
                    };
                }
                else if (navigator.userAgent.includes('Edge') ||
                    navigator.userAgent.includes('Trident') ||
                    navigator.userAgent.includes('msie')) {
                    //Edge or IE
                    if (!window.indexedDB && (window.PointerEvent || window.MSPointerEvent))
                        resolve(true);
                    resolve(false);
                }
                else {
                    //Normally ORP or Chrome
                    //Other
                    if (isNewChrome())
                        resolve(chrome76Detection());
                    const fs = window.RequestFileSystem || window.webkitRequestFileSystem;
                    if (!fs)
                        resolve(false);
                    // was null
                    else {
                        fs(window.TEMPORARY, 100, function () {
                            resolve(false);
                        }, function () {
                            resolve(true);
                        });
                    }
                }
            }
            catch (err) {
                console.error(err);
                resolve(false); // was null
            }
        });
    }
    exports.isPrivateWindow = isPrivateWindow;
});
