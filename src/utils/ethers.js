const noop = () => {};

// export function virtualContracts(onContractsRequested, observers) {
//   observers = observers ? {...observers} : {};
//   observers = {
//     onContractTxRequested: observers.onContractTxRequested || noop,
//     onContractTxCancelled: observers.onContractTxCancelled || noop,
//     onContractTxSent: observers.onContractTxSent || noop,
//   }
//   const {onContractTxRequested, onContractTxCancelled, onContractTxSent} = observers;

//   const fakeContracts = {};
//   return new Proxy(fakeContracts, {
//     get: (obj, contractName) => {

//       if (prop === "functions") {
//         return functionsProxy;
//       } else if (contractToProxy.functions[prop]) {
//         return proxyCall(contractToProxy.functions, prop);
//       } else {
//         return obj[prop];
//       }
//     }
//   });
// }

export function proxyContract(contractToProxy, name, observers) {
  observers = observers ? {...observers} : {};
  observers = {
    onContractTxRequested: observers.onContractTxRequested || noop,
    onContractTxCancelled: observers.onContractTxCancelled || noop,
    onContractTxSent: observers.onContractTxSent || noop,
  };
  const {
    onContractTxRequested,
    onContractTxCancelled,
    onContractTxSent,
  } = observers;
  const proxies = {};

  const functionsInterface = contractToProxy.interface.functions;
  const nameToSig = {};
  for (const sig of Object.keys(functionsInterface)) {
    nameToSig[functionsInterface[sig].name] = sig;
  }

  const contract = {};
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

  function proxyCall(functions, methodName) {
    let callProxy = proxies[methodName];
    if (!callProxy) {
      let methodInterface = contractToProxy.interface.functions[methodName];
      if (!methodInterface) {
        methodInterface =
          contractToProxy.interface.functions[nameToSig[methodName]];
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
            hash: tx.hash,
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
    get: (functions, methodName) => {
      return proxyCall(contractToProxy.functions, methodName); // TODO empty
    },
  });

  return new Proxy(contract, {
    get: (obj, prop) => {
      if (prop === 'functions') {
        return functionsProxy;
      } else if (contractToProxy.functions[prop]) {
        return proxyCall(contractToProxy.functions, prop);
      } else if (prop === '_proxiedContract') {
        return contractToProxy;
      } else {
        return obj[prop]; // TODO prototype access ?
      }
    },
  });
}

function proxySigner(
  signer,
  applyMap,
  {
    onTxRequested,
    onTxCancelled,
    onTxSent,
    onSignatureRequested,
    onSignatureCancelled,
    onSignatureReceived,
  }
) {
  applyMap = Object.assign(
    {
      sendTransaction: async (method, thisArg, argumentsList) => {
        onTxRequested(argumentsList[0]);
        let tx;
        try {
          tx = await method.bind(thisArg)(...argumentsList);
        } catch (e) {
          onTxCancelled(argumentsList[0]);
          throw e;
        }
        onTxSent(tx);
        return tx;
      },
      signMessage: async (method, thisArg, argumentsList) => {
        onSignatureRequested(argumentsList[0]);
        let signature;
        try {
          signature = await method.bind(thisArg)(...argumentsList);
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
  const proxies = {};

  function getProxy(methodName, handler) {
    let proxy = proxies[methodName];
    if (!proxy) {
      proxy = new Proxy(signer[methodName], handler);
      proxies[methodName] = proxy;
    }
    return proxy;
  }

  return new Proxy(signer, {
    get: (obj, prop) => {
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

function proxyUncheckedJsonRpcSigner(signer, observers) {
  return proxySigner(signer, {}, observers);
}

function proxyJsonRpcSigner(signer, observers) {
  return proxySigner(
    signer,
    {
      connectUnchecked: (method, thisArg, argumentsList) => {
        const signer = method.bind(thisArg)(...argumentsList);
        return proxyUncheckedJsonRpcSigner(signer, observers);
      },
    },
    observers
  );
}

export function proxyWeb3Provider(provider, observers) {
  observers = observers ? {...observers} : {};
  observers = {
    onTxRequested: observers.onTxRequested || noop,
    onTxCancelled: observers.onTxCancelled || noop,
    onTxSent: observers.onTxSent || noop,
    onSignatureRequested: observers.onSignatureRequested || noop,
    onSignatureCancelled: observers.onSignatureCancelled || noop,
    onSignatureReceived: observers.onSignatureReceived || noop,
  };
  const getSignerProxy = new Proxy(provider.getSigner, {
    // TODO wallet.connect on demand if not Ready // error out if not accepted // special state ?
    apply: (getSigner, thisArg, argumentsList) => {
      const signer = getSigner.bind(provider)(...argumentsList);
      return proxyJsonRpcSigner(signer, observers);
    },
  });

  return new Proxy(provider, {
    get: (obj, prop) => {
      if (prop === 'getSigner') {
        return getSignerProxy;
      } else {
        return obj[prop];
      }
    },
  });
}
