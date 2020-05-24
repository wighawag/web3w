export function watch(web3Provider) {
  async function checkAccounts(accounts) {
      if ($wallet.status === 'Locked' || $wallet.status === 'Unlocking') { // TODO SettingUpWallet ?
          return; // skip as Unlock / post-Unlocking will fetch the account
      }
      // log.info('checking ' + accounts);
      if (accounts && accounts.length > 0) {
          const account = accounts[0];
          if ($wallet.address) {
              if (account.toLowerCase() !== $wallet.address.toLowerCase()) {
                  reloadPage('accountsChanged', true);
              }
          } else {
              // if($wallet.readOnly) { // TODO check if it can reach there ?
              //     _ethSetup = eth._setup(web3Provider);
              // }
              let initialBalance;
              if(_fetchInitialBalance) {
                  initialBalance = await _ethSetup.provider.getBalance(account);
              }
              log.info('now READY');
              _set({
                  address: account,
                  status: 'Ready',
                  readOnly: undefined,
                  initialBalance,
              });
          }
      } else {
          if ($wallet.address) {
              // if($wallet.readOnly) {  // TODO check if it can reach there ?
              //     _ethSetup = eth._setup(web3Provider);
              // }
              _set({
                  address: undefined,
                  status: 'Locked',
                  readOnly: undefined,
              });
          }
      }
  }
  function checkChain(newChainId) {
      // log.info('checking new chain ' + newChainId);
      if ($wallet.chainId && newChainId != $wallet.chainId) {
          log.info('from ' + $wallet.chainId + ' to ' + newChainId);
          reloadPage('networkChanged');
      }
  }
  async function watchAccounts() {
      if ($wallet.status === 'WalletToChoose' || $wallet.status === 'Locked' || $wallet.status === 'Unlocking') {
          return; // skip as Unlock / post-Unlocking will fetch the account
      }
      let accounts;
      try {
          // log.trace('watching accounts...');
          accounts = await eth.fetchAccounts();
          // log.trace(`accounts : ${accounts}`);
      } catch (e) {
          log.error('watch account error', e);
      }

      await checkAccounts(accounts);
  }
  async function watchChain() {
      let newChainId;
      try {
          // log.trace('watching chainId...');
          newChainId = await eth.fetchBuiltinChainId();
          // log.trace(`newChainId : ${newChainId}`);
      } catch (e) {
          log.error('watch account error', e);
      }

      checkChain(newChainId);
  }

  if (web3Provider) { // TODO only if builtin is chosen // can use onNetworkChanged / onChainChanged / onAccountChanged events for specific web3 provuder setup
      try {
          web3Provider.once('accountsChanged', checkAccounts);
          web3Provider.once('networkChanged', checkChain);
          web3Provider.once('chainChanged', checkChain);
      } catch (e) {
          log.info('no web3Provider.once');
      }
  }

  // TODO move that into the catch block except for Metamask

  // still need to watch as even metamask do not emit the "accountsChanged" event all the time: TODO report bug
  setInterval(watchAccounts, 1000);

  // still need to watch chain for old wallets
  setInterval(watchChain, 2000);
}
