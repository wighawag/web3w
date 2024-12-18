import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider, ExternalProvider, Provider } from '@ethersproject/providers';
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
declare type EIP6963ProviderInfo = {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
};
declare type EIP6963ProviderDetail = {
    info: EIP6963ProviderInfo;
    provider: WindowWeb3Provider;
};
export declare type BuiltinData = BaseData & {
    probing: boolean;
    state: 'Idle' | 'Ready';
    available?: boolean;
    vendor?: string;
    walletsAnnounced: EIP6963ProviderDetail[];
    ethereumAnnounced: boolean;
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
    genesisChanged?: boolean;
};
export declare type FallbackData = BaseData & {
    connecting: boolean;
    loadingData: boolean;
    state: 'Idle' | 'Connected' | 'Ready';
    chainId?: string;
    addresses?: {
        [name: string]: string;
    };
    contracts?: Contracts;
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
    readonly fallbackProvider: Provider | undefined;
    readonly web3Provider: WindowWeb3Provider | undefined;
    readonly chain: ChainData;
    readonly contracts: Contracts | undefined;
    readonly balance: BigNumber | undefined;
    readonly selected: string | undefined;
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
    readonly vendor: string | undefined;
};
export declare type ChainStore = Readable<ChainData> & {
    acknowledgeError: () => void;
    acknowledgeNewGenesisHash: () => void;
    readonly contracts: Contracts | undefined;
    updateContracts<ContractTypes extends ContractsInfos = ContractsInfos>(chainConfigs: MultiChainConfigs<ContractTypes> | ChainConfig<ContractTypes>): Promise<void>;
    switchChain(chainId: string, config?: {
        rpcUrls?: string[];
        blockExplorerUrls?: string[];
        chainName?: string;
        iconUrls?: string[];
        nativeCurrency?: {
            name: string;
            symbol: string;
            decimals: number;
        };
    }): Promise<void>;
};
export declare type FallbackStore = Readable<FallbackData> & {
    readonly contracts: Contracts | undefined;
    readonly state: 'Idle' | 'Connected' | 'Ready';
    readonly provider: Provider | undefined;
};
export declare type BalanceStore = Readable<BalanceData> & {
    acknowledgeError: () => void;
};
export declare type TransactionStore = Readable<TransactionRecord[]> & {
    acknowledge: (hash: string, status: TransactionStatus) => void;
};
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
export declare type ChainConfig<ContractTypes extends ContractsInfos = ContractsInfos> = {
    chainId: string;
    name?: string;
    contracts: ContractTypes;
};
export declare type MultiChainConfigs<ContractTypes extends ContractsInfos = ContractsInfos> = {
    [chainId: string]: ChainConfig<ContractTypes>;
};
export declare type ChainConfigs<ContractTypes extends ContractsInfos = ContractsInfos> = MultiChainConfigs<ContractTypes> | ChainConfig<ContractTypes> | ((chainId: string) => Promise<ChainConfig<ContractTypes> | MultiChainConfigs<ContractTypes>>);
declare type BuiltinConfig = {
    autoProbe: boolean;
};
export declare type TransactionStatus = 'pending' | 'cancelled' | 'success' | 'failure' | 'mined';
export declare type ParsedEvent = {
    args: Record<string, unknown>;
    name: string;
    signature: string;
};
export declare type TransactionRecord = {
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
export declare type Web3wConfig<ContractTypes extends ContractsInfos = ContractsInfos> = {
    builtin?: BuiltinConfig;
    flow?: {
        autoSelect?: boolean;
        autoUnlock?: boolean;
    };
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
declare function connect(type: string, moduleConfig?: unknown): Promise<boolean>;
declare function disconnect(config?: {
    logout?: boolean;
    wait?: boolean;
    keepFlow: boolean;
}): Promise<void>;
declare function unlock(): Promise<boolean>;
export declare function initWeb3W<ContractTypes extends ContractsInfos = ContractsInfos>(config: Web3wConfig<ContractTypes>): {
    transactions: TransactionStore;
    balance: BalanceStore;
    chain: ChainStore;
    fallback: FallbackStore;
    builtin: BuiltinStore;
    wallet: WalletStore;
    flow: FlowStore;
};
export {};
//# sourceMappingURL=index.d.ts.map