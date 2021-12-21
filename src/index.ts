import {Contract} from '@ethersproject/contracts';
import {Web3Provider, JsonRpcProvider, ExternalProvider, Provider, TransactionReceipt} from '@ethersproject/providers';
import {Interface, LogDescription} from '@ethersproject/abi';
import {BigNumber} from '@ethersproject/bignumber';
import {writable} from './utils/store';
import {fetchEthereum, getVendor} from './utils/builtin';
import {timeout} from './utils';
import {
  ContractTransaction,
  ContractTransactionSent,
  proxyContract,
  proxyWeb3Provider,
  SignatureRequest,
  SignatureResponse,
  Transaction,
  TransactionSent,
} from './utils/ethers';
import type {EventsABI} from './utils/ethers';
import {Writable, Readable} from './utils/internals';
import {logs} from 'named-logs';
import {
  CHAIN_NO_PROVIDER,
  CHAIN_CONFIG_NOT_AVAILABLE,
  MODULE_ERROR,
  CHAIN_ID_FAILED,
  CHAIN_ID_NOT_SET,
  CHAIN_NOT_AVAILABLE_ON_WALLET,
} from './errors';

const logger = logs('web3w:index');

type ErrorData = {code: number; message: string; errorObject?: unknown};

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
  genesisChanged?: boolean;
};

export type FallbackData = BaseData & {
  connecting: boolean;
  loadingData: boolean;
  state: 'Idle' | 'Connected' | 'Ready';
  chainId?: string;
  addresses?: {[name: string]: string};
  contracts?: Contracts;
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
  readonly fallbackProvider: Provider | undefined;
  readonly web3Provider: WindowWeb3Provider | undefined;
  readonly chain: ChainData;
  readonly contracts: Contracts | undefined;
  readonly balance: BigNumber | undefined;
  readonly selected: string | undefined;
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
  readonly vendor: string | undefined;
};

export type ChainStore = Readable<ChainData> & {
  // TODO connect ?
  acknowledgeError: () => void;
  acknowledgeNewGenesisHash: () => void;
  readonly contracts: Contracts | undefined;
  updateContracts<ContractTypes extends ContractsInfos = ContractsInfos>(
    chainConfigs: MultiChainConfigs<ContractTypes> | ChainConfig<ContractTypes>
  ): Promise<void>;
  switchChain(
    chainId: string,
    config?: {
      rpcUrls?: string[];
      blockExplorerUrls?: string[];
      chainName?: string;
      iconUrls?: string[];
      nativeCurrency?: {
        name: string;
        symbol: string;
        decimals: number;
      };
    }
  ): Promise<void>;
};
export type FallbackStore = Readable<FallbackData> & {
  readonly contracts: Contracts | undefined;
  readonly state: 'Idle' | 'Connected' | 'Ready';
  readonly provider: Provider | undefined;
};
export type BalanceStore = Readable<BalanceData> & {
  acknowledgeError: () => void;
};
export type TransactionStore = Readable<TransactionRecord[]> & {
  acknowledge: (hash: string, status: TransactionStatus) => void;
};

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

type ModuleOptions = (string | Web3WModule | Web3WModuleLoader)[];
type ContractsInfos = {[name: string]: {address: string; abi: Abi}};
export type ChainConfig<ContractTypes extends ContractsInfos = ContractsInfos> = {
  chainId: string;
  name?: string;
  contracts: ContractTypes;
};

export type MultiChainConfigs<ContractTypes extends ContractsInfos = ContractsInfos> = {
  [chainId: string]: ChainConfig<ContractTypes>;
};

export type ChainConfigs<ContractTypes extends ContractsInfos = ContractsInfos> =
  | MultiChainConfigs<ContractTypes>
  | ChainConfig<ContractTypes>
  | ((chainId: string) => Promise<ChainConfig<ContractTypes> | MultiChainConfigs<ContractTypes>>);

type BuiltinConfig = {
  autoProbe: boolean;
};

export type TransactionStatus = 'pending' | 'cancelled' | 'success' | 'failure' | 'mined';

export type ParsedEvent = {args: Record<string, unknown>; name: string; signature: string};

export type TransactionRecord = {
  hash: string;
  from: string;
  submissionBlockTime: number;
  acknowledged: boolean;
  status: TransactionStatus;
  nonce: number;
  confirmations: number;
  finalized: boolean;
  lastAcknowledgment?: TransactionStatus;
  to?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  data?: string;
  value?: string;
  contractName?: string;
  method?: string;
  args?: unknown[];
  eventsABI?: EventsABI;
  metadata?: unknown;
  lastCheck?: number;
  blockHash?: string;
  blockNumber?: number;
  events?: ParsedEvent[];
};

export type Web3wConfig<ContractTypes extends ContractsInfos = ContractsInfos> = {
  builtin?: BuiltinConfig;
  flow?: {autoSelect?: boolean; autoUnlock?: boolean};
  debug?: boolean;
  chainConfigs?: ChainConfigs<ContractTypes>;
  options?: ModuleOptions;
  autoSelectPrevious?: boolean;
  localStoragePrefix?: string;
  transactions?: {
    waitForTransactionDetails?: boolean;
    autoDelete?: boolean;
    finality?: number;
    pollingPeriod?: number;
  };
  fallbackNode?: string | Provider;
  checkGenesis?: boolean;
};

type ResolvedWeb3WConfig<ContractTypes extends ContractsInfos = ContractsInfos> = {
  builtin: BuiltinConfig;
  flow: {autoSelect: boolean; autoUnlock: boolean};
  debug: boolean;
  chainConfigs?: ChainConfigs<ContractTypes>;
  options: ModuleOptions;
  autoSelectPrevious: boolean;
  localStoragePrefix: string;
  transactions: {
    waitForTransactionDetails: boolean;
    autoDelete: boolean;
    finality: number;
    pollingPeriod: number;
  };
  checkGenesis: boolean;
  fallbackNode?: string | Provider;
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

const $fallback: FallbackData = {
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
const fallbackStore = store($fallback);
const balanceStore = store($balance);
const flowStore = store($flow);

let LOCAL_STORAGE_TRANSACTIONS_SLOT = '_web3w_transactions';
let LOCAL_STORAGE_PREVIOUS_WALLET_SLOT = '_web3w_previous_wallet_type';

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
    logger.debug(JSON.stringify(store.data, null, '  '));
  } catch (e) {
    logger.error(e, store.data);
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
let _fallbackProvider: Provider | undefined;
let _web3Provider: WindowWeb3Provider | undefined;
let _builtinWeb3Provider: WindowWeb3Provider | undefined;
let _chainConfigs: ChainConfigs | undefined;
let _currentModule: Web3WModule | undefined;
let _options: ModuleOptions;
let _config: ResolvedWeb3WConfig;

let _flowPromise: Promise<Contracts> | undefined;
let _flowResolve: ((val: Contracts) => void) | undefined;
let _flowReject: ((err: ErrorData) => void) | undefined;
let _call: ((contracts: Contracts) => Promise<void>) | undefined;

const genesisHashes: {[chainId: string]: string} = {};

async function checkGenesis(ethersProvider: JsonRpcProvider, chainId: string): Promise<boolean | undefined> {
  let networkChanged = undefined;
  if (typeof window !== 'undefined') {
    try {
      const lkey = `_genesis_${chainId}`;
      const genesisBlock = await ethersProvider.getBlock('earliest');
      genesisHashes[chainId] = genesisBlock.hash;
      const lastHash = localStorage.getItem(lkey);
      if (lastHash !== genesisBlock.hash) {
        if (lastHash) {
          networkChanged = true;
        } else {
          networkChanged = false;
          localStorage.setItem(lkey, genesisBlock.hash);
        }
      } else {
        networkChanged = false;
      }
    } catch {
      // ignore
    }
  }
  return networkChanged;
}

async function switchChain(
  chainId: string,
  config?: {
    rpcUrls?: string[];
    blockExplorerUrls?: string[];
    chainName?: string;
    iconUrls?: string[];
    nativeCurrency?: {
      name: string;
      symbol: string;
      decimals: number;
    };
  }
): Promise<void> {
  if (!_ethersProvider) {
    throw new Error(`no provider setup`);
  }
  try {
    // attempt to switch...
    await _ethersProvider.send('wallet_switchEthereumChain', [
      {
        chainId: '0x' + parseInt(chainId).toString(16),
      },
    ]);
  } catch (e) {
    if (e.code === 4902) {
      if (config && config.rpcUrls && config.rpcUrls.length > 0) {
        try {
          await _ethersProvider.send('wallet_addEthereumChain', [
            {
              chainId: '0x' + parseInt(chainId).toString(16),
              rpcUrls: config.rpcUrls,
              chainName: config.chainName,
              blockExplorerUrls: config.blockExplorerUrls,
              iconUrls: config.iconUrls,
              nativeCurrency: config.nativeCurrency,
            },
          ]);
        } catch (e) {
          if (e.code !== 4001) {
            set(chainStore, {
              error: e,
            });
          } else {
            return;
          }
        }
      } else {
        set(chainStore, {
          error: {code: CHAIN_NOT_AVAILABLE_ON_WALLET, message: 'Chain not available on your wallet'},
        });
      }
    } else {
      if (e.code !== 4001) {
        set(chainStore, {
          error: e,
        });
      } else {
        return;
      }
    }
  }
}

async function onChainChanged(chainId: string) {
  if (chainId === '0xNaN') {
    logger.warn('onChainChanged bug (return 0xNaN), metamask bug?');
    if (!_web3Provider) {
      throw new Error('no web3Provider to get chainId');
    }
    chainId = await providerSend(_web3Provider, 'eth_chainId');
  }
  const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
  logger.debug('onChainChanged', {chainId, chainIdAsDecimal}); // TODO
  set(chainStore, {
    contracts: undefined,
    addresses: undefined,
    state: 'Connected',
    chainId: chainIdAsDecimal,
    notSupported: undefined,
  });
  if ($wallet.address) {
    loadTransactions($wallet.address, chainIdAsDecimal);
    logger.log('LOAD_CHAIN from chainChanged');
    try {
      await loadChain(chainIdAsDecimal, $wallet.address, true);
    } catch (e) {}
  }
}

function hasAccountsChanged(accounts: string[]): boolean {
  return accounts[0] !== $wallet.address;
  // TODO multi account support ?
}

async function onAccountsChanged(accounts: string[]) {
  if (!hasAccountsChanged(accounts)) {
    logger.debug('false account changed', accounts);
    return;
  }
  logger.debug('onAccountsChanged', {accounts}); // TODO
  const address = accounts[0];
  if (address) {
    set(walletStore, {address, state: 'Ready'});
    if ($chain.chainId) {
      loadTransactions(address, $chain.chainId);
    }
    if ($chain.state === 'Connected') {
      if ($chain.chainId) {
        logger.log('LOAD_CHAIN from accountsChanged');
        try {
          await loadChain($chain.chainId, address, false);
        } catch (e) {}
      } else {
        throw new Error('no chainId while connected');
      }
    } else {
      reAssignContracts(address);
    }
  } else {
    unloadTransactions(); // TODO do not do that, keep the tx ?
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
        logger.error(e);
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

    logger.debug({accounts}); // TODO remove
    if (_listenning && hasAccountsChanged(accounts)) {
      // TODO multi account support ?
      try {
        callback(accounts);
      } catch (e) {
        logger.error(e);
        // TODO error in wallet.error
      }
    }
    await wait(3000);
  }
}

function listenForChanges() {
  if (_web3Provider && !_listenning) {
    logger.log('LISTENNING');
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
    logger.log('STOP LISTENNING');
    logger.debug('stop listenning for changes...');
    _web3Provider.removeListener && _web3Provider.removeListener('chainChanged', onChainChanged);
    _web3Provider.removeListener && _web3Provider.removeListener('accountsChanged', onAccountsChanged);
    _listenning = false;
  }
}

function onConnect(connection: {chainId: string}) {
  const chainId = connection && connection.chainId;
  if (chainId) {
    const chainIdAsDecimal = parseInt(chainId.slice(2), 16).toString();
    logger.debug('onConnect', {chainId, chainIdAsDecimal}); // TODO
  } else {
    logger.warn('onConnect', 'no connection object passed in');
  }
}

function onDisconnect(error?: ProviderRpcError) {
  logger.debug('onDisconnect', {error}); // TODO
}

function listenForConnection() {
  if (_web3Provider) {
    logger.debug('listenning for connection...');
    _web3Provider.on && _web3Provider.on('connect', onConnect);
    _web3Provider.on && _web3Provider.on('disconnect', onDisconnect);
  }
}

function stopListeningForConnection() {
  if (_web3Provider) {
    logger.debug('stop listenning for connection...');
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
  onTxRequested: (txRequest: Transaction) => {
    logger.debug('onTxRequested', {txRequest});
    requestUserAttention('transaction');
  },
  onTxCancelled: (txRequest: Transaction) => {
    logger.debug('onTxCancelled', {txRequest});
    cancelUserAttention('transaction');
  },
  onTxSent: ({
    hash,
    from,
    gasLimit,
    nonce,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    data,
    value,
    chainId,
    to,
    submissionBlockTime,
  }: TransactionSent) => {
    logger.debug('onTxSent', {hash, from, gasLimit, nonce, gasPrice, data, value, chainId, to});
    if (hash) {
      const transactionRecord: TransactionRecord = {
        hash,
        from,
        acknowledged: false,
        status: 'pending',
        to,
        nonce,
        gasLimit: gasLimit?.toString(),
        gasPrice: gasPrice?.toString(),
        maxFeePerGas: maxFeePerGas?.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
        data,
        value: value?.toString(),
        submissionBlockTime,
        confirmations: 0,
        finalized: false,
      };
      addTransaction(from, chainId, transactionRecord);
    }
    cancelUserAttention('transaction');
  },
  onSignatureRequested: (sigRequest: SignatureRequest) => {
    logger.debug('onSignatureRequested', {sigRequest});
    requestUserAttention('signature');
  },
  onSignatureCancelled: (sigRequest: SignatureRequest) => {
    logger.debug('onSignatureCancelled', {sigRequest});
    cancelUserAttention('signature');
  },
  onSignatureReceived: (sigResponse: SignatureResponse) => {
    logger.debug('onSignatureReceived', {sigResponse});
    cancelUserAttention('signature');
  },
  onContractTxRequested: ({from, contractName, method, overrides, metadata}: ContractTransaction) => {
    logger.debug('onContractTxRequest', {from, contractName, method, overrides, metadata});
  },
  onContractTxCancelled: ({from, contractName, method, overrides, metadata}: ContractTransaction) => {
    logger.debug('onContractTxCancelled', {from, contractName, method, overrides, metadata});
  },
  onContractTxSent: ({
    hash,
    from,
    contractName,
    method,
    args,
    eventsABI,
    overrides,
    metadata,
    to,
    chainId,
  }: ContractTransactionSent) => {
    logger.debug('onContractTxSent', {hash, from, contractName, method, args, eventsABI, overrides, metadata, to});
    if (hash) {
      let nonceAsNumber;
      if (overrides && overrides.nonce) {
        nonceAsNumber = parseInt(overrides.nonce.toString());
      }
      const transactionRecord = {
        hash,
        from,
        acknowledged: false,
        contractName,
        method,
        args, // TODO Transform to string ?
        eventsABI,
        metadata,
        to,
        nonce: nonceAsNumber,
        gasLimit: overrides?.gasLimit?.toString(),
        gasPrice: overrides?.gasPrice?.toString(),
        value: overrides?.value?.toString(),
      };
      updateTransaction(from, chainId, transactionRecord, false);
    }
  },
};

function recordSelection(type: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREVIOUS_WALLET_SLOT, type);
  } catch (e) {}
}

function fetchPreviousSelection() {
  try {
    return localStorage.getItem(LOCAL_STORAGE_PREVIOUS_WALLET_SLOT);
  } catch (e) {
    return null;
  }
}

let _updateContractsPromise: Promise<void>;
async function _updateContracts<ContractTypes extends ContractsInfos = ContractsInfos>(
  chainConfigs: MultiChainConfigs<ContractTypes> | ChainConfig<ContractTypes>
): Promise<void> {
  _chainConfigs = chainConfigs;
  if (_config.fallbackNode) {
    await setupFallback(_config.fallbackNode, chainConfigs);
  }
  if ($chain.chainId && $wallet.address) {
    await loadChain($chain.chainId, $wallet.address, false);
  }
}

async function updateContracts<ContractTypes extends ContractsInfos = ContractsInfos>(
  chainConfigs: MultiChainConfigs<ContractTypes> | ChainConfig<ContractTypes>
): Promise<void> {
  if (_updateContractsPromise) {
    try {
      await _updateContractsPromise;
    } catch (e) {}
  }
  _updateContractsPromise = _updateContracts(chainConfigs);
  await _updateContractsPromise;
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
      if (chainIdAsNumber === 0) {
        chainIdAsNumber = 1337;
        logger.error('giving chainId = 0, assume local 1337?');
      }
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
  loadTransactions(address, chainId); // TODO wallet address might not be available
  logger.log('LOAD_CHAIN from setupChain');
  try {
    await loadChain(chainId, address, newProviderRequired);
  } catch (e) {}
}

function getContractInfos(chainConfigs: MultiChainConfigs | ChainConfig, chainId: string): ContractsInfos {
  if (chainConfigs.chainId) {
    const chainConfig = chainConfigs as ChainConfig;
    if (chainId === chainConfig.chainId || chainId == toDecimal(chainConfig.chainId)) {
      return chainConfig.contracts;
    } else {
      const error = {
        code: CHAIN_CONFIG_NOT_AVAILABLE,
        message: `chainConfig only available for ${chainConfig.chainId}, not available for ${chainId}`,
      };
      throw error;
    }
  } else {
    const multichainConfigs = chainConfigs as MultiChainConfigs;
    const chainConfig = multichainConfigs[chainId] || multichainConfigs[toHex(chainId)];
    if (!chainConfig) {
      const error = {code: CHAIN_CONFIG_NOT_AVAILABLE, message: `chainConfig not available for ${chainId}`};
      throw error; // TODO remove ?
    } else {
      return chainConfig.contracts;
    }
  }
}

async function loadChain(chainId: string, address: string, newProviderRequired: boolean): Promise<void> {
  const ethersProvider = ensureEthersProvider(newProviderRequired);
  set(chainStore, {loadingData: true});
  const contractsToAdd: {[name: string]: Contract} = {};
  const addresses: {[name: string]: string} = {};
  let chainConfigs = _chainConfigs;

  if (_config.checkGenesis) {
    const genesisChanged = await checkGenesis(ethersProvider, chainId);
    if ($chain.genesisChanged !== genesisChanged) {
      set(chainStore, {genesisChanged});
    }
  }

  if (typeof chainConfigs === 'function') {
    chainConfigs = await chainConfigs(chainId);
  }
  if (chainConfigs) {
    let contractsInfos;
    try {
      contractsInfos = getContractInfos(chainConfigs, chainId);
    } catch (error) {
      if (error.code === CHAIN_CONFIG_NOT_AVAILABLE) {
        set(chainStore, {
          chainId,
          notSupported: true,
          connecting: false,
          loadingData: false,
          state: 'Connected',
        });
        return;
      } else {
        set(chainStore, {
          error,
          chainId,
          connecting: false,
          loadingData: false,
          state: 'Connected',
        });
        throw new Error(error.message || error);
      }
    }

    for (const contractName of Object.keys(contractsInfos)) {
      const contractInfo = contractsInfos[contractName];
      if (contractInfo.abi) {
        logger.log({contractName});
        contractsToAdd[contractName] = proxyContract(
          new Contract(
            contractInfo.address,
            contractInfo.abi,
            _config.transactions.waitForTransactionDetails
              ? ethersProvider.getSigner(address)
              : ethersProvider.getSigner(address).connectUnchecked()
          ),
          contractName,
          chainId,
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
    logger.log('READY');
    // Do not retry automatically if executionError or if already executing
    if (_flowResolve && $flow.executionError === undefined && !$flow.executing) {
      logger.log(' => executing...');
      const oldFlowResolve = _flowResolve;
      if (_call) {
        let result;
        try {
          logger.log('executing after chain Setup');
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
          _flowPromise = undefined;
          _flowReject = undefined;
          _flowResolve = undefined;
        }
      } else {
        set(flowStore, {inProgress: false, error: undefined, executionError: undefined, executing: false});
        _flowResolve(contractsToAdd);
        _flowPromise = undefined;
        _flowReject = undefined;
        _flowResolve = undefined;
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
      genesisChanged: undefined,
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
      logger.log(`setting up module`);
      const {web3Provider} = await module.setup(moduleConfig); // TODO pass config in select to choose network
      logger.log(`module setup`);
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

  let accounts: string[];
  try {
    if (type === 'builtin' && $builtin.vendor === 'Metamask') {
      accounts = await timeout(4000, _ethersProvider.listAccounts(), {
        error: `Metamask timed out. Please reload the page (see <a href="https://github.com/MetaMask/metamask-extension/issues/7221">here</a>)`,
      }); // TODO timeout checks (metamask, portis)
    } else {
      // TODO timeout warning
      logger.log(`fetching accounts...`);
      try {
        accounts = await _ethersProvider.listAccounts();
      } catch (e) {
        if (e.code === 4100) {
          logger.log(`4100 ${e.name}`);
          // status-im throw such error if eth_requestAccounts was not called first
          accounts = [];
        } else if (e.code === -32500 && e.message === 'permission denied') {
          if ($builtin.vendor === 'Opera') {
            logger.log(`permission denied (opera) crypto wallet not enabled?)`);
          } else {
            logger.log(`permission denied`);
          }
          accounts = [];
        } else if (e.code === 4001) {
          // "No Frame account selected" (frame.sh)
          accounts = [];
        } else {
          throw e;
        }
      }
      logger.log(`accounts: ${accounts}`);
    }
  } catch (e) {
    set(walletStore, {error: e, selected: undefined, connecting: false});
    throw e;
  }
  // logger.debug({accounts});
  recordSelection(type);
  const address = accounts && accounts[0];
  if (address) {
    set(walletStore, {
      address,
      state: 'Ready',
      connecting: undefined,
    });
    listenForChanges();
    logger.log('SETUP_CHAIN from select');
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
    if (_builtinWeb3Provider && $builtin.state === 'Ready') {
      return resolve(_builtinWeb3Provider);
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
      resolve(ethereum);
    } catch (e) {
      set(builtinStore, {
        error: e.message || e,
        vendor: undefined,
        available: undefined,
        probing: false,
      });
      return reject(e);
    }
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
  unloadTransactions();
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
    genesisChanged: undefined,
  });
  if (!keepFlow) {
    set(flowStore, {
      error: undefined,
      executing: false,
      executionError: undefined,
      inProgress: false,
    });
    _call = undefined;
    _flowReject = undefined;
    _flowResolve = undefined;
    _flowPromise = undefined;
  }
  recordSelection('');
}

function disconnect(config?: {logout?: boolean; wait?: boolean; keepFlow: boolean}): Promise<void> {
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
        console.error(e); // TODO Frame account selection ?
        accounts = [];
      }
      if (accounts.length > 0) {
        const address = accounts[0];
        set(walletStore, {
          address,
          state: 'Ready',
          unlocking: undefined,
        });
        logger.log('SETUP_CHAIN from unlock');
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
  logger.log('RETRYING...');
  set(flowStore, {executionError: undefined});
  if ($chain.state === 'Ready' && $wallet.state === 'Ready') {
    if (!$chain.contracts) {
      return Promise.reject('contracts not set');
    } else {
      const contracts = $chain.contracts;
      if (_call) {
        let result;
        try {
          logger.log('EXECUTING RETRY');
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
          logger.log('EXECUTING DIRECT');
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
    if ($wallet.selected) {
      disconnect({keepFlow: true})
        .catch((error) => {
          set(flowStore, {error});
          // _flowReject && _flowReject(error);
          // _flowPromise = undefined;
          // _flowReject = undefined;
          // _flowResolve = undefined;
        })
        .then(() => {
          connect(type, moduleConfig).catch((error) => {
            set(flowStore, {error: {code: 11, message: `failed to connect to ${type}`, errorObject: error}});
            // reject the flow here as the type chosen failed
            disconnect();
            // _flowReject && _flowReject(error);
            // _flowPromise = undefined;
            // _flowReject = undefined;
            // _flowResolve = undefined;
          });
        });
    } else {
      connect(type, moduleConfig).catch((error) => {
        set(flowStore, {error: {code: 11, message: `failed to connect to ${type}`, errorObject: error}});
        // reject the flow here as the type chosen failed
        disconnect();
        // _flowReject && _flowReject(error);
        // _flowPromise = undefined;
        // _flowReject = undefined;
        // _flowResolve = undefined;
      });
    }
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

function addTransaction(from: string, chainId: string, tx: TransactionRecord) {
  addOrChangeTransaction(from, chainId, tx, true);
}
function updateTransaction(
  from: string,
  chainId: string,
  tx: Partial<TransactionRecord> & {hash: string},
  override: boolean
) {
  // TODO check ? used to do but if so, need to check for tx coming from another wallet, like it is done in `addOrChangeTransaction`
  // const found = $transactions.find((v: TransactionRecord) => v.hash === tx.hash);
  // if (!found) {
  //   throw new Error('cannot update non-existing Transaction record');
  // }
  addOrChangeTransaction(from, chainId, tx as TransactionRecord, override);
}
function addOrChangeTransaction(from: string, chainId: string, tx: TransactionRecord, override: boolean) {
  if (
    $wallet.address &&
    $wallet.address.toLowerCase() === from.toLowerCase() &&
    $chain.chainId &&
    chainId === $chain.chainId
  ) {
    logger.log('TransactionRecord', tx);
    const found = $transactions.find((v: TransactionRecord) => v.hash === tx.hash);
    if (found) {
      const foundAsRecord = found as Record<string, unknown>;
      const txAsRecord = tx as Record<string, unknown>;
      for (const key of Object.keys(txAsRecord)) {
        if (override || (!override && foundAsRecord[key] === undefined)) {
          foundAsRecord[key] = txAsRecord[key];
        }
      }
    } else {
      $transactions.push(tx);
    }
    try {
      localStorage.setItem(
        LOCAL_STORAGE_TRANSACTIONS_SLOT + `_${from.toLowerCase()}_${chainId}`,
        JSON.stringify($transactions)
      );
    } catch (e) {}
    transactionsStore.set($transactions);
  } else {
    try {
      const localStorageSlot = LOCAL_STORAGE_TRANSACTIONS_SLOT + `_${from.toLowerCase()}_${chainId}`;
      const lastTransactionsString = localStorage.getItem(localStorageSlot) || '[]';
      const transactions = JSON.parse(lastTransactionsString);
      const found = transactions.find((v: TransactionRecord) => v.hash === tx.hash);
      if (found) {
        const foundAsRecord = found as Record<string, unknown>;
        const txAsRecord = tx as Record<string, unknown>;
        for (const key of Object.keys(tx)) {
          if ((!override && foundAsRecord[key] === undefined) || (override && txAsRecord[key] !== undefined)) {
            foundAsRecord[key] = txAsRecord[key];
          }
        }
      } else {
        transactions.push(tx);
      }
      localStorage.setItem(localStorageSlot, JSON.stringify(transactions));
    } catch (e) {}
  }
}

function unloadTransactions() {
  $transactions.splice(0, $transactions.length);
  transactionsStore.set($transactions);
  stopManagingTransactions();
}

function loadTransactions(address: string, chainId: string) {
  try {
    const txString = localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_SLOT + `_${address.toLowerCase()}_${chainId}`);
    let transactions: TransactionRecord[] = [];
    if (txString) {
      transactions = JSON.parse(txString);
    }
    $transactions.splice(0, $transactions.length, ...transactions);
    transactionsStore.set($transactions);
    manageTransactions(address, chainId);
  } catch (e) {}
}

let transactionManager: NodeJS.Timeout | undefined;
function manageTransactions(address: string, chainId: string) {
  stopManagingTransactions();
  listenForTxReceipts(address, chainId);
  transactionManager = setInterval(
    () => listenForTxReceipts(address, chainId),
    _config.transactions.pollingPeriod * 1000
  );
}
function stopManagingTransactions() {
  if (transactionManager) {
    clearInterval(transactionManager);
    transactionManager = undefined;
  }
}

let txChecking = false;
async function listenForTxReceipts(address: string, chainId: string) {
  if (txChecking) {
    // do not listen twice
    return;
  }
  txChecking = true;
  const STABLE_BLOCK_INTERVAL = _config.transactions.finality;
  const txs = $transactions.concat();
  for (const tx of txs) {
    // ----------------- LATEST BLOCK --------------------------
    if (!_ethersProvider) {
      break;
    }
    if ($wallet.address !== address || $chain.chainId !== chainId) {
      break;
    }
    if (!transactionManager) {
      break;
    }
    let latestBlock;
    try {
      latestBlock = await _ethersProvider.getBlock('latest');
    } catch (e) {
      logger.error(e);
      break;
    }

    if (tx.finalized) {
      continue;
    }

    // ----------------- STABLE NONCE --------------------------
    if (!_ethersProvider) {
      break;
    }
    if ($wallet.address !== address || $chain.chainId !== chainId) {
      break;
    }
    if (!transactionManager) {
      break;
    }
    let stableNonce = 0;
    if (latestBlock.number >= STABLE_BLOCK_INTERVAL) {
      try {
        stableNonce = await _ethersProvider.getTransactionCount(
          address,
          latestBlock.number - Math.max(1, STABLE_BLOCK_INTERVAL) + 1
        );
      } catch (e) {
        logger.error(e);
        break;
      }
    }

    // ----------------- CURRENT NONCE --------------------------
    if (!_ethersProvider) {
      break;
    }
    if ($wallet.address !== address || $chain.chainId !== chainId) {
      break;
    }
    if (!transactionManager) {
      break;
    }
    let currentNonce = 0;
    try {
      currentNonce = await _ethersProvider.getTransactionCount(address);
    } catch (e) {
      logger.error(e);
      break;
    }

    // ----------------- RECEIPT --------------------------
    if (!_ethersProvider) {
      break;
    }
    if ($wallet.address !== address || $chain.chainId !== chainId) {
      break;
    }
    if (!transactionManager) {
      break;
    }
    let receipt: TransactionReceipt;
    try {
      receipt = await _ethersProvider.getTransactionReceipt(tx.hash);
    } catch (e) {
      logger.error(e);
      continue;
    }

    // ----------------- PROCESS TRANSACTION STATE --------------------------
    if ($wallet.address !== address || $chain.chainId !== chainId) {
      break;
    }
    if (!transactionManager) {
      break;
    }
    const updatedTxFields: Partial<TransactionRecord> & {hash: string} = {
      hash: tx.hash,
    };
    let deleteTx = false;
    if (!receipt || !receipt.blockHash) {
      if (stableNonce > tx.nonce) {
        updatedTxFields.status = 'cancelled';
        updatedTxFields.finalized = true;
        updatedTxFields.confirmations = Math.max(1, STABLE_BLOCK_INTERVAL);
        if (tx.acknowledged || _config.transactions.autoDelete) {
          deleteTx = true;
        }
      } else if (currentNonce > tx.nonce) {
        updatedTxFields.status = 'cancelled';
        updatedTxFields.confirmations = 1; // could be more
      } else {
        updatedTxFields.status = 'pending';
        updatedTxFields.confirmations = 0;
      }
      updatedTxFields.blockHash = undefined;
      updatedTxFields.blockNumber = undefined;
      updatedTxFields.events = undefined;
    } else {
      if (receipt.status !== undefined) {
        const success = receipt.status === 1;
        updatedTxFields.status = success ? 'success' : 'failure';
        if (success) {
          updatedTxFields.events = [];
          // TODO
        }
      } else {
        if (receipt.logs.length > 0) {
          updatedTxFields.status = 'success';
        } else {
          updatedTxFields.status = 'mined'; // TODO check?
        }
      }
      if (tx.eventsABI && receipt.logs.length > 0) {
        const eventInterface = new Interface(tx.eventsABI);

        updatedTxFields.events = receipt.logs.reduce<ParsedEvent[]>((filtered, log) => {
          let parsed: LogDescription | undefined;
          try {
            parsed = eventInterface.parseLog(log);
          } catch (e) {
            logger.error(e);
          }
          if (parsed) {
            const args: Record<string, unknown> = {};
            for (const key of Object.keys(parsed.args)) {
              const value = parsed.args[key];
              args[key] = JSON.parse(JSON.stringify(value));
            }
            const event = {
              args,
              name: parsed.name,
              signature: parsed.signature,
            };
            filtered.push(event);
          }
          return filtered;
        }, []);
      }
      updatedTxFields.blockHash = receipt.blockHash;
      updatedTxFields.confirmations = receipt.confirmations;
      if (receipt.confirmations >= STABLE_BLOCK_INTERVAL) {
        updatedTxFields.finalized = true;
        if (tx.acknowledged || _config.transactions.autoDelete) {
          deleteTx = true;
        }
      }
    }

    if (tx.status !== updatedTxFields.status) {
      // updatedTxFields.lastChanged = latestBlock.timestamp;
      updatedTxFields.acknowledged = false;
    }

    if (deleteTx) {
      deleteTransaction(tx.hash);
    } else {
      updatedTxFields.lastCheck = latestBlock.timestamp;
      try {
        updateTransaction(address, chainId, updatedTxFields, true);
      } catch (e) {
        logger.error(e);
      }
    }
  }
  txChecking = false;
}

function deleteTransaction(hash: string) {
  logger.log(`deleting  ${hash}`);
  if ($wallet.address && $chain.chainId) {
    const foundIndex = $transactions.findIndex((v: TransactionRecord) => v.hash === hash);
    $transactions.splice(foundIndex, 1);
    try {
      localStorage.setItem(
        LOCAL_STORAGE_TRANSACTIONS_SLOT + `_${$wallet.address.toLowerCase()}_${$chain.chainId}`,
        JSON.stringify($transactions)
      );
    } catch (e) {}
    transactionsStore.set($transactions);
  }
}

async function setupFallback(fallbackNodeOrProvider: string | Provider, chainConfigs?: ChainConfigs) {
  if (typeof fallbackNodeOrProvider === 'string') {
    fallbackNodeOrProvider = new JsonRpcProvider(fallbackNodeOrProvider);
  }
  _fallbackProvider = fallbackNodeOrProvider;
  set(fallbackStore, {connecting: true});
  let chainIdAsNumber;
  try {
    const netResult = await fallbackNodeOrProvider.getNetwork();
    chainIdAsNumber = netResult.chainId;
  } catch (e) {
    const error = {
      code: CHAIN_ID_FAILED,
      message: `Failed to fetch chainId from fallback`, // TODO retry automatically ?
    };
    set(fallbackStore, {
      error,
      connecting: false,
      loadingData: false,
      contracts: undefined,
      addresses: undefined,
      state: 'Idle',
    });
    // throw new Error(error.message);
    return;
  }
  const chainId = String(chainIdAsNumber);
  set(fallbackStore, {
    chainId,
    connecting: false,
    loadingData: false,
    contracts: undefined,
    addresses: undefined,
    state: 'Connected',
  });
  set(fallbackStore, {loadingData: true});
  if (typeof chainConfigs === 'function') {
    chainConfigs = await chainConfigs(chainId);
  }
  const contractsToAdd: {[name: string]: Contract} = {};
  const addresses: {[name: string]: string} = {};
  if (chainConfigs) {
    let contractsInfos;
    try {
      contractsInfos = getContractInfos(chainConfigs, chainId);
    } catch (error) {
      set(fallbackStore, {
        error,
        chainId,
        connecting: false,
        loadingData: false,
        state: 'Connected',
      });
      throw new Error(error.message || error);
    }

    for (const contractName of Object.keys(contractsInfos)) {
      const contractInfo = contractsInfos[contractName];
      if (contractInfo.abi) {
        logger.log({contractName});
        contractsToAdd[contractName] = new Contract(contractInfo.address, contractInfo.abi, fallbackNodeOrProvider);
      }
      addresses[contractName] = contractInfo.address;
    }
  }

  set(fallbackStore, {
    state: 'Ready',
    loadingData: false,
    connecting: false,
    chainId,
    addresses,
    contracts: contractsToAdd,
  });
}

// /////////////////////////////////////////////////////////////////////////////////
export function initWeb3W<ContractTypes extends ContractsInfos = ContractsInfos>(
  config: Web3wConfig<ContractTypes>
): {
  transactions: TransactionStore;
  balance: BalanceStore;
  chain: ChainStore;
  fallback: FallbackStore;
  builtin: BuiltinStore;
  wallet: WalletStore;
  flow: FlowStore;
} {
  _config = {
    builtin: {
      autoProbe: config.builtin ? config.builtin.autoProbe : false,
    },
    flow: {
      autoSelect: config.flow && config.flow.autoSelect ? true : false,
      autoUnlock: config.flow && config.flow.autoUnlock ? true : false,
    },
    debug: config.debug || false,
    chainConfigs: config.chainConfigs,
    options: config.options || [],
    autoSelectPrevious: config.autoSelectPrevious ? true : false,
    localStoragePrefix: config.localStoragePrefix || '',
    transactions: {
      waitForTransactionDetails: (config.transactions && config.transactions.waitForTransactionDetails) || false,
      autoDelete:
        config.transactions && typeof config.transactions.autoDelete !== 'undefined'
          ? config.transactions.autoDelete
          : true,
      finality: (config.transactions && config.transactions.finality) || 12,
      pollingPeriod: (config.transactions && config.transactions.pollingPeriod) || 10,
    },
    checkGenesis: config.checkGenesis || false,
    fallbackNode: config.fallbackNode,
  };
  if (!_config.options || _config.options.length === 0) {
    _config.options = ['builtin'];
  }

  LOCAL_STORAGE_PREVIOUS_WALLET_SLOT = _config.localStoragePrefix + LOCAL_STORAGE_PREVIOUS_WALLET_SLOT;
  LOCAL_STORAGE_TRANSACTIONS_SLOT = _config.localStoragePrefix + LOCAL_STORAGE_TRANSACTIONS_SLOT;
  const {debug, chainConfigs, builtin} = _config;

  _chainConfigs = chainConfigs;

  if (config.fallbackNode) {
    setupFallback(config.fallbackNode, chainConfigs);
  }

  if (debug && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$wallet = $wallet;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$transactions = $transactions;
  }

  _options = _config.options;
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
      acknowledge(hash: string, status: TransactionStatus) {
        if ($wallet.address && $chain.chainId) {
          const found = $transactions.find((v: TransactionRecord) => v.hash === hash);
          if (found) {
            if (found.finalized) {
              deleteTransaction(hash);
            } else {
              found.lastAcknowledgment = status;
              found.acknowledged = true;
              try {
                localStorage.setItem(
                  LOCAL_STORAGE_TRANSACTIONS_SLOT + `_${$wallet.address.toLowerCase()}_${$chain.chainId}`,
                  JSON.stringify($transactions)
                );
              } catch (e) {}
              transactionsStore.set($transactions);
            }
          }
        }
      },
    },
    balance: {
      subscribe: balanceStore.subscribe,
      acknowledgeError: acknowledgeError(balanceStore),
    },
    chain: {
      subscribe: chainStore.subscribe,
      acknowledgeError: acknowledgeError(chainStore),
      acknowledgeNewGenesisHash() {
        const chainId = $chain.chainId;
        if (chainId) {
          if (genesisHashes[chainId]) {
            const lkey = `_genesis_${chainId}`;
            localStorage.setItem(lkey, genesisHashes[chainId]);
            set(chainStore, {genesisChanged: false});
          } else {
            throw new Error(`no genesisHash for chainId: ${chainId}`);
          }
        } else {
          throw new Error(`no chainId`);
        }
      },
      get contracts() {
        return $chain.contracts;
      },
      updateContracts<ContractTypes extends ContractsInfos = ContractsInfos>(
        chainConfigs: MultiChainConfigs<ContractTypes> | ChainConfig<ContractTypes>
      ): Promise<void> {
        return updateContracts(chainConfigs);
      },
      switchChain: switchChain,
    },
    fallback: {
      subscribe: fallbackStore.subscribe,
      get contracts() {
        return $fallback.contracts;
      },
      get state() {
        return $fallback.state;
      },
      get provider() {
        return _fallbackProvider;
      },
    },
    builtin: {
      subscribe: builtinStore.subscribe,
      acknowledgeError: acknowledgeError(builtinStore),
      probe: probeBuiltin,
      get vendor() {
        return $builtin.vendor;
      },
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
      get selected() {
        return $wallet.selected;
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
      get fallbackProvider() {
        return _fallbackProvider;
      },
    },
    flow: {
      subscribe: flowStore.subscribe,
      execute: flow_execute,
      retry: flow_retry,
      cancel: flow_cancel,
      connect: flow_connect,
    },
  };
}
