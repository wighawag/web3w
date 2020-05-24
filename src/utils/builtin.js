export function getEthereum() {
  if (typeof window !== 'undefined') {
      if (window.ethereum) {
          return window.ethereum;
      } else if (window.web3) {
          return window.web3.currentProvider;
      }
  }
  return null;
}

export function fetchEthereum() {
  // TODO test with document.readyState !== 'complete' || document.readyState === 'interactive'
  return new Promise((resolve, reject) => {
      if(document.readyState !== 'complete') {
          document.onreadystatechange = function() {
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

export function getVendor(ethereum) {
  if (!ethereum) {
      return undefined;
  } else if(ethereum.isMetaMask) {
      return 'Metamask';
  } else if(navigator.userAgent.indexOf("Opera") != -1 || navigator.userAgent.indexOf("OPR/") != -1) {
      return 'Opera';
  } else {
      return 'unknown';
  }
  // TODO
}
