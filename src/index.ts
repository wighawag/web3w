// import { isPrivateWindow } from './utils/web';
// import {Wallet} from "@ethersproject/wallet";
import {Contract, Overrides} from '@ethersproject/contracts';
import {
  Web3Provider,
  TransactionRequest,
  TransactionResponse,
  JsonRpcProvider,
  ExternalProvider,
} from '@ethersproject/providers';
import {BigNumber} from '@ethersproject/bignumber';
import {writable} from './utils/store';
import {fetchEthereum, getVendor} from './utils/builtin';
import {timeout} from './utils/index.js';
import {proxyContract, proxyWeb3Provider} from './utils/ethers';
import {Writable, Readable} from './utils/internals';
import {logs} from 'named-logs';
import {CHAIN_NO_PROVIDER, CHAIN_CONFIG_NOT_AVAILABLE, MODULE_ERROR} from './errors';

const console = logs('web3w:index');

type Base = {
  loading: boolean;
  error?: {code: number; message: string};
};

type BalanceData = Base & {
  state: 'Idle' | 'Ready';
  stale?: boolean;
  amount?: BigNumber;
  blockNumber?: number;
};

type BuiltinData = Base & {
  state: 'Idle' | 'Ready';
  available?: boolean;
  vendor?: string;
};

type Contracts = {[name: string]: Contract};

type ChainData = Base & {
  state: 'Idle' | 'Connected' | 'Ready';
  chainId?: string;
  addresses?: {[name: string]: string};
  contracts?: Contracts;
  notSupported?: boolean;
};

type WalletData = Base & {
  state: 'Idle' | 'Locked' | 'Ready';
  unlocking: boolean;
  address?: string;
  options?: string[]; // wallet Types available
  selected?: string;
  pendingUserConfirmation?: string[];
};

type Abi = {type: string; name: string}[]; // TODO

type WritableWithData<T> = Writable<T> & {data: T};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | unknown;
}
type WindowWeb3Provider = ExternalProvider & {
  sendAsync?(
    request: {method: string; params?: unknown[]},
    callback: (error: unknown, result: {jsonrpc: '2.0'; error?: unknown; result?: unknown}) => void
  ): void;
  send?(...args: unknown[]): unknown;
  request?(args: RequestArguments): Promise<unknown>;
  on?(event: string, callback: AnyFunction): void;
  removeListener?(event: string, callback: AnyFunction): void;
};

type Module = {
  id: string;
  setup(options?: ModuleOptions): Promise<{chainId: string; web3Provider: WindowWeb3Provider}>;
  logout(): Promise<void>;
};

type ModuleOptions = (string | Module)[]; //TODO
type ContractsInfos = {[name: string]: {address: string; abi: Abi}};
type ChainConfig = {
  chainId: string;
  contracts: ContractsInfos;
};

type MultiChainConfigs = {[chainId: string]: ChainConfig};

type ChainConfigs = MultiChainConfigs | ChainConfig | ((chainId: string) => Promise<ChainConfig | MultiChainConfigs>);

type BuiltinConfig = {
  autoProbe: boolean;
}; // TODO

type TransactionRecord = {
  hash: string;
  name: string;
  method: string;
  overrides: Overrides;
  outcome: unknown;
}; // TODO

export type Web3wConfig = {
  builtin?: BuiltinConfig;
  debug?: boolean;
  chainConfigs: ChainConfigs;
  options?: ModuleOptions;
  autoSelectPrevious?: boolean;
};

const isBrowser = typeof window != 'undefined';

const $builtin: BuiltinData = {
  state: 'Idle', // Idle | Ready
  loading: false,
  available: undefined,
  error: undefined,
  vendor: undefined,
};

const $balance: BalanceData = {
  state: 'Idle',
  loading: false,
  stale: undefined,
  amount: undefined,
  error: undefined,
  blockNumber: undefined,
};

const $chain: ChainData = {
  state: 'Idle',
  loading: false,
  contracts: {},
  error: undefined,
};

interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

const $wallet: WalletData = {
  state: 'Idle', // Idle | Locked | Ready
  loading: false,
  unlocking: false,
  address: undefined,
  options: undefined, // wallet Types available
  selected: undefined,
  pendingUserConfirmation: undefined, // [] array of type of request
  error: undefined,
};

function store<T>(data: T): WritableWithData<T> {
  const result = writable(data) as WritableWithData<T>;
  result.data = data;
  return result;
}

const $transactions: TransactionRecord[] = [];
const walletStore = store($wallet);
const transactionsStore = store($transactions);
const builtinStore = store($builtin);
const chainStore = store($chain);
const balanceStore = store($balance);

function addTransaction(tx: TransactionRecord) {
  $transactions.push(tx);
  transactionsStore.set($transactions);
}

function set<T>(store: WritableWithData<T>, obj: Partial<T>) {
  for (const key of Object.keys(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyObj = obj as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyStore = store as any;
    if (anyStore.data[key] && typeof anyObj[key] === 'object') {
      for (const subKey of Object.keys(anyObj[key])) {
        // TODO recursve
        anyStore.data[key][subKey] = anyObj[key][subKey];
      }
    } else {
      anyStore.data[key] = anyObj[key];
    }
  }
  try {
    console.debug(JSON.stringify(store.data, null, '  '));
  } catch (e) {
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
let _ethersProvider: JsonRpcProvider | undefined;
let _web3Provider: WindowWeb3Provider | undefined;
let _builtinEthersProvider: JsonRpcProvider | undefined;
let _builtinWeb3Provider: WindowWeb3Provider | undefined;
let _chainConfigs: ChainConfigs;
let _currentModule: Module | undefined;
let _options: ModuleOptions;

async function onChainChanged(chainId: string) {
  if (chainId === '0xNaN') {
    console.warn('onChainChanged bug (return 0xNaN), metamask bug?');
    if (!_web3Provider) {
      throw new Error('no web3Provider to get chainId');
    }
    chainId = await providerSend(_web3Provider, 'eth_chainId');
  }
  const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
  console.debug('onChainChanged', {chainId, chainIdAsDecimal}); // TODO
  set(chainStore, {
    contracts: undefined,
    addresses: undefined,
    state: 'Connected',
    chainId: chainIdAsDecimal,
    notSupported: undefined,
  });
  // TODO load
}

function onAccountsChanged(accounts: string[]) {
  console.debug('onAccountsChanged', {accounts}); // TODO
  set(walletStore, {address: accounts[0]});
  // TODO balance
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function providerSend(provider: WindowWeb3Provider, method: string, params?: unknown[]): Promise<any> {
  if (provider.request) {
    return provider.request({method, params});
  }
  const sendAsync = provider.sendAsync?.bind(provider);
  if (sendAsync) {
    return new Promise<unknown>((resolve, reject) => {
      sendAsync({method, params}, (error, response) => {
        if (error) {
          reject(error);
        } else if (response.error) {
          reject(response.error);
        } else {
          resolve(response.result);
        }
      });
    });
  }
  throw new Error('provider not supported');
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollChainChanged(web3Provider: WindowWeb3Provider, callback: (chainId: string) => void) {
  while (_listenning) {
    const chainId: string = await providerSend(web3Provider, 'eth_chainId');
    const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
    if (_listenning && $chain.chainId !== chainIdAsDecimal) {
      try {
        callback(chainId);
      } catch (e) {
        console.error(e);
        // TODO error in chain.error
      }
    }
    await wait(3000);
  }
}

async function pollAccountsChanged(web3Provider: WindowWeb3Provider, callback: (accounts: string[]) => void) {
  while (_listenning) {
    const accounts: string[] = await providerSend(web3Provider, 'eth_accounts');
    if (_listenning && accounts[0] !== $wallet.address) {
      // TODO multi account support ?
      try {
        callback(accounts);
      } catch (e) {
        console.error(e);
        // TODO error in wallet.error
      }
    }
    await wait(3000);
  }
}

function listenForChanges(address: string) {
  if (_web3Provider) {
    _listenning = true;
    console.debug('listenning for changes...', {address});
    if (_web3Provider.on) {
      _web3Provider.on('chainChanged', onChainChanged);
      _web3Provider.on('accountsChanged', onAccountsChanged);
    } else {
      pollChainChanged(_web3Provider, onChainChanged);
      pollAccountsChanged(_web3Provider, onAccountsChanged);
    }
  }
}

function stopListeningForChanges() {
  _listenning = false;
  if (_web3Provider) {
    console.debug('stop listenning for changes...');
    _web3Provider.removeListener && _web3Provider.removeListener('chainChanged', onChainChanged);
    _web3Provider.removeListener && _web3Provider.removeListener('accountsChanged', onAccountsChanged);
  }
}

function onConnect({chainId}: {chainId: string}) {
  const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
  console.debug('onConnect', {chainId, chainIdAsDecimal}); // TODO
}

function onDisconnect(error?: ProviderRpcError) {
  console.debug('onDisconnect', {error}); // TODO
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

function isHex(value: string): boolean {
  return typeof value === 'string' && value.length > 2 && value.slice(0, 2).toLowerCase() === '0x';
}

function toDecimal(value: string): string {
  if (isHex(value)) {
    return '' + parseInt(value.slice(2));
  }
  return value;
}

function toHex(value: string) {
  if (isHex(value)) {
    return value;
  }
  return '0x' + parseInt(value).toString(16);
}

function requestUserAttention(type: string) {
  if ($wallet.pendingUserConfirmation) {
    $wallet.pendingUserConfirmation.push(type);
  } else {
    $wallet.pendingUserConfirmation = [type];
  }
  set(walletStore, {pendingUserConfirmation: $wallet.pendingUserConfirmation});
}
function cancelUserAttention(type: string) {
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
  onTxRequested: (transaction: TransactionRequest) => {
    console.debug('onTxRequested', {transaction});
    requestUserAttention('transaction');
  },
  onTxCancelled: (transaction: TransactionRequest) => {
    console.debug('onTxCancelled', {transaction});
    cancelUserAttention('transaction');
  },
  onTxSent: (transaction: TransactionResponse) => {
    console.debug('onTxSent', {transaction});
    cancelUserAttention('transaction');
  },
  onSignatureRequested: (message: unknown) => {
    console.debug('onSignatureRequested', {message});
    requestUserAttention('signature');
  },
  onSignatureCancelled: (message: unknown) => {
    console.debug('onSignatureCancelled', {message});
    cancelUserAttention('signature');
  },
  onSignatureReceived: (signature: string) => {
    console.debug('onSignatureReceived', {signature});
    cancelUserAttention('signature');
  },
  onContractTxRequested: ({
    name,
    method,
    overrides,
    outcome,
  }: {
    name: string;
    method: string;
    overrides: Overrides;
    outcome: unknown;
  }) => {
    console.debug('onContractTxRequest', {name, method, overrides, outcome});
  },
  onContractTxCancelled: ({
    name,
    method,
    overrides,
    outcome,
  }: {
    name: string;
    method: string;
    overrides: Overrides;
    outcome: unknown;
  }) => {
    console.debug('onContractTxCancelled', {name, method, overrides, outcome});
  },
  onContractTxSent: ({
    hash,
    name,
    method,
    overrides,
    outcome,
  }: {
    hash: string;
    name: string;
    method: string;
    overrides: Overrides;
    outcome: unknown;
  }) => {
    console.debug('onContractTxSent', {hash, name, method, overrides, outcome});
    if (hash) {
      addTransaction({hash, name, method, overrides, outcome});
    }
  },
};

const LOCAL_STORAGE_SLOT = '_web3w_previous_wallet_type';
function recordSelection(type: string) {
  localStorage.setItem(LOCAL_STORAGE_SLOT, type);
}

function fetchPreviousSelection() {
  return localStorage.getItem(LOCAL_STORAGE_SLOT);
}

async function setupChain(address: string) {
  if (_ethersProvider === undefined) {
    const error = {
      code: CHAIN_NO_PROVIDER,
      message: `no provider setup yet`,
    };
    set(chainStore, {
      error,
      loading: false,
      state: 'Idle',
    });
    throw new Error(error.message);
  }
  set(chainStore, {loading: true});
  const contractsToAdd: {[name: string]: Contract} = {};
  const addresses: {[name: string]: string} = {};
  let contractsInfos: ContractsInfos = {};
  const {chainId: chainIdAsNumber} = await _ethersProvider.getNetwork();
  const chainId = String(chainIdAsNumber);
  let chainConfigs = _chainConfigs;
  if (typeof chainConfigs === 'function') {
    chainConfigs = await chainConfigs(chainId);
  }
  if (chainConfigs) {
    if (chainConfigs.chainId) {
      const chainConfig = chainConfigs as ChainConfig;
      if (chainId === chainConfig.chainId || chainId == toDecimal(chainConfig.chainId)) {
        contractsInfos = chainConfig.contracts;
      } else {
        const error = {
          code: CHAIN_CONFIG_NOT_AVAILABLE,
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
    } else {
      const multichainConfigs = chainConfigs as MultiChainConfigs;
      const chainConfig = multichainConfigs[chainId] || multichainConfigs[toHex(chainId)];
      if (!chainConfig) {
        const error = {code: CHAIN_CONFIG_NOT_AVAILABLE, message: `chainConfig not available for ${chainId}`};
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
      const contractInfo = contractsInfos[contractName];
      if (contractInfo.abi) {
        contractsToAdd[contractName] = proxyContract(
          new Contract(contractInfo.address, contractInfo.abi, _ethersProvider.getSigner(address)),
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
    contracts: contractsToAdd,
  }); // TODO None ?
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function select(type: string, moduleConfig?: any) {
  if ($wallet.selected && ($wallet.state === 'Ready' || $wallet.state === 'Locked')) {
    await logout();
  }

  let typeOrModule: string | Module = type;

  if (!typeOrModule) {
    if (_options.length === 0) {
      typeOrModule = 'builtin';
    } else if (_options.length === 1) {
      typeOrModule = _options[0];
    } else {
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
  _ethersProvider = undefined;
  _web3Provider = undefined;
  if (typeOrModule === 'builtin') {
    _currentModule = undefined;
    await probeBuiltin(); // TODO try catch ?
    _ethersProvider = _builtinEthersProvider;
    _web3Provider = _builtinWeb3Provider;
  } else {
    let module: Module | undefined;
    if (typeof typeOrModule === 'string') {
      if (_options) {
        for (const choice of _options) {
          if (typeof choice !== 'string' && choice.id === type) {
            module = choice;
          }
        }
      }
    } else {
      module = typeOrModule;
      type = module.id;
    }

    if (!module) {
      const message = `no module found ${type}`;
      set(walletStore, {
        error: {message, code: 1},
        selected: undefined,
        loading: false,
      }); // TODO code
      throw new Error(message);
    }

    try {
      const {web3Provider} = await module.setup(moduleConfig); // TODO pass config in select to choose network
      _web3Provider = web3Provider;
      _ethersProvider = proxyWeb3Provider(new Web3Provider(_web3Provider), _observers);
      _currentModule = module;
    } catch (e) {
      if (e.message === 'USER_CANCELED') {
        set(walletStore, {loading: false, selected: undefined});
      } else {
        set(walletStore, {
          error: {code: MODULE_ERROR, message: e.message},
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
    await setupChain(address);
  } else {
    set(walletStore, {
      address: undefined,
      state: 'Locked',
      loading: undefined,
    });
  }
}

let probing: Promise<void> | undefined;
function probeBuiltin() {
  if (probing) {
    return probing;
  }
  probing = new Promise(async (resolve, reject) => {
    if ($builtin.state === 'Ready') {
      return resolve();
    }
    set(builtinStore, {loading: true});
    try {
      const ethereum = await fetchEthereum();
      if (ethereum) {
        _builtinWeb3Provider = ethereum;
        _builtinEthersProvider = proxyWeb3Provider(new Web3Provider(ethereum), _observers);
        set(builtinStore, {
          state: 'Ready',
          vendor: getVendor(ethereum),
          available: true,
          loading: undefined,
        });
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

async function connect(type: string, moduleConfig?: unknown) {
  await select(type, moduleConfig);
  if ($wallet.state === 'Locked') {
    return unlock();
  }
  return true;
}

function acknowledgeError(field: string) {
  if (!field) {
    // TODO think more
  } else if (field === 'builtin') {
    // TODO
  }
  // TODO other:
  logout();
}

async function logout() {
  stopListeningForChanges();
  stopListeningForConnection();
  if (_currentModule) {
    await _currentModule.logout();
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
}

let unlocking: Promise<boolean> | undefined;
function unlock() {
  if (unlocking) {
    return unlocking;
  }
  let resolved = false;
  const p = new Promise<boolean>(async (resolve, reject) => {
    // TODO Unlocking to retry // TODO add timeout
    if ($wallet.state === 'Locked') {
      set(walletStore, {unlocking: true});
      let accounts;
      try {
        accounts = await _ethersProvider?.send('eth_requestAccounts', []);
        accounts = accounts || [];
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
        unlocking = undefined;
        resolved = true;
        return resolve(false);
      }
      unlocking = undefined;
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
export default (
  config: Web3wConfig
): {
  transactions: Readable<TransactionRecord[]>;
  balance: Readable<BalanceData>;
  chain: Readable<ChainData>;
  builtin: Readable<BuiltinData> & {
    probe: () => Promise<void>;
  };
  wallet: Readable<WalletData> & {
    connect: typeof connect;
    unlock: typeof unlock;
    acknowledgeError: typeof acknowledgeError;
    logout: typeof logout;
    readonly address: string | undefined;
    readonly provider: JsonRpcProvider | undefined;
    readonly web3Provider: WindowWeb3Provider | undefined;
    readonly chain: ChainData;
    readonly contracts: Contracts | undefined;
    readonly balance: BigNumber | undefined;
  };
} => {
  config = {...(config || {})};
  config.builtin = config.builtin || {autoProbe: false};
  const {debug, chainConfigs, builtin} = config;

  _chainConfigs = chainConfigs;
  if (debug && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$wallet = $wallet;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$transactions = $transactions;
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
      // get fallBackProvider() {
      //   return _fallBackProvider;
      // }
    },
  };
};
