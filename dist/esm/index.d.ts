import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from '@ethersproject/bignumber';
declare type Base = {
    loading: boolean;
    error: any;
};
declare type BalanceData = Base & {
    state: 'Idle' | 'Ready';
    stale?: boolean;
    amount?: BigNumber;
    blockNumber?: number;
};
declare type BuiltinData = Base & {
    state: 'Idle' | 'Ready';
    available?: boolean;
    vendor?: string;
};
declare type ChainData = Base & {
    state: 'Idle' | 'Ready';
    chainId?: string;
    addresses?: {
        [name: string]: string;
    };
    contracts?: {
        [name: string]: Contract;
    };
    notSupported?: boolean;
};
declare type WalletData = Base & {
    state: 'Idle' | 'Locked' | 'Ready';
    unlocking: boolean;
    address?: string;
    options?: string[];
    selected?: string;
    pendingUserConfirmation?: string[];
};
declare type Module = {
    id: string;
    setup(options?: ModuleOptions): Promise<{
        chainId: string;
        web3Provider: any;
    }>;
    logout(): Promise<void>;
};
declare type ModuleOptions = (string | Module)[];
declare type ContractsInfos = {
    [name: string]: {
        address: string;
        abi: any[];
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
declare type BuiltinConfig = any;
export declare type Web3wConfig = {
    builtin?: BuiltinConfig;
    debug?: boolean;
    chainConfigs: ChainConfigs;
    options?: ModuleOptions;
    autoSelectPrevious?: boolean;
};
declare function probeBuiltin(config?: {}): Promise<void>;
declare function connect(type: string, moduleConfig?: any): Promise<boolean>;
declare function acknowledgeError(field: string): void;
declare function logout(): Promise<void>;
declare function unlock(): Promise<boolean>;
declare const _default: (config: Web3wConfig) => {
    transactions: {
        subscribe: (run: import("./utils/internals").Subscriber<any[]>, invalidate?: import("./utils/internals").Invalidator<any[]> | undefined) => import("./utils/internals").Unsubscriber;
    };
    balance: {
        subscribe: (run: import("./utils/internals").Subscriber<BalanceData>, invalidate?: import("./utils/internals").Invalidator<BalanceData> | undefined) => import("./utils/internals").Unsubscriber;
    };
    chain: {
        subscribe: (run: import("./utils/internals").Subscriber<ChainData>, invalidate?: import("./utils/internals").Invalidator<ChainData> | undefined) => import("./utils/internals").Unsubscriber;
    };
    builtin: {
        subscribe: (run: import("./utils/internals").Subscriber<BuiltinData>, invalidate?: import("./utils/internals").Invalidator<BuiltinData> | undefined) => import("./utils/internals").Unsubscriber;
        probe: typeof probeBuiltin;
    };
    wallet: {
        subscribe: (run: import("./utils/internals").Subscriber<WalletData>, invalidate?: import("./utils/internals").Invalidator<WalletData> | undefined) => import("./utils/internals").Unsubscriber;
        connect: typeof connect;
        unlock: typeof unlock;
        acknowledgeError: typeof acknowledgeError;
        logout: typeof logout;
        readonly address: string | undefined;
        readonly provider: JsonRpcProvider | null;
        readonly web3Provider: any;
        readonly chain: ChainData;
        readonly contracts: {
            [name: string]: Contract;
        } | undefined;
        readonly balance: BigNumber | undefined;
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map