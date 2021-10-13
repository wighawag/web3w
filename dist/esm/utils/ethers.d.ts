import type { Contract, PayableOverrides } from '@ethersproject/contracts';
import type { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import type { Web3Provider } from '@ethersproject/providers';
export declare type EventsABI = {
    anonymous: boolean;
    inputs: {
        indexed: boolean;
        internalType: string;
        name: string;
        type: string;
    }[];
    name: string;
    type: 'event';
}[];
export declare type ContractTransaction = {
    from: string;
    chainId: string;
    to: string;
    contractName: string;
    method: string;
    args: unknown[];
    eventsABI: EventsABI;
    overrides?: PayableOverrides;
    metadata: unknown;
};
export declare type ContractTransactionSent = {
    hash: string;
} & ContractTransaction;
export declare type Transaction = {
    from: string;
    chainId: string;
    to?: string;
    nonce?: BigNumberish;
    gasLimit?: BigNumberish;
    gasPrice?: BigNumberish;
    data?: string;
    value?: BigNumberish;
};
export declare type TransactionSent = {
    submissionBlockTime: number;
    hash: string;
    from: string;
    chainId: string;
    to?: string;
    nonce: number;
    gasLimit: BigNumber;
    gasPrice?: BigNumber;
    maxPriorityFeePerGas?: BigNumber;
    maxFeePerGas?: BigNumber;
    data: string;
    value: BigNumber;
};
export declare type SignatureRequest = {
    from: string;
    message: unknown;
};
export declare type SignatureResponse = {
    from: string;
    signature: string;
};
declare type ContractObservers = {
    onContractTxRequested?: (tx: ContractTransaction) => void;
    onContractTxCancelled?: (tx: ContractTransaction) => void;
    onContractTxSent?: (tx: ContractTransactionSent) => void;
};
declare type TxObservers = {
    onTxRequested?: (txRequest: Transaction) => void;
    onTxCancelled?: (txRequest: Transaction) => void;
    onTxSent?: (tx: TransactionSent) => void;
    onSignatureRequested?: (sigRequest: SignatureRequest) => void;
    onSignatureCancelled?: (sigRequest: SignatureRequest) => void;
    onSignatureReceived?: (sigResponse: SignatureResponse) => void;
};
export declare function proxyContract(contractToProxy: Contract, name: string, chainId: string, observers?: ContractObservers): Contract;
export declare function proxyWeb3Provider(provider: Web3Provider, observers?: TxObservers): Web3Provider;
export {};
//# sourceMappingURL=ethers.d.ts.map