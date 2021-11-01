/* eslint-disable @typescript-eslint/no-explicit-any */

type Ethereum = any; // TODO?

export function getEthereum(): Ethereum {
  if (typeof window !== 'undefined') {
    const windowAsAny = window as any;
    if (windowAsAny.ethereum) {
      return windowAsAny.ethereum;
    } else if (windowAsAny.web3) {
      return windowAsAny.web3.currentProvider;
    }
  }
  return null;
}

export function fetchEthereum(): Promise<Ethereum> {
  // TODO test with document.readyState !== 'complete' || document.readyState === 'interactive'
  return new Promise((resolve) => {
    if (document.readyState !== 'complete') {
      document.onreadystatechange = function () {
        if (document.readyState === 'complete') {
          document.onreadystatechange = null;
          resolve(getEthereum());
        }
      };
    } else {
      resolve(getEthereum());
    }
  });
}

export function getVendor(ethereum: Ethereum): string | undefined {
  if (!ethereum) {
    return undefined;
  } else if (ethereum.isMetaMask) {
    return 'Metamask';
  } else if (ethereum.isFrame) {
    return 'Frame';
  } else if (
    (navigator as any).userAgent.indexOf('Opera') != -1 ||
    (navigator as any).userAgent.indexOf('OPR/') != -1
  ) {
    return 'Opera';
  } else {
    return 'unknown';
  }
  // TODO
}
