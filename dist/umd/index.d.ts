import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers';
import { BigNumber } from '@ethersproject/bignumber';
import type { EventsABI } from './utils/ethers';
import { Readable } from './utils/internals';
declare type ErrorData = {
    code: number;
    message: string;
    errorObject?: unknown;
};
declare type BaseData = {
    error?: ErrorData;
};
export declare type BalanceData = BaseData & {
    fetching: boolean;
    state: 'Idle' | 'Ready';
    stale?: boolean;
    amount?: BigNumber;
    blockNumber?: number;
};
export declare type BuiltinData = BaseData & {
    probing: boolean;
    state: 'Idle' | 'Ready';
    available?: boolean;
    vendor?: string;
};
declare type Contracts = {
    [name: string]: Contract;
};
export declare type ChainData = BaseData & {
    connecting: boolean;
    loadingData: boolean;
    state: 'Idle' | 'Connected' | 'Ready';
    chainId?: string;
    addresses?: {
        [name: string]: string;
    };
    contracts?: Contracts;
    notSupported?: boolean;
};
export declare type FlowData = BaseData & {
    inProgress: boolean;
    executing: boolean;
    executionError: unknown | undefined;
};
export declare type WalletData = BaseData & {
    state: 'Idle' | 'Locked' | 'Ready';
    connecting: boolean;
    disconnecting: boolean;
    loadingModule: boolean;
    unlocking: boolean;
    address?: string;
    options: string[];
    selected?: string;
    pendingUserConfirmation?: string[];
};
export declare type WalletStore = Readable<WalletData> & {
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
export declare type FlowStore = Readable<FlowData> & {
    execute(func?: (contracts: Contracts) => Promise<void>): Promise<Contracts>;
    connect(type?: string, moduleConfig?: unknown): Promise<Contracts>;
    retry(): Promise<void>;
    cancel(): void;
};
export declare type BuiltinStore = Readable<BuiltinData> & {
    probe: () => Promise<WindowWeb3Provider>;
    acknowledgeError: () => void;
};
export declare type ChainStore = Readable<ChainData> & {
    acknowledgeError: () => void;
};
export declare type BalanceStore = Readable<BalanceData> & {
    acknowledgeError: () => void;
};
export declare type TransactionStore = Readable<TransactionRecord[]>;
declare type Abi = any[];
declare type AnyFunction = (...args: any[]) => any;
interface RequestArguments {
    readonly method: string;
    readonly params?: readonly unknown[] | unknown;
}
export declare type WindowWeb3Provider = ExternalProvider & {
    sendAsync?(request: {
        method: string;
        params?: unknown[];
    }, callback: (error: unknown, result: {
        jsonrpc: '2.0';
        error?: unknown;
        result?: unknown;
    }) => void): void;
    send?(...args: unknown[]): unknown;
    request?(args: RequestArguments): Promise<unknown>;
    on?(event: string, callback: AnyFunction): void;
    removeListener?(event: string, callback: AnyFunction): void;
};
export declare type Web3WModuleLoader = {
    id: string;
    load(): Promise<Web3WModule>;
};
export declare type Web3WModule = {
    id: string;
    setup(options?: unknown): Promise<{
        chainId: string;
        web3Provider: WindowWeb3Provider;
    }>;
    logout(): Promise<void>;
    disconnect(): void;
};
declare type ModuleOptions = (string | Web3WModule | Web3WModuleLoader)[];
declare type ContractsInfos = {
    [name: string]: {
        address: string;
        abi: Abi;
    };
};
export declare type ChainConfig = {
    chainId: string;
    name?: string;
    contracts: ContractsInfos;
};
export declare type MultiChainConfigs = {
    [chainId: string]: ChainConfig;
};
export declare type ChainConfigs = MultiChainConfigs | ChainConfig | ((chainId: string) => Promise<ChainConfig | MultiChainConfigs>);
declare type BuiltinConfig = {
    autoProbe: boolean;
};
declare type TransactionRecord = {
    hash: string;
    submissionBlockTime: number;
    acknowledged: boolean;
    cancelled: boolean;
    cancelationAcknowledged: boolean;
    nonce: number;
    confirmations: number;
    finalized: boolean;
    to?: string;
    gasLimit?: string;
    gasPrice?: string;
    data?: string;
    value?: string;
    contractName?: string;
    method?: string;
    args?: unknown[];
    eventsABI?: EventsABI;
    metadata?: unknown;
    lastCheck?: number;
    blockHash?: string;
    success?: boolean;
};
export declare type Web3wConfig = {
    builtin?: BuiltinConfig;
    flow?: {
        autoSelect?: boolean;
        autoUnlock?: boolean;
    };
    debug?: boolean;
    chainConfigs: ChainConfigs;
    options?: ModuleOptions;
    autoSelectPrevious?: boolean;
    localStoragePrefix?: string;
    transactions?: {
        finality?: number;
        pollingPeriod?: number;
    };
};
declare function connect(type: string, moduleConfig?: unknown): Promise<boolean>;
declare function disconnect(config?: {
    logout?: boolean;
    wait?: boolean;
    keepFlow: boolean;
}): Promise<void>;
declare function unlock(): Promise<boolean>;
declare function flow(func?: (contracts: Contracts) => Promise<void>, type?: string, moduleConfig?: unknown): Promise<Contracts>;
declare const _default: (config: Web3wConfig) => {
    transactions: TransactionStore;
    balance: BalanceStore;
    chain: ChainStore;
    builtin: BuiltinStore;
    wallet: WalletStore;
    flow: FlowStore;
};
export default _default;
//# sourceMappingURL=index.d.ts.map