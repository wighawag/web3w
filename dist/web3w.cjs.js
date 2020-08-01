'use strict';

var contracts = require('@ethersproject/contracts');
var providers = require('@ethersproject/providers');

function makeLog(log) {
  if (!log) {
    return voidLog;
  }

  if (log === console) {
    return {
      trace: log.trace,
      debug: log.trace,
      info: log.info,
      warn: log.warn,
      error: log.error,
      fatal: log.fatal,
      silent: log.log,
    };
  }
  let defaultLog =
    log.fatal ||
    log.error ||
    log.warn ||
    log.info ||
    log.debug ||
    log.silent ||
    log.log;
  if (!defaultLog) {
    defaultLog = console.log.bind(console);
  } else {
    defaultLog = defaultLog.bind(log);
  }
  return {
    trace: log.trace ? log.trace.bind(log) : defaultLog,
    debug: log.debug ? log.debug.bind(log) : defaultLog,
    info: log.info ? log.info.bind(log) : defaultLog,
    warn: log.warn ? log.warn.bind(log) : defaultLog,
    error: log.error ? log.error.bind(log) : defaultLog,
    fatal: log.fatal ? log.fatal.bind(log) : defaultLog,
    silent: log.silent ? log.silent.bind(log) : defaultLog,
  };
}

const voidLog = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  silent: () => {},
};

function noop() {}
function safe_not_equal(a, b) {
  return a != a
    ? b == b
    : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}

// global queue
const subscriber_queue = [];
function writable(value, start) {
  if (!start) {
    start = noop;
  }
  let stop;
  const subscribers = [];

  function set(new_value) {
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

  function update(fn) {
    set(fn(value));
  }

  function subscribe(run, invalidate) {
    if (!invalidate) {
      invalidate = noop;
    }
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

  return {set, update, subscribe};
}

function getEthereum() {
  if (typeof window !== 'undefined') {
    if (window.ethereum) {
      return window.ethereum;
    } else if (window.web3) {
      return window.web3.currentProvider;
    }
  }
  return null;
}

function fetchEthereum() {
  // TODO test with document.readyState !== 'complete' || document.readyState === 'interactive'
  return new Promise((resolve, reject) => {
    if (document.readyState !== 'complete') {
      document.onreadystatechange = function () {
        if (document.readyState === 'complete') {
          document.onreadystatechange = null;
          resolve(getEthereum());
        }
      };
    } else {
      resolve(getEthereum());
    }
  });
}

function getVendor(ethereum) {
  if (!ethereum) {
    return undefined;
  } else if (ethereum.isMetaMask) {
    return 'Metamask';
  } else if (
    navigator.userAgent.indexOf('Opera') != -1 ||
    navigator.userAgent.indexOf('OPR/') != -1
  ) {
    return 'Opera';
  } else {
    return 'unknown';
  }
  // TODO
}

function timeout(time, p, config) {
  return new Promise((resolve, reject) => {
    let _timedOut = false;
    const timer = setTimeout(() => {
      _timedOut = true;
      if (!config) {
        reject(new Error('TimedOut'));
      } else {
        if (typeof config === 'function') {
          resolve(config());
        } else {
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

const noop$1 = () => {};

// export function virtualContracts(onContractsRequested, observers) {
//   observers = observers ? {...observers} : {};
//   observers = {
//     onContractTxRequested: observers.onContractTxRequested || noop,
//     onContractTxCancelled: observers.onContractTxCancelled || noop,
//     onContractTxSent: observers.onContractTxSent || noop,
//   }
//   const {onContractTxRequested, onContractTxCancelled, onContractTxSent} = observers;

//   const fakeContracts = {};
//   return new Proxy(fakeContracts, {
//     get: (obj, contractName) => {

//       if (prop === "functions") {
//         return functionsProxy;
//       } else if (contractToProxy.functions[prop]) {
//         return proxyCall(contractToProxy.functions, prop);
//       } else {
//         return obj[prop];
//       }
//     }
//   });
// }

function proxyContract(contractToProxy, name, observers) {
  observers = observers ? {...observers} : {};
  observers = {
    onContractTxRequested: observers.onContractTxRequested || noop$1,
    onContractTxCancelled: observers.onContractTxCancelled || noop$1,
    onContractTxSent: observers.onContractTxSent || noop$1,
  };
  const {
    onContractTxRequested,
    onContractTxCancelled,
    onContractTxSent,
  } = observers;
  const proxies = {};

  const functionsInterface = contractToProxy.interface.functions;
  const nameToSig = {};
  for (const sig of Object.keys(functionsInterface)) {
    nameToSig[functionsInterface[sig].name] = sig;
  }

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
        methodInterface =
          contractToProxy.interface.functions[nameToSig[methodName]];
      }

      callProxy = new Proxy(functions[methodName], {
        // TODO empty object (to populate later when contract is available ?)
        apply: async (method, thisArg, argumentsList) => {
          const numArguments = argumentsList.length;
          let overrides;
          if (
            numArguments === methodInterface.inputs.length + 1 &&
            typeof argumentsList[numArguments - 1] === 'object'
          ) {
            overrides = argumentsList[numArguments];
          }
          let outcome;
          if (overrides) {
            outcome = overrides.outcome;
            delete overrides.outcome;
          }
          onContractTxRequested({name, method: methodName, overrides, outcome});
          let tx;
          try {
            tx = await method.bind(functions)(...argumentsList);
          } catch (e) {
            onContractTxCancelled({
              name,
              method: methodName,
              overrides,
              outcome,
            }); // TODO id to identify?
            throw e;
          }
          onContractTxSent({
            hash: tx.hash,
            name,
            method: methodName,
            overrides,
            outcome,
          });
          return tx;
        },
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
    get: (obj, prop) => {
      if (prop === 'functions') {
        return functionsProxy;
      } else if (contractToProxy.functions[prop]) {
        return proxyCall(contractToProxy.functions, prop);
      } else if (prop === '_proxiedContract') {
        return contractToProxy;
      } else {
        return obj[prop]; // TODO prototype access ?
      }
    },
  });
}

function proxySigner(
  signer,
  applyMap,
  {
    onTxRequested,
    onTxCancelled,
    onTxSent,
    onSignatureRequested,
    onSignatureCancelled,
    onSignatureReceived,
  }
) {
  applyMap = Object.assign(
    {
      sendTransaction: async (method, thisArg, argumentsList) => {
        onTxRequested(argumentsList[0]);
        let tx;
        try {
          tx = await method.bind(thisArg)(...argumentsList);
        } catch (e) {
          onTxCancelled(argumentsList[0]);
          throw e;
        }
        onTxSent(tx);
        return tx;
      },
      signMessage: async (method, thisArg, argumentsList) => {
        onSignatureRequested(argumentsList[0]);
        let signature;
        try {
          signature = await method.bind(thisArg)(...argumentsList);
        } catch (e) {
          onSignatureCancelled(argumentsList[0]);
          throw e;
        }
        onSignatureReceived(signature);
        return signature;
      },
    },
    applyMap
  );
  const proxies = {};

  function getProxy(methodName, handler) {
    let proxy = proxies[methodName];
    if (!proxy) {
      proxy = new Proxy(signer[methodName], handler);
      proxies[methodName] = proxy;
    }
    return proxy;
  }

  return new Proxy(signer, {
    get: (obj, prop) => {
      const applyFunc = applyMap[prop];
      if (applyFunc) {
        return getProxy(prop, {
          apply: applyFunc,
        });
      } else {
        return obj[prop];
      }
    },
  });
}

function proxyUncheckedJsonRpcSigner(signer, observers) {
  return proxySigner(signer, {}, observers);
}

function proxyJsonRpcSigner(signer, observers) {
  return proxySigner(
    signer,
    {
      connectUnchecked: (method, thisArg, argumentsList) => {
        const signer = method.bind(thisArg)(...argumentsList);
        return proxyUncheckedJsonRpcSigner(signer, observers);
      },
    },
    observers
  );
}

function proxyWeb3Provider(provider, observers) {
  observers = observers ? {...observers} : {};
  observers = {
    onTxRequested: observers.onTxRequested || noop$1,
    onTxCancelled: observers.onTxCancelled || noop$1,
    onTxSent: observers.onTxSent || noop$1,
    onSignatureRequested: observers.onSignatureRequested || noop$1,
    onSignatureCancelled: observers.onSignatureCancelled || noop$1,
    onSignatureReceived: observers.onSignatureReceived || noop$1,
  };
  const getSignerProxy = new Proxy(provider.getSigner, {
    // TODO wallet.connect on demand if not Ready // error out if not accepted // special state ?
    apply: (getSigner, thisArg, argumentsList) => {
      const signer = getSigner.bind(provider)(...argumentsList);
      return proxyJsonRpcSigner(signer, observers);
    },
  });

  return new Proxy(provider, {
    get: (obj, prop) => {
      if (prop === 'getSigner') {
        return getSignerProxy;
      } else if (prop === 'signMessage') {
        return getSignerProxy;
      } else if (prop === 'sendTransaction') {
        return getSignerProxy;
      } else if (prop === 'connectUnchecked') {
        return getSignerProxy;
      } else {
        return obj[prop];
      }
    },
  });
}

// import { isPrivateWindow } from './utils/web';
let logger;

const isBrowser = typeof window != 'undefined';

const $builtin = {
  state: undefined, // Idle | Ready
  loading: false,
  available: undefined,
  error: undefined,
  vendor: undefined,
};

const $balance = {
  state: undefined, // Idle | Ready
  loading: false,
  stale: undefined,
  amount: undefined,
  error: undefined,
  blockNumber: undefined,
};

const $chain = {
  state: undefined, // Idle | Loading | Ready
  loading: false,
  contracts: {},
};

const $wallet = {
  state: undefined, // Idle | Locked | Ready
  loading: false,
  unlocking: undefined,

  address: undefined,

  options: undefined, // wallet Types available
  selected: undefined,

  error: undefined,

  pendingUserConfirmation: undefined, // [] array of type of request
};

function store(data) {
  const result = writable(data);
  result.data = data;
  return result;
}

const $transactions = [];
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
  for (let key of Object.keys(obj)) {
    if (store.data[key] && typeof obj[key] === 'object') {
      for (let subKey of Object.keys(obj[key])) {
        // TODO recursve
        store.data[key][subKey] = obj[key][subKey];
      }
    } else {
      store.data[key] = obj[key];
    }
  }
  // TODO remove try catch
  try {
    logger.debug(JSON.stringify(store.data, null, '  '));
  } catch (e) {
    console.error(e);
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


function onChainChanged() {
  console.log("onChainChanged", arguments);
}

function onAccountsChanged() {
  console.log("onAccountsChanged", arguments);
}

function listenForChanges(address) {
  if (_web3Provider) {
    console.log('listenning for changes...');
    _web3Provider.on('chainChanged', onChainChanged);
    _web3Provider.on('accountsChanged', onAccountsChanged);
  }
}

function stopListeningForChanges() {
  if (_web3Provider) {
    console.log('stop listenning for changes...');
    _web3Provider.removeListener('chainChanged', onChainChanged);
    _web3Provider.removeListener('accountsChanged', onAccountsChanged);
  }
}

function onConnect() {
  console.log("onConnect", arguments);
}

function onDisconnect() {
  console.log("onDisconnect", arguments);
}

function listenForConnection() {
  if (_web3Provider) {
    console.log('listenning for connection...');
    _web3Provider.on('connect', onConnect);
    _web3Provider.on('disconnect', onDisconnect);
  }
}

function stopListeningForConnection() {
  if (_web3Provider) {
    console.log('stop listenning for connection...');
    _web3Provider.removeListener('connect', onConnect);
    _web3Provider.removeListener('disconnect', onDisconnect);
  }
}

function isHex(value) {
  return (
    typeof value === 'string' &&
    value.length > 2 &&
    value.slice(0, 2).toLowerCase() === '0x'
  );
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
  } else {
    $wallet.pendingUserConfirmation = [type];
  }
  set(walletStore, {pendingUserConfirmation: $wallet.pendingUserConfirmation});
}
function cancelUserAttention(type) {
  if ($wallet.pendingUserConfirmation) {
    const index = $wallet.pendingUserConfirmation.indexOf(type);
    if (index >= 0) {
      $wallet.pendingUserConfirmation.splice(index, 1);
      if ($wallet.pendingUserConfirmation.length === 0) {
        $wallet.pendingUserConfirmation = undefined;
      }
      set(walletStore, {pendingUserConfirmation: $wallet.pendingUserConfirmation});
    }
  }
}

const _observers = {
  onTxRequested: (transaction) => {
    requestUserAttention('transaction');
  },
  onTxCancelled: (error) => {
    cancelUserAttention('transaction');
  },
  onTxSent: (tx) => {
    cancelUserAttention('transaction');
  },
  onSignatureRequested: (message) => {
    requestUserAttention('signature');
  },
  onSignatureCancelled: (error) => {
    cancelUserAttention('signature');
  },
  onSignatureReceived: (signature) => {
    cancelUserAttention('signature');
  },
  onContractTxRequested: ({name, method, overrides, outcome}) => {
    // console.log("onContractTxRequest", {name, method, overrides, outcome});
  },
  onContractTxCancelled: (error) => {},
  onContractTxSent: ({hash, name, method, overrides, outcome}) => {
    // console.log('onContractTxSent', {hash, name, method, overrides, outcome});
    if (hash) {
      addTransaction({hash, name, method, overrides, outcome});
    } else {
      logger.log('onContractTxSent', {hash, name, method, overrides, outcome});
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

async function setupChain(address) {
  set(chainStore, {loading: true});

  let contractsToAdd = {};
  let addresses = {};
  let contractsInfos = {};
  const {chainId} = await _ethersProvider.getNetwork();
  if (_chainConfigs) {
    const chainConfigs = _chainConfigs;
    if (typeof chainConfigs === 'function') {
      chainConfigs = await chainConfigs(chainId);
    }
    if (chainConfigs.chainId) {
      if (
        chainId == chainConfigs.chainId ||
        chainId == toDecimal(chainConfigs.chainId)
      ) {
        contractsInfos = chainConfigs.contracts;
      } else {
        const error = {
          message: `chainConfig only available for ${chainConfigs.chainId} , not available for ${chainId}`,
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
    } else {
      const chainConfig = chainConfigs[chainId] || chainConfigs[toHex(chainId)];
      if (!chainConfig) {
        const error = {message: `chainConfig not available for ${chainId}`};
        set(chainStore, {
          error,
          chainId,
          notSupported: true,
          loading: false,
          state: 'Idle',
        });
        throw new Error(error.message);
      } else {
        contractsInfos = chainConfig.contracts;
      }
    }
    for (const contractName of Object.keys(contractsInfos)) {
      if (contractName === 'status') {
        const error = {message: `invalid name for contract : "status"`};
        set(chainStore, {error, state: 'Idle', loading: false});
        throw new Error(error.message);
      }
      if (contractName === 'error') {
        const error = {message: `invalid name for contract : "error"`};
        set(chainStore, {error, state: 'Idle', loading: false});
        throw new Error(error.message);
      }
      const contractInfo = contractsInfos[contractName];
      if (contractInfo.abi) {
        contractsToAdd[contractName] = proxyContract(
          new contracts.Contract(
            contractInfo.address,
            contractInfo.abi,
            _ethersProvider.getSigner(address)
          ),
          contractName,
          _observers
        );
      }
      addresses[contractName] = contractInfo.address;
    }
  }
  set(chainStore, {
    state: 'Ready',
    loading: undefined,
    chainId,
    addresses,
    contracts: {
      ...contractsToAdd,
      toJSON() {
        const obj = {};
        for (const contractName of Object.keys(contractsInfos)) {
          obj[contractName] = {
            address: contractsInfos[contractName].address,
            abi: contractsInfos[contractName].abi,
          };
        }
        return obj;
      },
    },
  }); // TODO None ?
}

async function select(type, config) {
  if (
    $wallet.selected &&
    ($wallet.state === 'Ready' || $wallet.state === 'Locked')
  ) {
    await logout();
  }

  if (!type) {
    if (_options.length === 0) {
      type = 'builtin';
    } else if (_options.length === 1) {
      type = _options[0];
    } else {
      const message = `No Wallet Type Specified, choose from ${$wallet.options}`;
      // set(walletStore, {error: {message, code: 1}}); // TODO code
      throw new Error(message);
    }
  }
  if (type == 'builtin' && $builtin.state === 'Ready' && !$builtin.available) {
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
  if (type === 'builtin') {
    _currentModule = undefined;
    await probeBuiltin(); // TODO try catch ?
    _ethersProvider = _builtinEthersProvider;
    _web3Provider = _builtinWeb3Provider;
  } else {
    let module;
    if (typeof type === 'string') {
      if (_options) {
        for (const choice of _options) {
          if (typeof choice !== 'string' && choice.id === type) {
            module = choice;
          }
        }
      }
    } else {
      module = type;
      type = module.id;
    }

    try {
      const {chainId, web3Provider} = await module.setup(config); // TODO pass config in select to choose network
      _web3Provider = web3Provider;
      _ethersProvider = proxyWeb3Provider(
        new providers.Web3Provider(_web3Provider),
        _observers
      );
      _currentModule = module;
    } catch (e) {
      if (e.message === 'USER_CANCELED') {
        set(walletStore, {loading: false, selected: undefined});
      } else {
        set(walletStore, {
          error: {message: e.message},
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
      error: {message, code: 1},
      selected: undefined,
      loading: false,
    }); // TODO code
    throw new Error(message);
  }

  listenForConnection();

  let accounts;
  try {
    if (type === 'builtin' && $builtin.vendor === 'Metamask') {
      accounts = await timeout(2000, _ethersProvider.listAccounts(), {
        error: `Metamask timed out. Please reload the page (see <a href="https://github.com/MetaMask/metamask-extension/issues/7221">here</a>)`,
      }); // TODO timeout checks (metamask, portis)
    } else {
      // TODO timeout warning
      accounts = await timeout(20000, _ethersProvider.listAccounts());
    }
  } catch (e) {
    set(walletStore, {error: e, selected: undefined, loading: false});
    throw e;
  }
  // console.log({accounts});
  recordSelection(type);
  const address = accounts && accounts[0];
  if (address) {
    set(walletStore, {
      address,
      state: 'Ready',
      loading: undefined,
    });
    listenForChanges();
    await setupChain(address);
  } else {
    set(walletStore, {
      address: undefined,
      state: 'Locked',
      loading: undefined,
    });
  }
}

let probing;
function probeBuiltin(config = {}) {
  if (probing) {
    return probing;
  }
  probing = new Promise(async (resolve, reject) => {
    if ($builtin.state === 'Ready') {
      return resolve();
    }
    set(builtinStore, {loading: true});
    try {
      let ethereum = await fetchEthereum();
      if (ethereum) {
        _builtinWeb3Provider = ethereum;
        _builtinEthersProvider = proxyWeb3Provider(
          new providers.Web3Provider(ethereum),
          _observers
        );
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
        //     console.log('RELOAD');
        //   });
        // }
      } else {
        set(builtinStore, {
          state: 'Ready',
          vendor: undefined,
          available: false,
          loading: undefined,
        });
      }
    } catch (e) {
      set(builtinStore, {
        error: e.message || e,
        vendor: undefined,
        available: undefined,
        loading: false,
      });
      return reject(e);
    }
    resolve();
  });
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

async function connect(type) {
  await select(type);
  if ($wallet.state === 'Locked') {
    return unlock();
  }
  return true;
}

function acknowledgeError(field) {
  // TODO other:
  logout();
}

async function logout() {
  stopListeningForChanges();
  stopListeningForConnection();
  if (_currentModule) {
    await _currentModule.logout();
    _currentModule = null;
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
}

let unlocking;
function unlock() {
  if (unlocking) {
    return unlocking;
  }
  let resolved = false;
  const p = new Promise(async (resolve, reject) => {
    // TODO Unlocking to retry // TODO add timeout
    if ($wallet.state === 'Locked') {
      set(walletStore, {unlocking: true});
      let accounts;
      try {
        accounts = await _ethersProvider.send('eth_requestAccounts', []);
      } catch (e) {
        accounts = [];
      }
      if (accounts.length > 0) {
        const address = accounts[0];
        set(walletStore, {
          address,
          state: 'Ready',
          unlocking: undefined,
        });
        await setupChain(address); // TODO try catch ?
      } else {
        set(walletStore, {unlocking: false});
        unlocking = null;
        resolved = true;
        return resolve(false);
      }
      unlocking = null;
      resolved = true;
      return resolve(true);
    } else {
      resolved = true;
      return reject(new Error(`Not Locked`));
    }
  });
  if (!resolved) {
    unlocking = p;
  }
  return p;
}

// /////////////////////////////////////////////////////////////////////////////////
var index = (config) => {
  config = {...(config || {})};
  config.builtin = config.builtin || {};
  const {log, debug, chainConfigs, builtin} = config;

  _chainConfigs = chainConfigs;
  logger = makeLog(log);
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
          throw new Error('options need to be string or have an id', m);
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
      // get fallBackProvider() {
      //   return _fallBackProvider;
      // }
    },
  };
};

module.exports = index;
