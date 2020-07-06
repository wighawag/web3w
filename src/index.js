// import { isPrivateWindow } from './utils/web';
// import {Wallet} from "@ethersproject/wallet";
import {Contract} from '@ethersproject/contracts';
import {Web3Provider} from '@ethersproject/providers';
import {makeLog} from './utils/log';
import {writable} from './utils/store';
import {fetchEthereum, getVendor} from './utils/builtin';
import {timeout} from './utils/index.js';
import {proxyContract, proxyWeb3Provider} from './utils/ethers';
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
    console.log(logger);
    logger.debug(JSON.stringify(store.data, null, '  '));
  } catch (e) {
    console.error(e);
  }
  store.set(store.data);
}

function reset(store, fields) {
  if (typeof fields === 'string') {
    fields = [fields];
  }
  for (const field of fields) {
    const current = $wallet[field];
    if (typeof current === 'object') {
      store.data[field] = {status: undefined};
    } else {
      store.data[field] = undefined;
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
  set({pendingUserConfirmation: $wallet.pendingUserConfirmation});
}
function cancelUserAttention(type) {
  if ($wallet.pendingUserConfirmation) {
    const index = $wallet.pendingUserConfirmation.indexOf(type);
    if (index >= 0) {
      $wallet.pendingUserConfirmation.splice(index, 1);
      if ($wallet.pendingUserConfirmation.length === 0) {
        $wallet.pendingUserConfirmation = undefined;
      }
      set({pendingUserConfirmation: $wallet.pendingUserConfirmation});
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
    console.log('onContractTxSent', {hash, name, method, overrides, outcome});
    addTransaction({hash, name, method, overrides, outcome});
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
          new Contract(
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
    loading: false,
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

async function select(type) {
  if (!type) {
    if (_options.length === 0) {
      type = 'builtin';
    } else if (_options.length === 1) {
      type = _options[0];
    } else {
      const message = `No Wallet Type Specified, choose from ${$wallet.options}`;
      // set({error: {message, code: 1}}); // TODO code
      throw new Error(message);
    }
  }
  if (type == 'builtin' && $builtin.state === 'Ready' && !$builtin.available) {
    const message = `No Builtin Wallet`;
    // set({error: {message, code: 1}}); // TODO code
    throw new Error(message);
  } // TODO other type: check if module registered

  set(walletStore, {
    address: undefined,
    loading: true,
    selected: type,
    previousType: $wallet.selected,
    state: 'Idle',
    error: undefined,
  });
  _ethersProvider = null;
  _web3Provider = null;
  if (type === 'builtin') {
    await probeBuiltin();
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

    const {chainId, web3Provider} = await module.setup(module.config); // TODO pass config in select to choose network
    _web3Provider = web3Provider;
    _ethersProvider = proxyWeb3Provider(
      new Web3Provider(_web3Provider),
      _observers
    );
    _currentModule = module;
  }

  if (!_ethersProvider) {
    const message = `no provider found for wallet type ${type}`;
    set(walletStore, {error: {message, code: 1}}); // TODO code
    throw new Error(message);
  }

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
    set(walletStore, {error: e});
    throw e;
  }
  console.log({accounts});
  recordSelection(type);
  const address = accounts && accounts[0];
  if (address) {
    set(walletStore, {
      address,
      state: 'Ready',
      loading: false,
    });
    await setupChain(address);
  } else {
    set(walletStore, {
      address: undefined,
      state: 'Locked',
      loading: false,
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
          new Web3Provider(ethereum),
          _observers
        );
        set(builtinStore, {
          state: 'Ready',
          vendor: getVendor(ethereum),
          available: true,
          loading: false,
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
          loading: false,
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
  if ($wallet.status === 'Locked') {
    return unlock();
  }
  return true;
}

function acknowledgeError(field) {
  if (!field) {
    // TODO think more
  } else if (field === 'builtin') {
    // TODO
  }
  // TODO other:
  logout();
}

async function logout() {
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
export default (config) => {
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
    options: _options.map((m) => m.id || m),
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
