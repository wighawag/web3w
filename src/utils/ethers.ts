import type {Contract, PayableOverrides} from '@ethersproject/contracts';
import type {BigNumber, BigNumberish} from '@ethersproject/bignumber';
import type {JsonRpcSigner, TransactionResponse, Web3Provider} from '@ethersproject/providers';
import {noop} from './internals';
import {logs} from 'named-logs';
const logger = logs('web3w:ethers');

export type EventsABI = {
  anonymous: boolean;
  inputs: {indexed: boolean; internalType: string; name: string; type: string}[];
  name: string;
  type: 'event';
}[];

export type ContractTransaction = {
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

export type ContractTransactionSent = {hash: string} & ContractTransaction;

export type Transaction = {
  from: string;
  chainId: string;
  to?: string;
  nonce?: BigNumberish;
  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;
  data?: string;
  value?: BigNumberish;
};
export type TransactionSent = {
  submissionBlockTime: number;
  hash: string;
  from: string;
  chainId: string;
  to?: string;
  nonce: number;
  gasLimit: BigNumber;
  gasPrice: BigNumber;
  data: string;
  value: BigNumber;
};

export type SignatureRequest = {from: string; message: unknown};
export type SignatureResponse = {from: string; signature: string};

type ContractObservers = {
  onContractTxRequested?: (tx: ContractTransaction) => void;
  onContractTxCancelled?: (tx: ContractTransaction) => void;
  onContractTxSent?: (tx: ContractTransactionSent) => void;
};

type StrictContractObservers = ContractObservers & {
  onContractTxRequested: (tx: ContractTransaction) => void;
  onContractTxCancelled: (tx: ContractTransaction) => void;
  onContractTxSent: (tx: ContractTransactionSent) => void;
};

type TxObservers = {
  onTxRequested?: (txRequest: Transaction) => void;
  onTxCancelled?: (txRequest: Transaction) => void;
  onTxSent?: (tx: TransactionSent) => void;
  onSignatureRequested?: (sigRequest: SignatureRequest) => void;
  onSignatureCancelled?: (sigRequest: SignatureRequest) => void;
  onSignatureReceived?: (sigResponse: SignatureResponse) => void;
};

type StrictTxObservers = TxObservers & {
  onTxRequested: (txRequest: Transaction) => void;
  onTxCancelled: (txRequest: Transaction) => void;
  onTxSent: (tx: TransactionSent) => void;
  onSignatureRequested: (sigRequest: SignatureRequest) => void;
  onSignatureCancelled: (sigRequest: SignatureRequest) => void;
  onSignatureReceived: (sigResponse: SignatureResponse) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export function proxyContract(
  contractToProxy: Contract,
  name: string,
  chainId: string,
  observers?: ContractObservers
): Contract {
  logger.log('PROXY', {name});
  const actualObservers: StrictContractObservers = observers
    ? {
        onContractTxRequested: noop,
        onContractTxCancelled: noop,
        onContractTxSent: noop,
        ...observers,
      }
    : {
        onContractTxRequested: noop,
        onContractTxCancelled: noop,
        onContractTxSent: noop,
      };
  const {onContractTxRequested, onContractTxCancelled, onContractTxSent} = actualObservers;
  const functionProxies: {[methodName: string]: AnyFunction} = {};
  const proxies: {[methodName: string]: AnyFunction} = {};

  const eventsABI: EventsABI = contractToProxy.interface.fragments
    .filter((fragment) => fragment.type === 'event')
    .map((fragment) => JSON.parse(fragment.format('json')));

  const functionsInterface = contractToProxy.interface.functions;
  const nameToSig: {[name: string]: string} = {};
  for (const sig of Object.keys(functionsInterface)) {
    nameToSig[functionsInterface[sig].name] = sig;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract: {[field: string]: any} = {};
  for (const key of Object.keys(contractToProxy)) {
    // TODO populate when contract become available
    contract[key] = contractToProxy[key];
  }
  contract.functions = {};
  for (const key of Object.keys(contractToProxy.functions)) {
    contract.functions[key] = contractToProxy.functions[key];
  }

  // TODO remove:
  // contract._original = contractToProxy;

  function proxyCall(
    proxiesDict: {[methodName: string]: AnyFunction},
    functions: {[methodName: string]: AnyFunction},
    methodName: string
  ) {
    let callProxy = proxiesDict[methodName];
    if (!callProxy) {
      let methodInterface = contractToProxy.interface.functions[methodName];
      if (!methodInterface) {
        methodInterface = contractToProxy.interface.functions[nameToSig[methodName]];
      }

      callProxy = new Proxy(functions[methodName], {
        // TODO empty object (to populate later when contract is available ?)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apply: async (method, thisArg, argumentsList: any[]) => {
          const from = await contractToProxy.signer.getAddress();
          const numArguments = argumentsList.length;
          let args = argumentsList;
          let overrides;
          if (
            numArguments === methodInterface.inputs.length + 1 &&
            typeof argumentsList[numArguments - 1] === 'object'
          ) {
            args = args.slice(0, numArguments - 1);
            overrides = argumentsList[numArguments];
          }
          let metadata;
          if (overrides) {
            metadata = overrides.metadata;
            overrides = {...overrides}; // copy to preserve original object
            delete overrides.metadata;
          }
          onContractTxRequested({
            to: contractToProxy.address,
            from,
            chainId,
            eventsABI,
            contractName: name,
            args,
            method: methodName,
            overrides,
            metadata,
          });
          let tx;
          try {
            tx = await method.bind(functions)(...argumentsList);
          } catch (e) {
            onContractTxCancelled({
              to: contractToProxy.address,
              from,
              chainId,
              eventsABI,
              contractName: name,
              args,
              method: methodName,
              overrides,
              metadata,
            }); // TODO id to identify?
            throw e;
          }
          onContractTxSent({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hash: (tx as any).hash,
            to: contractToProxy.address,
            from,
            chainId,
            eventsABI,
            contractName: name,
            args,
            method: methodName,
            overrides,
            metadata,
          });
          return tx;
        },
      });
      proxiesDict[methodName] = callProxy;
    }
    return callProxy;
  }
  const functionsProxy = new Proxy(contract.functions, {
    get: (functions, methodName: string) => {
      return proxyCall(functionProxies, contractToProxy.functions, methodName); // TODO empty
    },
  });

  return new Proxy(contract, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (obj: any, prop: string) => {
      if (prop === 'functions') {
        return functionsProxy;
      } else if (contractToProxy.functions[prop]) {
        return proxyCall(proxies, contractToProxy, prop);
      } else if (prop === '_proxiedContract') {
        return contractToProxy;
      } else if (prop === 'connect') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (signer: any) => {
          return proxyContract(contractToProxy.connect(signer), name, chainId, observers);
        };
      } else if (prop === 'toJSON') {
        return () => ({
          address: contractToProxy.address,
          abi: contractToProxy.interface.fragments,
          functionsSignatures: contractToProxy.interface.fragments.map((f) => {
            return f.format('full');
          }),
        });
      } else {
        return contractToProxy[prop]; // TODO prototype access ?
      }
    },
  });
}

function proxySigner(
  signer: JsonRpcSigner,
  applyMap: Record<string, AnyFunction>,
  {
    onTxRequested,
    onTxCancelled,
    onTxSent,
    onSignatureRequested,
    onSignatureCancelled,
    onSignatureReceived,
  }: StrictTxObservers
) {
  applyMap = Object.assign(
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendTransaction: async (method: AnyFunction, thisArg: any, argumentsList: any[]) => {
        const from = await signer.getAddress();
        const chainId = await (await signer.getChainId()).toString();
        const txRequest = {...argumentsList[0], from, chainId};
        onTxRequested(txRequest);
        let tx: TransactionResponse;
        try {
          tx = (await method.bind(thisArg)(...argumentsList)) as TransactionResponse;
        } catch (e) {
          onTxCancelled(txRequest);
          throw e;
        }
        const latestBlock = await signer.provider.getBlock('latest');
        const submissionBlockTime = latestBlock.timestamp;
        onTxSent({...tx, submissionBlockTime, chainId});
        return tx;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signMessage: async (method: AnyFunction, thisArg: any, argumentsList: any[]) => {
        const from = await signer.getAddress();
        const sigRequest = {from, message: argumentsList[0]};
        onSignatureRequested(sigRequest);
        let signature: string;
        try {
          signature = (await method.bind(thisArg)(...argumentsList)) as string;
        } catch (e) {
          onSignatureCancelled(sigRequest);
          throw e;
        }
        onSignatureReceived({from, signature});
        return signature;
      },
    },
    applyMap
  );
  const proxies: {[methodName: string]: typeof Proxy} = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getProxy<T extends Record<string, any>>(methodName: string, handler: ProxyHandler<T>) {
    let proxy = proxies[methodName];
    if (!proxy) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proxy = new Proxy((signer as any)[methodName], handler);
      proxies[methodName] = proxy;
    }
    return proxy;
  }

  return new Proxy(signer, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (obj: any, prop: any) => {
      const applyFunc = applyMap[prop];
      if (applyFunc) {
        return getProxy(prop, {
          apply: applyFunc,
        });
      } else {
        return obj[prop];
      }
    },
  });
}

function proxyUncheckedJsonRpcSigner(signer: JsonRpcSigner, observers: StrictTxObservers) {
  return proxySigner(signer, {}, observers);
}

function proxyJsonRpcSigner(signer: JsonRpcSigner, observers: StrictTxObservers) {
  return proxySigner(
    signer,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connectUnchecked: (method: AnyFunction, thisArg: any, argumentsList: any[]) => {
        const signer: JsonRpcSigner = method.bind(thisArg)(...argumentsList) as JsonRpcSigner;
        return proxyUncheckedJsonRpcSigner(signer, observers);
      },
    },
    observers
  );
}

export function proxyWeb3Provider(provider: Web3Provider, observers?: TxObservers): Web3Provider {
  const actualObservers: StrictTxObservers = observers
    ? {
        onTxRequested: noop,
        onTxCancelled: noop,
        onTxSent: noop,
        onSignatureRequested: noop,
        onSignatureCancelled: noop,
        onSignatureReceived: noop,
        ...observers,
      }
    : {
        onTxRequested: noop,
        onTxCancelled: noop,
        onTxSent: noop,
        onSignatureRequested: noop,
        onSignatureCancelled: noop,
        onSignatureReceived: noop,
      };
  const getSignerProxy = new Proxy(provider.getSigner, {
    // TODO wallet.connect on demand if not Ready // error out if not accepted // special state ?
    apply: (getSigner, thisArg, argumentsList) => {
      const signer = getSigner.bind(provider)(...argumentsList);
      return proxyJsonRpcSigner(signer, actualObservers);
    },
  });

  return new Proxy(provider, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (obj, prop): any => {
      if (prop === 'getSigner') {
        return getSignerProxy;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (obj as any)[prop];
      }
    },
  });
}
