"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyWeb3Provider = exports.proxyContract = void 0;
const internals_1 = require("./internals");
function proxyContract(contractToProxy, name, observers) {
    const actualObservers = observers
        ? Object.assign({ onContractTxRequested: internals_1.noop, onContractTxCancelled: internals_1.noop, onContractTxSent: internals_1.noop }, observers) : {
        onContractTxRequested: internals_1.noop,
        onContractTxCancelled: internals_1.noop,
        onContractTxSent: internals_1.noop,
    };
    const { onContractTxRequested, onContractTxCancelled, onContractTxSent } = actualObservers;
    const proxies = {};
    const functionsInterface = contractToProxy.interface.functions;
    const nameToSig = {};
    for (const sig of Object.keys(functionsInterface)) {
        nameToSig[functionsInterface[sig].name] = sig;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                methodInterface = contractToProxy.interface.functions[nameToSig[methodName]];
            }
            callProxy = new Proxy(functions[methodName], {
                // TODO empty object (to populate later when contract is available ?)
                apply: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
                    const numArguments = argumentsList.length;
                    let overrides;
                    if (numArguments === methodInterface.inputs.length + 1 &&
                        typeof argumentsList[numArguments - 1] === 'object') {
                        overrides = argumentsList[numArguments];
                    }
                    let outcome;
                    if (overrides) {
                        outcome = overrides.outcome;
                        delete overrides.outcome;
                    }
                    onContractTxRequested({ name, method: methodName, overrides, outcome });
                    let tx;
                    try {
                        tx = yield method.bind(functions)(...argumentsList);
                    }
                    catch (e) {
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
                        hash: tx.hash,
                        name,
                        method: methodName,
                        overrides,
                        outcome,
                    });
                    return tx;
                }),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (obj, prop) => {
            if (prop === 'functions') {
                return functionsProxy;
            }
            else if (contractToProxy.functions[prop]) {
                return proxyCall(contractToProxy.functions, prop);
            }
            else if (prop === '_proxiedContract') {
                return contractToProxy;
            }
            else if (prop === 'toJSON') {
                // TODO test
                return () => ({
                    address: contractToProxy.address,
                    abi: contractToProxy.interface.fragments,
                });
            }
            else {
                return obj[prop]; // TODO prototype access ?
            }
        },
    });
}
exports.proxyContract = proxyContract;
function proxySigner(signer, applyMap, { onTxRequested, onTxCancelled, onTxSent, onSignatureRequested, onSignatureCancelled, onSignatureReceived, }) {
    applyMap = Object.assign({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendTransaction: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
            onTxRequested(argumentsList[0]);
            let tx;
            try {
                tx = (yield method.bind(thisArg)(...argumentsList));
            }
            catch (e) {
                onTxCancelled(argumentsList[0]);
                throw e;
            }
            onTxSent(tx);
            return tx;
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signMessage: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
            onSignatureRequested(argumentsList[0]);
            let signature;
            try {
                signature = (yield method.bind(thisArg)(...argumentsList));
            }
            catch (e) {
                onSignatureCancelled(argumentsList[0]);
                throw e;
            }
            onSignatureReceived(signature);
            return signature;
        }),
    }, applyMap);
    const proxies = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getProxy(methodName, handler) {
        let proxy = proxies[methodName];
        if (!proxy) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            proxy = new Proxy(signer[methodName], handler);
            proxies[methodName] = proxy;
        }
        return proxy;
    }
    return new Proxy(signer, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (obj, prop) => {
            const applyFunc = applyMap[prop];
            if (applyFunc) {
                return getProxy(prop, {
                    apply: applyFunc,
                });
            }
            else {
                return obj[prop];
            }
        },
    });
}
function proxyUncheckedJsonRpcSigner(signer, observers) {
    return proxySigner(signer, {}, observers);
}
function proxyJsonRpcSigner(signer, observers) {
    return proxySigner(signer, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connectUnchecked: (method, thisArg, argumentsList) => {
            const signer = method.bind(thisArg)(...argumentsList);
            return proxyUncheckedJsonRpcSigner(signer, observers);
        },
    }, observers);
}
function proxyWeb3Provider(provider, observers) {
    const actualObservers = observers
        ? Object.assign({ onTxRequested: internals_1.noop, onTxCancelled: internals_1.noop, onTxSent: internals_1.noop, onSignatureRequested: internals_1.noop, onSignatureCancelled: internals_1.noop, onSignatureReceived: internals_1.noop }, observers) : {
        onTxRequested: internals_1.noop,
        onTxCancelled: internals_1.noop,
        onTxSent: internals_1.noop,
        onSignatureRequested: internals_1.noop,
        onSignatureCancelled: internals_1.noop,
        onSignatureReceived: internals_1.noop,
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
        get: (obj, prop) => {
            if (prop === 'getSigner') {
                return getSignerProxy;
            }
            else if (prop === 'signMessage') {
                return getSignerProxy;
            }
            else if (prop === 'sendTransaction') {
                return getSignerProxy;
            }
            else if (prop === 'connectUnchecked') {
                return getSignerProxy;
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return obj[prop];
            }
        },
    });
}
exports.proxyWeb3Provider = proxyWeb3Provider;
