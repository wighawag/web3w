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
import {CHAIN_NO_PROVIDER, CHAIN_CONFIG_NOT_AVAILABLE, MODULE_ERROR, CHAIN_ID_FAILED, CHAIN_ID_NOT_SET} from './errors';

const console = logs('web3w:index');

type ErrorData = {code: number; message: string};

type BaseData = {
  error?: ErrorData;
};

export type BalanceData = BaseData & {
  fetching: boolean;
  state: 'Idle' | 'Ready';
  stale?: boolean;
  amount?: BigNumber;
  blockNumber?: number;
};

export type BuiltinData = BaseData & {
  probing: boolean;
  state: 'Idle' | 'Ready';
  available?: boolean;
  vendor?: string;
};

type Contracts = {[name: string]: Contract};

export type ChainData = BaseData & {
  connecting: boolean;
  loadingData: boolean;
  state: 'Idle' | 'Connected' | 'Ready';
  chainId?: string;
  addresses?: {[name: string]: string};
  contracts?: Contracts;
  notSupported?: boolean;
};

export type FlowData = BaseData & {
  inProgress: boolean;
  executing: boolean;
  executionError: unknown | undefined;
};

export type WalletData = BaseData & {
  state: 'Idle' | 'Locked' | 'Ready';
  connecting: boolean;
  disconnecting: boolean;
  loadingModule: boolean;
  unlocking: boolean;
  address?: string;
  options: string[]; // wallet Types available
  selected?: string;
  pendingUserConfirmation?: string[];
};

export type WalletStore = Readable<WalletData> & {
  connect: typeof connect;
  unlock: typeof unlock;
  acknowledgeError: () => void;
  disconnect: typeof disconnect;
  readonly options: string[];
  readonly address: string | undefined;
  readonly provider: JsonRpcProvider | undefined;
  readonly web3Provider: WindowWeb3Provider | undefined;
  readonly chain: ChainData;
  readonly contracts: Contracts | undefined;
  readonly balance: BigNumber | undefined;
};

export type FlowStore = Readable<FlowData> & {
  execute(func?: (contracts: Contracts) => Promise<void>): Promise<Contracts>;
  connect(type?: string, moduleConfig?: unknown): Promise<Contracts>;
  retry(): Promise<void>;
  cancel(): void;
};

export type BuiltinStore = Readable<BuiltinData> & {
  probe: () => Promise<WindowWeb3Provider>;
  acknowledgeError: () => void;
};

export type ChainStore = Readable<ChainData> & {
  // TODO connect ?
  acknowledgeError: () => void;
};
export type BalanceStore = Readable<BalanceData> & {
  acknowledgeError: () => void;
};
export type TransactionStore = Readable<TransactionRecord[]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Abi = any[];

type WritableWithData<T> = Writable<T> & {data: T};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | unknown;
}
export type WindowWeb3Provider = ExternalProvider & {
  sendAsync?(
    request: {method: string; params?: unknown[]},
    callback: (error: unknown, result: {jsonrpc: '2.0'; error?: unknown; result?: unknown}) => void
  ): void;
  send?(...args: unknown[]): unknown;
  request?(args: RequestArguments): Promise<unknown>;
  on?(event: string, callback: AnyFunction): void;
  removeListener?(event: string, callback: AnyFunction): void;
};

export type Web3WModuleLoader = {
  id: string;
  load(): Promise<Web3WModule>;
};

export type Web3WModule = {
  id: string;
  setup(options?: unknown): Promise<{chainId: string; web3Provider: WindowWeb3Provider}>;
  logout(): Promise<void>;
  disconnect(): void;
};

type ModuleOptions = (string | Web3WModule | Web3WModuleLoader)[]; //TODO
type ContractsInfos = {[name: string]: {address: string; abi: Abi}};
export type ChainConfig = {
  chainId: string;
  name?: string;
  contracts: ContractsInfos;
};

export type MultiChainConfigs = {[chainId: string]: ChainConfig};

export type ChainConfigs =
  | MultiChainConfigs
  | ChainConfig
  | ((chainId: string) => Promise<ChainConfig | MultiChainConfigs>);

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
  flow?: {autoSelect?: boolean; autoUnlock?: boolean};
  debug?: boolean;
  chainConfigs: ChainConfigs;
  options?: ModuleOptions;
  autoSelectPrevious?: boolean;
};

const isBrowser = typeof window != 'undefined';

const $builtin: BuiltinData = {
  state: 'Idle', // Idle | Ready
  probing: false,
  available: undefined,
  error: undefined,
  vendor: undefined,
};

const $balance: BalanceData = {
  state: 'Idle',
  fetching: false,
  stale: undefined,
  amount: undefined,
  error: undefined,
  blockNumber: undefined,
};

const $chain: ChainData = {
  state: 'Idle', // Idle | Connected | Ready
  connecting: false,
  loadingData: false,
  contracts: undefined,
  error: undefined,
};

interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

const $wallet: WalletData = {
  state: 'Idle', // Idle | Locked | Ready
  connecting: false,
  disconnecting: false,
  loadingModule: false,
  unlocking: false,
  address: undefined,
  options: ['builtin'],
  selected: undefined,
  pendingUserConfirmation: undefined, // [] array of type of request
  error: undefined,
};

const $flow: FlowData = {
  inProgress: false,
  executing: false,
  executionError: undefined,
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
const flowStore = store($flow);

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
let _builtinWeb3Provider: WindowWeb3Provider | undefined;
let _chainConfigs: ChainConfigs;
let _currentModule: Web3WModule | undefined;
let _options: ModuleOptions;
let _config: Web3wConfig;

let _flowPromise: Promise<Contracts> | undefined;
let _flowResolve: ((val: Contracts) => void) | undefined;
let _flowReject: ((err: ErrorData) => void) | undefined;
let _call: ((contracts: Contracts) => Promise<void>) | undefined;

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
  if ($wallet.address) {
    console.log('LOAD_CHAIN from chainChanged');
    await loadChain(chainIdAsDecimal, $wallet.address, true);
  }
}

function hasAccountsChanged(accounts: string[]): boolean {
  return accounts[0] !== $wallet.address;
  // TODO multi account support ?
}

async function onAccountsChanged(accounts: string[]) {
  if (!hasAccountsChanged(accounts)) {
    console.debug('false account changed', accounts);
    return;
  }
  console.debug('onAccountsChanged', {accounts}); // TODO
  const address = accounts[0];
  if (address) {
    set(walletStore, {address, state: 'Ready'});
    if ($chain.state === 'Connected') {
      if ($chain.chainId) {
        console.log('LOAD_CHAIN from accountsChanged');
        await loadChain($chain.chainId, address, false);
      } else {
        throw new Error('no chainId while connected');
      }
    } else {
      reAssignContracts(address);
    }
  } else {
    set(walletStore, {address, state: 'Locked'});
    reAssignContracts(address);
  }
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
    let accounts: string[] = [];
    try {
      accounts = await providerSend(web3Provider, 'eth_accounts');
    } catch (e) {}

    console.debug({accounts}); // TODO remove
    if (_listenning && hasAccountsChanged(accounts)) {
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

function listenForChanges() {
  if (_web3Provider && !_listenning) {
    console.log('LISTENNING');
    if (_web3Provider.on) {
      _web3Provider.on('chainChanged', onChainChanged);
      _web3Provider.on('accountsChanged', onAccountsChanged);
      // still poll has accountsChanged does not seem to be triggered all the time (metamask bug?)
      pollAccountsChanged(_web3Provider, onAccountsChanged);
    } else {
      // TODO handle race condition : should not double poll
      pollChainChanged(_web3Provider, onChainChanged);
      pollAccountsChanged(_web3Provider, onAccountsChanged);
    }
    _listenning = true;
  }
}

function stopListeningForChanges() {
  if (_web3Provider && _listenning) {
    console.log('STOP LISTENNING');
    console.debug('stop listenning for changes...');
    _web3Provider.removeListener && _web3Provider.removeListener('chainChanged', onChainChanged);
    _web3Provider.removeListener && _web3Provider.removeListener('accountsChanged', onAccountsChanged);
    _listenning = false;
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

async function setupChain(address: string, newProviderRequired: boolean) {
  const ethersProvider = ensureEthersProvider(newProviderRequired);
  let chainId;
  if ($chain.state === 'Idle') {
    set(chainStore, {connecting: true});
    let chainIdAsNumber;
    try {
      const netResult = await ethersProvider.getNetwork();
      chainIdAsNumber = netResult.chainId;
    } catch (e) {
      const error = {
        code: CHAIN_ID_FAILED,
        message: `Failed to fetch chainId`,
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
    chainId = String(chainIdAsNumber);
    set(chainStore, {
      chainId,
      connecting: false,
      loadingData: false,
      contracts: undefined,
      addresses: undefined,
      state: 'Connected',
    });
  } else {
    chainId = $chain.chainId;
  }
  if (!chainId) {
    const error = {
      code: CHAIN_ID_NOT_SET,
      message: `chainId is not set even though chain is connected`,
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

  console.log('LOAD_CHAIN from setupChain');
  await loadChain(chainId, address, newProviderRequired);
}

async function loadChain(chainId: string, address: string, newProviderRequired: boolean): Promise<void> {
  const ethersProvider = ensureEthersProvider(newProviderRequired);
  set(chainStore, {loadingData: true});
  const contractsToAdd: {[name: string]: Contract} = {};
  const addresses: {[name: string]: string} = {};
  let contractsInfos: ContractsInfos = {};
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
          connecting: false,
          loadingData: false,
          state: 'Connected',
        });
        throw new Error(error.message); // TODO remove ?
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
          connecting: false,
          loadingData: false,
          state: 'Connected',
        });
        throw new Error(error.message); // TODO remove ?
      } else {
        contractsInfos = chainConfig.contracts;
      }
    }
    for (const contractName of Object.keys(contractsInfos)) {
      const contractInfo = contractsInfos[contractName];
      if (contractInfo.abi) {
        contractsToAdd[contractName] = proxyContract(
          new Contract(contractInfo.address, contractInfo.abi, ethersProvider.getSigner(address)),
          contractName,
          _observers
        );
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

  if ($wallet.state === 'Ready') {
    console.log('READY');
    // Do not retry automatically if executionError or if already executing
    if (_flowResolve && $flow.executionError === undefined && !$flow.executing) {
      console.log(' => executing...');
      const oldFlowResolve = _flowResolve;
      if (_call) {
        let result;
        try {
          console.log('executing after chain Setup');
          result = _call(contractsToAdd); // TODO try catch ?
        } catch (e) {
          set(flowStore, {executionError: e, executing: false});
          return;
        }
        if ('then' in result) {
          set(flowStore, {error: undefined, executionError: undefined, executing: true});
          result
            .then(() => {
              set(flowStore, {inProgress: false, error: undefined, executionError: undefined, executing: false});
              oldFlowResolve(contractsToAdd);
              _flowPromise = undefined;
              _flowReject = undefined;
              _flowResolve = undefined;
            })
            .catch((err) => {
              set(flowStore, {executionError: err, executing: false});
            });
        } else {
          set(flowStore, {inProgress: false, error: undefined, executionError: undefined, executing: false});
          _flowResolve(contractsToAdd);
        }
      } else {
        set(flowStore, {inProgress: false, error: undefined, executionError: undefined, executing: false});
        _flowResolve(contractsToAdd);
      }
    }
  }
}

function ensureEthersProvider(newProviderRequired: boolean): JsonRpcProvider {
  if (_ethersProvider === undefined || _web3Provider === undefined) {
    const error = {
      code: CHAIN_NO_PROVIDER,
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
  } else {
    if (newProviderRequired) {
      _ethersProvider = proxyWeb3Provider(new Web3Provider(_web3Provider), _observers);
    }
  }
  return _ethersProvider;
}

function reAssignContracts(address: string) {
  const ethersProvider = ensureEthersProvider(false);
  const contracts = $chain.contracts;
  if (!contracts) {
    return;
  }
  for (const contractName of Object.keys(contracts)) {
    contracts[contractName] = contracts[contractName].connect(
      address ? ethersProvider.getSigner(address) : ethersProvider
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function select(type: string, moduleConfig?: any) {
  if ($wallet.selected && ($wallet.state === 'Ready' || $wallet.state === 'Locked')) {
    await disconnect();
  }

  let typeOrModule: string | Web3WModule | Web3WModuleLoader = type;

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
    connecting: true,
    selected: type,
    state: 'Idle',
    error: undefined,
  });
  _ethersProvider = undefined;
  _web3Provider = undefined;
  if (typeOrModule === 'builtin') {
    _currentModule = undefined;
    const builtinWeb3Provider = await probeBuiltin(); // TODO try catch ?
    _web3Provider = builtinWeb3Provider;
    _ethersProvider = proxyWeb3Provider(new Web3Provider(builtinWeb3Provider), _observers);
  } else {
    let module: Web3WModule | Web3WModuleLoader | undefined;
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
        connecting: false,
      }); // TODO code
      throw new Error(message);
    }

    try {
      if ('load' in module) {
        // if (module.loaded) {
        //   module = module.loaded;
        // } else {
        set(walletStore, {loadingModule: true});
        module = await module.load();
        set(walletStore, {loadingModule: false});
        // }
      }
      const {web3Provider} = await module.setup(moduleConfig); // TODO pass config in select to choose network
      _web3Provider = web3Provider;
      _ethersProvider = proxyWeb3Provider(new Web3Provider(_web3Provider), _observers);
      _currentModule = module;
    } catch (e) {
      if (e.message === 'USER_CANCELED') {
        set(walletStore, {connecting: false, selected: undefined, loadingModule: false});
      } else {
        set(walletStore, {
          error: {code: MODULE_ERROR, message: e.message},
          selected: undefined,
          connecting: false,
          loadingModule: false,
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
      connecting: false,
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
      accounts = await _ethersProvider.listAccounts();
    }
  } catch (e) {
    set(walletStore, {error: e, selected: undefined, connecting: false});
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
    console.log('SETUP_CHAIN from select');
    await setupChain(address, false);
  } else {
    listenForChanges();
    set(walletStore, {
      address: undefined,
      state: 'Locked',
      connecting: undefined,
    });
  }
}

let probing: Promise<WindowWeb3Provider> | undefined;
function probeBuiltin() {
  if (probing) {
    return probing;
  }
  probing = new Promise(async (resolve, reject) => {
    if ($builtin.state === 'Ready') {
      return resolve();
    }
    set(builtinStore, {probing: true});
    try {
      const ethereum = await fetchEthereum();
      if (ethereum) {
        ethereum.autoRefreshOnNetworkChange = false;
        _builtinWeb3Provider = ethereum;
        set(builtinStore, {
          state: 'Ready',
          vendor: getVendor(ethereum),
          available: true,
          probing: false,
        });
      } else {
        set(builtinStore, {
          state: 'Ready',
          vendor: undefined,
          available: false,
          probing: false,
        });
      }
    } catch (e) {
      set(builtinStore, {
        error: e.message || e,
        vendor: undefined,
        available: undefined,
        probing: false,
      });
      return reject(e);
    }
    resolve(_builtinWeb3Provider);
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

function acknowledgeError<T extends BaseData>(store: WritableWithData<T>): () => void {
  return () => {
    // For some reason typescript type checking in vscode fails here :
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set<T>(store, {error: undefined} as any);
  };
}

function _disconnect(keepFlow?: boolean) {
  stopListeningForChanges();
  stopListeningForConnection();
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
    addresses: undefined,
    state: 'Idle',
    notSupported: undefined,
    chainId: undefined,
    error: undefined,
  });
  if (!keepFlow) {
    set(flowStore, {
      error: undefined,
      executing: false,
      executionError: undefined,
      inProgress: false,
    });
  }
  _call = undefined;
  _flowReject = undefined;
  _flowResolve = undefined;
  _flowPromise = undefined;
  recordSelection('');
}

function disconnect(config?: {logout: boolean; wait: boolean; keepFlow: boolean}): Promise<void> {
  if ($wallet.disconnecting) {
    throw new Error(`already disconnecting`);
  }
  const logout = config && config.logout;
  const wait = config && config.wait;
  const keepFlow = config && config.keepFlow;
  return new Promise<void>((resolve, reject) => {
    if (_currentModule) {
      if (logout) {
        let p;
        try {
          p = _currentModule.logout();
        } catch (e) {
          reject(e);
        }
        if (wait && p && 'then' in p) {
          set(walletStore, {disconnecting: true});
          p.then(() => {
            _currentModule && _currentModule.disconnect();
            _currentModule = undefined;
            _disconnect(keepFlow);
            set(walletStore, {disconnecting: false});
            resolve();
          }).catch((e) => {
            set(walletStore, {disconnecting: false, error: e});
            reject(e);
          });
        } else {
          _currentModule.disconnect();
          _currentModule = undefined;
          _disconnect(keepFlow);
          resolve();
        }
      } else {
        _currentModule.disconnect();
        _currentModule = undefined;
        _disconnect(keepFlow);
        resolve();
      }
    } else {
      _disconnect(keepFlow);
      resolve();
    }
  });
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
        console.log('SETUP_CHAIN from unlock');
        await setupChain(address, true); // TODO try catch ?
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

function flow_retry(): Promise<void> {
  console.log('RETRYING...');
  if ($chain.state === 'Ready' && $wallet.state === 'Ready') {
    if (!$chain.contracts) {
      return Promise.reject('contracts not set');
    } else {
      const contracts = $chain.contracts;
      if (_call) {
        let result;
        try {
          console.log('EXECUTING RETRY');
          result = _call(contracts); // TODO try catch ?
        } catch (e) {
          set(flowStore, {executionError: e, executing: false});
          return Promise.reject(e);
        }
        if ('then' in result) {
          set(flowStore, {executing: true});
          return result
            .then(() => {
              _call = undefined;
              set(flowStore, {inProgress: false, error: undefined, executionError: undefined, executing: false});
              return _flowResolve && _flowResolve(contracts);
            })
            .catch((err) => {
              set(flowStore, {executionError: err, executing: false});
              return Promise.reject(err);
            });
        }
      }
      _flowResolve && _flowResolve(contracts);
      return Promise.resolve();
    }
  }
  if ($wallet.state === 'Locked') {
    if (_config.flow && _config.flow.autoUnlock) {
      unlock().catch((error) => {
        set(flowStore, {error});
        // _flowReject && _flowReject(error);
        // _flowPromise = undefined;
        // _flowReject = undefined;
        // _flowResolve = undefined;
      });
    }
  } else if ($wallet.state === 'Idle' && $wallet.options.length === 1) {
    if (_config.flow && _config.flow.autoSelect) {
      connect($wallet.options[0]).catch((error) => {
        set(flowStore, {error});
        // _flowReject && _flowReject(error);
        // _flowPromise = undefined;
        // _flowReject = undefined;
        // _flowResolve = undefined;
      });
    }
  }
  if (!_flowPromise) {
    return Promise.resolve();
  }
  return _flowPromise.then(() => undefined);
}

function flow_connect(type?: string, moduleConfig?: unknown): Promise<Contracts> {
  if ($flow.inProgress) {
    flow_cancel();
  }
  return flow(undefined, type, moduleConfig);
}

function flow_execute(func?: (contracts: Contracts) => Promise<void>): Promise<Contracts> {
  return flow(func);
}

function flow(
  func?: (contracts: Contracts) => Promise<void>,
  type?: string,
  moduleConfig?: unknown
): Promise<Contracts> {
  if ($flow.inProgress) {
    throw new Error(`flow in progress`);
  }
  if ($chain.state === 'Ready' && $wallet.state === 'Ready' && (!type || type === $wallet.selected)) {
    _flowReject = undefined;
    _flowResolve = undefined;
    _flowPromise = undefined;
    if (!$chain.contracts) {
      return Promise.reject('contracts not set');
    } else {
      const contracts = $chain.contracts;
      if (func) {
        let result;
        try {
          console.log('EXECUTING DIRECT');
          result = func(contracts); // TODO try catch ?
        } catch (e) {
          set(flowStore, {executionError: e, executing: false});
          return Promise.reject(e);
        }
        if ('then' in result) {
          _call = func;
          set(flowStore, {inProgress: true, error: undefined, executing: true});
          return result
            .then(() => {
              _call = undefined;
              set(flowStore, {inProgress: false, error: undefined, executionError: undefined});
              return contracts;
            })
            .catch((err) => {
              set(flowStore, {executionError: err, executing: false});
              return Promise.reject(err);
            });
        }
      }
      return Promise.resolve(contracts);
    }
  }
  if (_flowPromise) {
    return _flowPromise;
  }
  _call = func;
  set(flowStore, {inProgress: true, executing: false, executionError: undefined, error: undefined});

  _flowPromise = new Promise((resolve, reject) => {
    _flowResolve = resolve;
    _flowReject = reject;
  });

  if (type && type !== $wallet.selected) {
    disconnect()
      .catch((error) => {
        set(flowStore, {error});
        // _flowReject && _flowReject(error);
        // _flowPromise = undefined;
        // _flowReject = undefined;
        // _flowResolve = undefined;
      })
      .then(() => {
        connect(type, moduleConfig).catch((error) => {
          set(flowStore, {error});
          // _flowReject && _flowReject(error);
          // _flowPromise = undefined;
          // _flowReject = undefined;
          // _flowResolve = undefined;
        });
      });
  } else if ($wallet.state === 'Locked') {
    if (_config.flow && _config.flow.autoUnlock) {
      unlock().catch((error) => {
        set(flowStore, {error});
        // _flowReject && _flowReject(error);
        // _flowPromise = undefined;
        // _flowReject = undefined;
        // _flowResolve = undefined;
      });
    }
  } else if ($wallet.state === 'Idle' && $wallet.options.length === 1) {
    if (_config.flow && _config.flow.autoSelect) {
      connect($wallet.options[0]).catch((error) => {
        set(flowStore, {error});
        // _flowReject && _flowReject(error);
        // _flowPromise = undefined;
        // _flowReject = undefined;
        // _flowResolve = undefined;
      });
    }
  }

  return _flowPromise;
}

function flow_cancel() {
  if (_flowReject) {
    _flowReject({code: 1, message: 'Cancel'});
  }
  _flowPromise = undefined;
  _flowReject = undefined;
  _flowResolve = undefined;
  _call = undefined;
  set(flowStore, {inProgress: false, error: undefined, executionError: undefined, executing: false});
}

// /////////////////////////////////////////////////////////////////////////////////
export default (
  config: Web3wConfig
): {
  transactions: TransactionStore;
  balance: BalanceStore;
  chain: ChainStore;
  builtin: BuiltinStore;
  wallet: WalletStore;
  flow: FlowStore;
} => {
  config = {...(config || {})};
  if (!config.options || config.options.length === 0) {
    config.options = ['builtin'];
  }
  config.builtin = config.builtin || {autoProbe: false};
  config.flow = config.flow || {autoSelect: false, autoUnlock: false};
  const {debug, chainConfigs, builtin} = config;
  _config = config;

  _chainConfigs = chainConfigs;
  if (debug && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$wallet = $wallet;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$transactions = $transactions;
  }

  _options = config.options;
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
      acknowledgeError: acknowledgeError(balanceStore),
    },
    chain: {
      subscribe: chainStore.subscribe,
      acknowledgeError: acknowledgeError(chainStore),
    },
    builtin: {
      subscribe: builtinStore.subscribe,
      acknowledgeError: acknowledgeError(builtinStore),
      probe: probeBuiltin,
    },
    wallet: {
      subscribe: walletStore.subscribe,
      connect,
      unlock,
      acknowledgeError: acknowledgeError(walletStore),
      disconnect,
      get options() {
        return $wallet.options;
      },
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
    flow: {
      subscribe: flowStore.subscribe,
      execute: flow_execute,
      retry: flow_retry,
      cancel: flow_cancel,
      connect: flow_connect,
    },
  };
};
