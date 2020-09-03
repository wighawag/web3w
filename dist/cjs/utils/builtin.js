"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendor = exports.fetchEthereum = exports.getEthereum = void 0;
function getEthereum() {
    if (typeof window !== 'undefined') {
        const windowAsAny = window;
        if (windowAsAny.ethereum) {
            return windowAsAny.ethereum;
        }
        else if (windowAsAny.web3) {
            return windowAsAny.web3.currentProvider;
        }
    }
    return null;
}
exports.getEthereum = getEthereum;
function fetchEthereum() {
    // TODO test with document.readyState !== 'complete' || document.readyState === 'interactive'
    return new Promise((resolve) => {
        if (document.readyState !== 'complete') {
            document.onreadystatechange = function () {
                if (document.readyState === 'complete') {
                    document.onreadystatechange = null;
                    resolve(getEthereum());
                }
            };
        }
        else {
            resolve(getEthereum());
        }
    });
}
exports.fetchEthereum = fetchEthereum;
function getVendor(ethereum) {
    if (!ethereum) {
        return undefined;
    }
    else if (ethereum.isMetaMask) {
        return 'Metamask';
    }
    else if (navigator.userAgent.indexOf('Opera') != -1 ||
        navigator.userAgent.indexOf('OPR/') != -1) {
        return 'Opera';
    }
    else {
        return 'unknown';
    }
    // TODO
}
exports.getVendor = getVendor;
