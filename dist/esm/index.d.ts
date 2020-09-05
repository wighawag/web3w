import { Contract, Overrides } from '@ethersproject/contracts';
import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers';
import { BigNumber } from '@ethersproject/bignumber';
import { Readable } from './utils/internals';
declare type BaseData = {
    error?: {
        code: number;
        message: string;
    };
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
export declare type WalletData = BaseData & {
    connecting: boolean;
    state: 'Idle' | 'Locked' | 'Ready';
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
    logout: typeof logout;
    readonly options: string[];
    readonly address: string | undefined;
    readonly provider: JsonRpcProvider | undefined;
    readonly web3Provider: WindowWeb3Provider | undefined;
    readonly chain: ChainData;
    readonly contracts: Contracts | undefined;
    readonly balance: BigNumber | undefined;
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
declare type WindowWeb3Provider = ExternalProvider & {
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
declare type Module = {
    id: string;
    setup(options?: ModuleOptions): Promise<{
        chainId: string;
        web3Provider: WindowWeb3Provider;
    }>;
    logout(): Promise<void>;
};
declare type ModuleOptions = (string | Module)[];
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
    name: string;
    method: string;
    overrides: Overrides;
    outcome: unknown;
};
export declare type Web3wConfig = {
    builtin?: BuiltinConfig;
    debug?: boolean;
    chainConfigs: ChainConfigs;
    options?: ModuleOptions;
    autoSelectPrevious?: boolean;
};
declare function connect(type: string, moduleConfig?: unknown): Promise<boolean>;
declare function logout(): Promise<void>;
declare function unlock(): Promise<boolean>;
declare const _default: (config: Web3wConfig) => {
    transactions: TransactionStore;
    balance: BalanceStore;
    chain: ChainStore;
    builtin: BuiltinStore;
    wallet: WalletStore;
};
export default _default;
//# sourceMappingURL=index.d.ts.map