/* eslint-disable @typescript-eslint/no-explicit-any */
export function getEthereum() {
    if (typeof window !== 'undefined') {
        const windowAsAny = window;
        if (windowAsAny.ethereum) {
            windowAsAny.ethereum.autoRefreshOnNetworkChange = false;
            return windowAsAny.ethereum;
        }
        else if (windowAsAny.web3) {
            return windowAsAny.web3.currentProvider;
        }
    }
    return null;
}
export function fetchEthereum() {
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
export function getVendor(ethereum) {
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
//# sourceMappingURL=builtin.js.map