declare module "errors" {
    export const CHAIN_NO_PROVIDER = 6000;
    export const CHAIN_CONFIG_NOT_AVAILABLE = 6001;
    export const MODULE_ERROR = 1000;
}
declare module "utils/internals" {
    export const noop: () => void;
    /** Callback to inform of a value updates. */
    export type Subscriber<T> = (value: T) => void;
    /** Unsubscribes from value updates. */
    export type Unsubscriber = () => void;
    /** Callback to update a value. */
    export type Updater<T> = (value: T) => T;
    /** Cleanup logic callback. */
    export type Invalidator<T> = (value?: T) => void;
    /** Start and stop notification callbacks. */
    export type StartStopNotifier<T> = (set: Subscriber<T>) => Unsubscriber | void;
    /** Readable interface for subscribing. */
    export interface Readable<T> {
        /**
         * Subscribe on value changes.
         * @param run subscription callback
         * @param invalidate cleanup callback
         */
        subscribe(run: Subscriber<T>, invalidate?: Invalidator<T>): Unsubscriber;
    }
    export interface Observable<T> {
        /**
         * Subscribe on value changes.
         * @param run subscription callback
         * @param invalidate cleanup callback
         */
        subscribe(run: Subscriber<T>, invalidate?: Invalidator<T>): {
            unsubscribe: () => void;
        };
    }
    /** Writable interface for both updating and subscribing. */
    export interface Writable<T> extends Readable<T> {
        /**
         * Set value and inform subscribers.
         * @param value to set
         */
        set(value: T): void;
        /**
         * Update value using callback and inform subscribers.
         * @param updater callback
         */
        update(updater: Updater<T>): void;
    }
    export function subscribe<T>(store: Readable<T>, run: Subscriber<T>, invalidate?: Invalidator<T>): () => void;
    export function safe_not_equal<T, U>(a: T, b: U): boolean;
    export function get_store_value<T>(store: Readable<T>): T;
}
declare module "utils/store" {
    import { get_store_value } from "utils/internals";
    import { StartStopNotifier, Readable, Writable } from "utils/internals";
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    export function readable<T>(value: T, start: StartStopNotifier<T>): Readable<T>;
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    export function writable<T>(value: T, start?: StartStopNotifier<T>): Writable<T>;
    /**
     * Get the current value from a store by subscribing and immediately unsubscribing.
     * @param store readable
     */
    export { get_store_value as get };
}
declare module "utils/builtin" {
    type Ethereum = any;
    export function getEthereum(): Ethereum;
    export function fetchEthereum(): Promise<Ethereum>;
    export function getVendor(ethereum: Ethereum): string | undefined;
}
declare module "utils/index" {
    type Config = {
        error: unknown;
    };
    type Func<T> = () => T;
    export function timeout<T>(time: number, p: Promise<T>, config?: Config | Func<T>): Promise<T>;
}
declare module "utils/ethers" {
    import type { Contract, Overrides } from '@ethersproject/contracts';
    import type { TransactionRequest, TransactionResponse, Web3Provider } from '@ethersproject/providers';
    type ContractObservers = {
        onContractTxRequested?: (tx: {
            name: string;
            method: string;
            overrides: Overrides;
            outcome: unknown;
        }) => void;
        onContractTxCancelled?: (tx: {
            name: string;
            method: string;
            overrides: Overrides;
            outcome: unknown;
        }) => void;
        onContractTxSent?: (tx: {
            hash: string;
            name: string;
            method: string;
            overrides: Overrides;
            outcome: unknown;
        }) => void;
    };
    type TxObservers = {
        onTxRequested?: (tx: TransactionRequest) => void;
        onTxCancelled?: (tx: TransactionRequest) => void;
        onTxSent?: (tx: TransactionResponse) => void;
        onSignatureRequested?: (msg: unknown) => void;
        onSignatureCancelled?: (msg: unknown) => void;
        onSignatureReceived?: (signature: string) => void;
    };
    export function proxyContract(contractToProxy: Contract, name: string, observers?: ContractObservers): Contract;
    export function proxyWeb3Provider(provider: Web3Provider, observers?: TxObservers): Web3Provider;
}
declare module "index" {
    import { Contract, Overrides } from '@ethersproject/contracts';
    import { JsonRpcProvider, ExternalProvider } from '@ethersproject/providers';
    import { BigNumber } from '@ethersproject/bignumber';
    import { Readable } from "utils/internals";
    type Base = {
        loading: boolean;
        error?: {
            code: number;
            message: string;
        };
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
    type Contracts = {
        [name: string]: Contract;
    };
    type ChainData = Base & {
        state: 'Idle' | 'Ready';
        chainId?: string;
        addresses?: {
            [name: string]: string;
        };
        contracts?: Contracts;
        notSupported?: boolean;
    };
    type WalletData = Base & {
        state: 'Idle' | 'Locked' | 'Ready';
        unlocking: boolean;
        address?: string;
        options?: string[];
        selected?: string;
        pendingUserConfirmation?: string[];
    };
    type Abi = {
        type: string;
        name: string;
    }[];
    type AnyFunction = (...args: any[]) => any;
    interface RequestArguments {
        readonly method: string;
        readonly params?: readonly unknown[] | unknown;
    }
    type WindowWeb3Provider = ExternalProvider & {
        sendAsync?(request: {
            jsonrpc: string;
            id: string;
            result?: unknown;
        }, callback: (result: {
            jsonrpc: string;
        }) => void): void;
        send?(...args: unknown[]): unknown;
        request?(args: RequestArguments): Promise<unknown>;
        on(event: string, callback: AnyFunction): void;
        removeListener(event: string, callback: AnyFunction): void;
    };
    type Module = {
        id: string;
        setup(options?: ModuleOptions): Promise<{
            chainId: string;
            web3Provider: WindowWeb3Provider;
        }>;
        logout(): Promise<void>;
    };
    type ModuleOptions = (string | Module)[];
    type ContractsInfos = {
        [name: string]: {
            address: string;
            abi: Abi;
        };
    };
    type ChainConfig = {
        chainId: string;
        contracts: ContractsInfos;
    };
    type MultiChainConfigs = {
        [chainId: string]: ChainConfig;
    };
    type ChainConfigs = MultiChainConfigs | ChainConfig | ((chainId: string) => Promise<ChainConfig | MultiChainConfigs>);
    type BuiltinConfig = {
        autoProbe: boolean;
    };
    type TransactionRecord = {
        hash: string;
        name: string;
        method: string;
        overrides: Overrides;
        outcome: unknown;
    };
    export type Web3wConfig = {
        builtin?: BuiltinConfig;
        debug?: boolean;
        chainConfigs: ChainConfigs;
        options?: ModuleOptions;
        autoSelectPrevious?: boolean;
    };
    function connect(type: string, moduleConfig?: unknown): Promise<boolean>;
    function acknowledgeError(field: string): void;
    function logout(): Promise<void>;
    function unlock(): Promise<boolean>;
    const _default: (config: Web3wConfig) => {
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
}
declare module "utils/web" {
    export function isPrivateWindow(): Promise<boolean>;
}
//# sourceMappingURL=index.d.ts.map