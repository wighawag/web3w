import type { Contract, Overrides } from '@ethersproject/contracts';
import type { TransactionRequest, TransactionResponse, Web3Provider } from '@ethersproject/providers';
declare type ContractObservers = {
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
declare type TxObservers = {
    onTxRequested?: (tx: TransactionRequest) => void;
    onTxCancelled?: (tx: TransactionRequest) => void;
    onTxSent?: (tx: TransactionResponse) => void;
    onSignatureRequested?: (msg: unknown) => void;
    onSignatureCancelled?: (msg: unknown) => void;
    onSignatureReceived?: (signature: string) => void;
};
export declare function proxyContract(contractToProxy: Contract, name: string, observers?: ContractObservers): Contract;
export declare function proxyWeb3Provider(provider: Web3Provider, observers?: TxObservers): Web3Provider;
export {};
//# sourceMappingURL=ethers.d.ts.map