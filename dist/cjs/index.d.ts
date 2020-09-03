import { Contract, Overrides } from '@ethersproject/contracts';
import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers';
import { BigNumber } from '@ethersproject/bignumber';
import { Readable } from './utils/internals';
declare type Base = {
    error?: {
        code: number;
        message: string;
    };
};
declare type BalanceData = Base & {
    fetching: boolean;
    state: 'Idle' | 'Ready';
    stale?: boolean;
    amount?: BigNumber;
    blockNumber?: number;
};
declare type BuiltinData = Base & {
    probing: boolean;
    state: 'Idle' | 'Ready';
    available?: boolean;
    vendor?: string;
};
declare type Contracts = {
    [name: string]: Contract;
};
declare type ChainData = Base & {
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
declare type WalletData = Base & {
    connecting: boolean;
    state: 'Idle' | 'Locked' | 'Ready';
    unlocking: boolean;
    address?: string;
    options?: string[];
    selected?: string;
    pendingUserConfirmation?: string[];
};
declare type Abi = {
    type: string;
    name: string;
}[];
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
declare type ChainConfig = {
    chainId: string;
    contracts: ContractsInfos;
};
declare type MultiChainConfigs = {
    [chainId: string]: ChainConfig;
};
declare type ChainConfigs = MultiChainConfigs | ChainConfig | ((chainId: string) => Promise<ChainConfig | MultiChainConfigs>);
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
declare function acknowledgeError(field: string): void;
declare function logout(): Promise<void>;
declare function unlock(): Promise<boolean>;
declare const _default: (config: Web3wConfig) => {
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
};
export default _default;
//# sourceMappingURL=index.d.ts.map