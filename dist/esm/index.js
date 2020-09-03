var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// import { isPrivateWindow } from './utils/web';
// import {Wallet} from "@ethersproject/wallet";
import { Contract } from '@ethersproject/contracts';
import { Web3Provider, } from '@ethersproject/providers';
import { writable } from './utils/store';
import { fetchEthereum, getVendor } from './utils/builtin';
import { timeout } from './utils/index.js';
import { proxyContract, proxyWeb3Provider } from './utils/ethers';
import { logs } from 'named-logs';
const console = logs('web3w:index');
const isBrowser = typeof window != 'undefined';
const $builtin = {
    state: 'Idle',
    loading: false,
    available: undefined,
    error: undefined,
    vendor: undefined,
};
const $balance = {
    state: 'Idle',
    loading: false,
    stale: undefined,
    amount: undefined,
    error: undefined,
    blockNumber: undefined,
};
const $chain = {
    state: 'Idle',
    loading: false,
    contracts: {},
    error: undefined,
};
const $wallet = {
    state: 'Idle',
    loading: false,
    unlocking: false,
    address: undefined,
    options: undefined,
    selected: undefined,
    pendingUserConfirmation: undefined,
    error: undefined,
};
function store(data) {
    const result = writable(data);
    result.data = data;
    return result;
}
const $transactions = []; // TODO
const walletStore = store($wallet);
const transactionsStore = store($transactions);
const builtinStore = store($builtin);
const chainStore = store($chain);
const balanceStore = store($balance);
function addTransaction(obj) {
    $transactions.push(obj);
    transactionsStore.set($transactions);
}
function set(store, obj) {
    for (const key of Object.keys(obj)) {
        const anyObj = obj;
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
function reset(store, fields) {
    if (typeof fields === 'string') {
        fields = [fields];
    }
    const anyStore = store;
    for (const field of fields) {
        const current = anyStore.data[field];
        if (typeof current === 'object') {
            anyStore.data[field] = { status: undefined };
        }
        else {
            anyStore.data[field] = undefined;
        }
    }
    store.set(store.data);
}
// //////////////////////////////////////////////////////////////////////////////
let _ethersProvider;
let _web3Provider;
let _builtinEthersProvider;
let _builtinWeb3Provider;
let _chainConfigs;
let _currentModule;
let _options;
function onChainChanged(...args) {
    console.debug('onChainChanged', ...args);
}
function onAccountsChanged(...args) {
    console.debug('onAccountsChanged', ...args);
}
function listenForChanges(address) {
    if (_web3Provider) {
        console.debug('listenning for changes...');
        _web3Provider.on('chainChanged', onChainChanged);
        _web3Provider.on('accountsChanged', onAccountsChanged);
    }
}
function stopListeningForChanges() {
    if (_web3Provider) {
        console.debug('stop listenning for changes...');
        _web3Provider.removeListener('chainChanged', onChainChanged);
        _web3Provider.removeListener('accountsChanged', onAccountsChanged);
    }
}
function onConnect(...args) {
    console.debug('onConnect', ...args);
}
function onDisconnect(...args) {
    console.debug('onDisconnect', ...args);
}
function listenForConnection() {
    if (_web3Provider) {
        console.debug('listenning for connection...');
        _web3Provider.on('connect', onConnect);
        _web3Provider.on('disconnect', onDisconnect);
    }
}
function stopListeningForConnection() {
    if (_web3Provider) {
        console.debug('stop listenning for connection...');
        _web3Provider.removeListener('connect', onConnect);
        _web3Provider.removeListener('disconnect', onDisconnect);
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
        requestUserAttention('transaction');
    },
    onTxCancelled: (transaction) => {
        cancelUserAttention('transaction');
    },
    onTxSent: (tx) => {
        cancelUserAttention('transaction');
    },
    onSignatureRequested: (message) => {
        requestUserAttention('signature');
    },
    onSignatureCancelled: (message) => {
        cancelUserAttention('signature');
    },
    onSignatureReceived: (signature) => {
        cancelUserAttention('signature');
    },
    onContractTxRequested: ({ name, method, overrides, outcome, }) => {
        console.debug('onContractTxRequest', { name, method, overrides, outcome });
    },
    onContractTxCancelled: ({ name, method, overrides, outcome, }) => {
        console.debug('onContractTxCancelled', { name, method, overrides, outcome });
    },
    onContractTxSent: ({ hash, name, method, overrides, outcome, }) => {
        // console.debug('onContractTxSent', {hash, name, method, overrides, outcome});
        if (hash) {
            addTransaction({ hash, name, method, overrides, outcome });
        }
        else {
            console.debug('onContractTxSent', { hash, name, method, overrides, outcome });
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
        if (_ethersProvider === null) {
            const error = {
                message: `no provider setup yet`,
            };
            set(chainStore, {
                error,
                loading: false,
                state: 'Idle',
            });
            throw new Error(error.message);
        }
        set(chainStore, { loading: true });
        const contractsToAdd = {};
        const addresses = {};
        let contractsInfos = {};
        const { chainId: chainIdAsNumber } = yield _ethersProvider.getNetwork();
        const chainId = String(chainIdAsNumber);
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
                        message: `chainConfig only available for ${chainConfig.chainId} , not available for ${chainId}`,
                    };
                    set(chainStore, {
                        error,
                        chainId,
                        notSupported: true,
                        loading: false,
                        state: 'Idle',
                    });
                    throw new Error(error.message);
                }
            }
            else {
                const multichainConfigs = chainConfigs;
                const chainConfig = multichainConfigs[chainId] || multichainConfigs[toHex(chainId)];
                if (!chainConfig) {
                    const error = { message: `chainConfig not available for ${chainId}` };
                    set(chainStore, {
                        error,
                        chainId,
                        notSupported: true,
                        loading: false,
                        state: 'Idle',
                    });
                    throw new Error(error.message);
                }
                else {
                    contractsInfos = chainConfig.contracts;
                }
            }
            for (const contractName of Object.keys(contractsInfos)) {
                if (contractName === 'status') {
                    const error = { message: `invalid name for contract : "status"` };
                    set(chainStore, { error, state: 'Idle', loading: false });
                    throw new Error(error.message);
                }
                if (contractName === 'error') {
                    const error = { message: `invalid name for contract : "error"` };
                    set(chainStore, { error, state: 'Idle', loading: false });
                    throw new Error(error.message);
                }
                const contractInfo = contractsInfos[contractName];
                if (contractInfo.abi) {
                    contractsToAdd[contractName] = proxyContract(new Contract(contractInfo.address, contractInfo.abi, _ethersProvider.getSigner(address)), contractName, _observers);
                }
                addresses[contractName] = contractInfo.address;
            }
        }
        set(chainStore, {
            state: 'Ready',
            loading: undefined,
            chainId,
            addresses,
            contracts: contractsToAdd,
        }); // TODO None ?
    });
}
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
            loading: true,
            selected: type,
            state: 'Idle',
            error: undefined,
        });
        _ethersProvider = null;
        _web3Provider = null;
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
                    loading: false,
                }); // TODO code
                throw new Error(message);
            }
            try {
                const { chainId, web3Provider } = yield module.setup(moduleConfig); // TODO pass config in select to choose network
                _web3Provider = web3Provider;
                _ethersProvider = proxyWeb3Provider(new Web3Provider(_web3Provider), _observers);
                _currentModule = module;
            }
            catch (e) {
                if (e.message === 'USER_CANCELED') {
                    set(walletStore, { loading: false, selected: undefined });
                }
                else {
                    set(walletStore, {
                        error: { message: e.message },
                        selected: undefined,
                        loading: false,
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
                loading: false,
            }); // TODO code
            throw new Error(message);
        }
        listenForConnection();
        let accounts;
        try {
            if (type === 'builtin' && $builtin.vendor === 'Metamask') {
                accounts = yield timeout(2000, _ethersProvider.listAccounts(), {
                    error: `Metamask timed out. Please reload the page (see <a href="https://github.com/MetaMask/metamask-extension/issues/7221">here</a>)`,
                }); // TODO timeout checks (metamask, portis)
            }
            else {
                // TODO timeout warning
                accounts = yield timeout(20000, _ethersProvider.listAccounts());
            }
        }
        catch (e) {
            set(walletStore, { error: e, selected: undefined, loading: false });
            throw e;
        }
        // console.debug({accounts});
        recordSelection(type);
        const address = accounts && accounts[0];
        if (address) {
            set(walletStore, {
                address,
                state: 'Ready',
                loading: undefined,
            });
            listenForChanges(address);
            yield setupChain(address);
        }
        else {
            set(walletStore, {
                address: undefined,
                state: 'Locked',
                loading: undefined,
            });
        }
    });
}
let probing;
function probeBuiltin(config = {}) {
    if (probing) {
        return probing;
    }
    probing = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        if ($builtin.state === 'Ready') {
            return resolve();
        }
        set(builtinStore, { loading: true });
        try {
            const ethereum = yield fetchEthereum();
            if (ethereum) {
                _builtinWeb3Provider = ethereum;
                _builtinEthersProvider = proxyWeb3Provider(new Web3Provider(ethereum), _observers);
                set(builtinStore, {
                    state: 'Ready',
                    vendor: getVendor(ethereum),
                    available: true,
                    loading: undefined,
                });
                // if (config.metamaskReloadFix && $wallet.builtin.vendor === "Metamask") {
                //   // see https://github.com/MetaMask/metamask-extension/issues/7221
                //   await timeout(1000, _builtinEthersProvider.send("eth_chainId", []), () => {
                //     // window.location.reload();
                //     console.debug('RELOAD');
                //   });
                // }
            }
            else {
                set(builtinStore, {
                    state: 'Ready',
                    vendor: undefined,
                    available: false,
                    loading: undefined,
                });
            }
        }
        catch (e) {
            set(builtinStore, {
                error: e.message || e,
                vendor: undefined,
                available: undefined,
                loading: false,
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
            loading: false,
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
export default (config) => {
    config = Object.assign({}, (config || {}));
    config.builtin = config.builtin || {};
    const { debug, chainConfigs, builtin } = config;
    _chainConfigs = chainConfigs;
    if (debug && typeof window !== 'undefined') {
        window.$wallet = $wallet;
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
        if (config.builtin.autoProbe) {
            probeBuiltin(config.builtin);
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