import type {Contract, Overrides} from '@ethersproject/contracts';
import type {JsonRpcSigner, TransactionRequest, TransactionResponse, Web3Provider} from '@ethersproject/providers';
import {noop} from './internals';

type ContractObservers = {
  onContractTxRequested?: (tx: {name: string; method: string; overrides: Overrides; outcome: unknown}) => void;
  onContractTxCancelled?: (tx: {name: string; method: string; overrides: Overrides; outcome: unknown}) => void;
  onContractTxSent?: (tx: {hash: string; name: string; method: string; overrides: Overrides; outcome: unknown}) => void;
};

type StrictContractObservers = ContractObservers & {
  onContractTxRequested: (tx: {name: string; method: string; overrides: Overrides; outcome: unknown}) => void;
  onContractTxCancelled: (tx: {name: string; method: string; overrides: Overrides; outcome: unknown}) => void;
  onContractTxSent: (tx: {hash: string; name: string; method: string; overrides: Overrides; outcome: unknown}) => void;
};

type TxObservers = {
  onTxRequested?: (tx: TransactionRequest) => void;
  onTxCancelled?: (tx: TransactionRequest) => void;
  onTxSent?: (tx: TransactionResponse) => void;
  onSignatureRequested?: (msg: unknown) => void;
  onSignatureCancelled?: (msg: unknown) => void;
  onSignatureReceived?: (signature: string) => void;
};

type StrictTxObservers = TxObservers & {
  onTxRequested: (tx: TransactionRequest) => void;
  onTxCancelled: (tx: TransactionRequest) => void;
  onTxSent: (tx: TransactionResponse) => void;
  onSignatureRequested: (msg: unknown) => void;
  onSignatureCancelled: (msg: unknown) => void;
  onSignatureReceived: (signature: string) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export function proxyContract(contractToProxy: Contract, name: string, observers?: ContractObservers): Contract {
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
  const proxies: {[methodName: string]: AnyFunction} = {};

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

  function proxyCall(functions: {[methodName: string]: AnyFunction}, methodName: string) {
    let callProxy = proxies[methodName];
    if (!callProxy) {
      let methodInterface = contractToProxy.interface.functions[methodName];
      if (!methodInterface) {
        methodInterface = contractToProxy.interface.functions[nameToSig[methodName]];
      }

      callProxy = new Proxy(functions[methodName], {
        // TODO empty object (to populate later when contract is available ?)
        apply: async (method, thisArg, argumentsList) => {
          const numArguments = argumentsList.length;
          let overrides;
          if (
            numArguments === methodInterface.inputs.length + 1 &&
            typeof argumentsList[numArguments - 1] === 'object'
          ) {
            overrides = argumentsList[numArguments];
          }
          let outcome;
          if (overrides) {
            outcome = overrides.outcome;
            delete overrides.outcome;
          }
          onContractTxRequested({name, method: methodName, overrides, outcome});
          let tx;
          try {
            tx = await method.bind(functions)(...argumentsList);
          } catch (e) {
            onContractTxCancelled({
              name,
              method: methodName,
              overrides,
              outcome,
            }); // TODO id to identify?
            throw e;
          }
          onContractTxSent({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hash: (tx as any).hash,
            name,
            method: methodName,
            overrides,
            outcome,
          });
          return tx;
        },
      });
      proxies[methodName] = callProxy;
    }
    return callProxy;
  }
  const functionsProxy = new Proxy(contract.functions, {
    get: (functions, methodName: string) => {
      return proxyCall(contractToProxy.functions, methodName); // TODO empty
    },
  });

  return new Proxy(contract, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (obj: any, prop: string) => {
      if (prop === 'functions') {
        return functionsProxy;
      } else if (contractToProxy.functions[prop]) {
        return proxyCall(contractToProxy.functions, prop);
      } else if (prop === '_proxiedContract') {
        return contractToProxy;
      } else if (prop === 'connect') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (signer: any) => {
          return proxyContract(contractToProxy.connect(signer), name, observers);
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
        return obj[prop]; // TODO prototype access ?
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
        onTxRequested(argumentsList[0]);
        let tx: TransactionResponse;
        try {
          tx = (await method.bind(thisArg)(...argumentsList)) as TransactionResponse;
        } catch (e) {
          onTxCancelled(argumentsList[0]);
          throw e;
        }
        onTxSent(tx);
        return tx;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signMessage: async (method: AnyFunction, thisArg: any, argumentsList: any[]) => {
        onSignatureRequested(argumentsList[0]);
        let signature: string;
        try {
          signature = (await method.bind(thisArg)(...argumentsList)) as string;
        } catch (e) {
          onSignatureCancelled(argumentsList[0]);
          throw e;
        }
        onSignatureReceived(signature);
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
      } else if (prop === 'signMessage') {
        return getSignerProxy;
      } else if (prop === 'sendTransaction') {
        return getSignerProxy;
      } else if (prop === 'connectUnchecked') {
        return getSignerProxy;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (obj as any)[prop];
      }
    },
  });
}
