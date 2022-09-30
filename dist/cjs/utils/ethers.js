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
const named_logs_1 = require("named-logs");
const logger = named_logs_1.logs('web3w:ethers');
function proxyContract(contractToProxy, name, chainId, observers) {
    logger.log('PROXY', { name });
    const actualObservers = observers
        ? Object.assign({ onContractTxRequested: internals_1.noop, onContractTxCancelled: internals_1.noop, onContractTxSent: internals_1.noop }, observers) : {
        onContractTxRequested: internals_1.noop,
        onContractTxCancelled: internals_1.noop,
        onContractTxSent: internals_1.noop,
    };
    const { onContractTxRequested, onContractTxCancelled, onContractTxSent } = actualObservers;
    const functionProxies = {};
    const proxies = {};
    const eventsABI = contractToProxy.interface.fragments
        .filter((fragment) => fragment.type === 'event')
        .map((fragment) => JSON.parse(fragment.format('json')));
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
    function proxyCall(proxiesDict, functions, methodName) {
        let callProxy = proxiesDict[methodName];
        if (!callProxy) {
            let methodInterface = contractToProxy.interface.functions[methodName];
            if (!methodInterface) {
                methodInterface = contractToProxy.interface.functions[nameToSig[methodName]];
            }
            callProxy = new Proxy(functions[methodName], {
                // TODO empty object (to populate later when contract is available ?)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                apply: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
                    const from = yield contractToProxy.signer.getAddress();
                    const numArguments = argumentsList.length;
                    let args = argumentsList;
                    let overrides;
                    if (numArguments === methodInterface.inputs.length + 1 &&
                        typeof argumentsList[numArguments - 1] === 'object') {
                        args = args.slice(0, numArguments - 1);
                        overrides = argumentsList[numArguments - 1];
                    }
                    let metadata;
                    if (overrides) {
                        metadata = overrides.metadata;
                        overrides = Object.assign({}, overrides); // copy to preserve original object
                        delete overrides.metadata;
                    }
                    if (!overrides) {
                        overrides = {};
                    }
                    if (!overrides.nonce) {
                        overrides.nonce = yield contractToProxy.signer.getTransactionCount();
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
                        tx = yield method.bind(functions)(...args, overrides);
                    }
                    catch (e) {
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
                        hash: tx.hash,
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
                }),
            });
            proxiesDict[methodName] = callProxy;
        }
        return callProxy;
    }
    const functionsProxy = new Proxy(contract.functions, {
        get: (functions, methodName) => {
            return proxyCall(functionProxies, contractToProxy.functions, methodName); // TODO empty
        },
    });
    return new Proxy(contract, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (obj, prop) => {
            if (prop === 'functions') {
                return functionsProxy;
            }
            else if (contractToProxy.functions[prop]) {
                return proxyCall(proxies, contractToProxy, prop);
            }
            else if (prop === '_proxiedContract') {
                return contractToProxy;
            }
            else if (prop === 'connect') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (signer) => {
                    return proxyContract(contractToProxy.connect(signer), name, chainId, observers);
                };
                // TODO attach
            }
            else if (prop === 'toJSON') {
                return () => ({
                    address: contractToProxy.address,
                    abi: contractToProxy.interface.fragments,
                    functionsSignatures: contractToProxy.interface.fragments.map((f) => {
                        return f.format('full');
                    }),
                });
            }
            else {
                return contractToProxy[prop]; // TODO prototype access ?
            }
        },
    });
}
exports.proxyContract = proxyContract;
function proxySigner(signer, applyMap, { onTxRequested, onTxCancelled, onTxSent, onSignatureRequested, onSignatureCancelled, onSignatureReceived, }) {
    applyMap = Object.assign({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendTransaction: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
            const from = yield signer.getAddress();
            const chainId = yield (yield signer.getChainId()).toString();
            const txParams = Object.assign({}, argumentsList[0]);
            const extraArgs = argumentsList.slice(1);
            let { nonce } = txParams;
            if (!nonce) {
                nonce = txParams.nonce = yield signer.getTransactionCount();
            }
            const txRequest = Object.assign(Object.assign({}, txParams), { from, chainId, nonce });
            onTxRequested(txRequest);
            let tx;
            try {
                tx = (yield method.bind(thisArg)(txParams, ...extraArgs));
            }
            catch (e) {
                onTxCancelled(txRequest);
                throw e;
            }
            const latestBlock = yield signer.provider.getBlock('latest');
            const submissionBlockTime = latestBlock.timestamp;
            onTxSent(Object.assign(Object.assign({}, tx), { from, nonce, submissionBlockTime, chainId }));
            return tx;
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signMessage: (method, thisArg, argumentsList) => __awaiter(this, void 0, void 0, function* () {
            const from = yield signer.getAddress();
            const sigRequest = { from, message: argumentsList[0] };
            onSignatureRequested(sigRequest);
            let signature;
            try {
                signature = (yield method.bind(thisArg)(...argumentsList));
            }
            catch (e) {
                onSignatureCancelled(sigRequest);
                throw e;
            }
            onSignatureReceived({ from, signature });
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
            else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return obj[prop];
            }
        },
    });
}
exports.proxyWeb3Provider = proxyWeb3Provider;
//# sourceMappingURL=ethers.js.map