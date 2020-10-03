# web3w, a Library to handle web3 wallets using obsvervable states

## install and setup

`npm install web3w`

simple case:

```ts
import WalletStores from 'web3w';
const walletStores = WalletStores();
export const {wallet, builtin, chain, flow} = walletStores;
```

with contracts:

```ts
import WalletStores from 'web3w';
const walletStores = WalletStores({
  chainConfigs: contractsInfo,
  builtin: {autoProbe: true},
  options: ['builtin'],
});
export const {wallet, builtin, chain, flow} = walletStores;
```

## use

wallet, builtin, chain and flow exported variables above are observable. they have a `subscribe` member than expect a function and return itself a function (used to unsubscribe)

```ts
type Store<T> = {
  subsribe: (func: (newState: T) => void): () => void;
}
```

If you use them in `svelte` they are simply svelte store and you can benefit from the nice `svelte` syntax. If you use another framework, it should be easy to get them hooked up though.

All these `stores` start with default values.

The `wallet` store has functions to `connect(type: string)` or `disconnect`

The `flow` store is a special store than help you handle a flow.

A typical use case is you want to perform a operation when a user click a button. Let say you want to sell an NFT.

web3w allows you to set that up with one function call via the flow store:

```
<Button on:click="{flow.execute((contracts) => contracts.NFTSale.purchase(id))}">
```

This svelte snipset aboce is all you need to start making a transaction from the wallet.

This call will trigger a serie of state changes across the different stores if necesary.

If the wallet and chain stores are already in `Ready` state, the tx will simply trigger the wallet tx popup.

If they have not been invoked earlier, it will first set the `flow` store inProgress = true and if the options are multiple (wallet connect, metamask, torus), it will remain in progress until the user can chose one of the wallet.
It is then up to the frontend to handle that case.

Basicaly when `$flow.inProgress` is true, you can handle it on the UI side with a modal or whatever mechanism you want to let the user know of the step required to be able to perform the tx.

If the stores were setup with more than one wallet type, this involve asking the user which one to pick.

If the wallet chosen is on the wrong chain, it invloves asking the user to changes

etc...

See each stores variable to know what to act.

## the various stores

### wallet

The main store is wallet.

![wallet](docs/diagrams/wallet/wallet.svg?raw=true)

The wallet store is the main store you ll be interacting with.

It is also the one that include the action you can perform (connect, disconnect)

As you can see in the above diagram it start in the Idle state and can then move into Locked or Ready state. For many wallet, the Locked State is often never reachable and it brings you to the Ready state.

`$wallet.connecting` is true while web3w try to connect to the wallet account

`$wallet.options` contains the wallet options passed in the configuration. Useful to have the UI consider the choices.

`$wallet.selected` is set to the type of wallet currently being chosen (`builtin` or any web3w module, like walletconnect, etc...)

`$wallet.unlocking` is true while requesting the wallet to unlock the current account

`$wallet.address` will be the wallet address once, the wallet is Ready and unlocked

`$wallet.pendingConfirmation` is an array of string for each type of request being asked to the user. When its length is zero, nothign is being requested. if > 0, the user is expected to confirm a transaction or a message signature

### builtin

Store to track injected EIP-1193 ethereum object :

![builtin](docs/diagrams/builtin/builtin.svg?raw=true)

This store is used to check if a builtin wallet is present (metamask, Opera, Brave...).

The main reason web3w do not attempt to trigger that automatically in all circumstance is that some browser will bring a popup in front of the user when the window.ethereum object is accessed (even for just checking its presence)

`$builtin.probing` is true while web3w establish whether a builting web3 wallet is present

`$builting.available` is true if a builting wallet is present, false otherwise.

`$builtin.vendor` will contains the name of the builtin wallet if any.

### chain

Chain store

![chain](docs/diagrams/chain/chain.svg?raw=true)

The chain store has 3 main state

- Idle (start there)
- Connected : the chain is connected and the chainId is known. At that point web3w will attempt to load the contract (if provided as part of the config). If it fails because the chain is not supported or the contract info cannot be loaded, an error will be present but the chain will remain in the Connected state
- Ready : the chain is connected and the contract info is available. This also mean you can now call `wallet.contracts.<contractName>....`

`$chain.connecting` is true until the chainId is fetched. it becomes false if there is an error or if the connection succeed (in which case, the new state is `Connected`)

`$chain.loadingData` is true while the contract info is being loaded. it becomes false if there is any error or if the contracts get loaded, in which case, the new state is `Ready`

`$chain.chainId` will have the chain chainId

`$chain.notSupported` will be true if the chain currently connected do not have contracts configuation for it (if contracts are provided)

`$chain.contracts` is the same as `wallet.contracts`, the latter acting as a shortcut that do not necessitate a subbscribe call.

`$chain.addresses` contains the contracts addresses

`$chain.error` contains any error hapeninng in any if the 3 states.

### flow

Flow store

![flow](docs/diagrams/flow/flow.svg?raw=true)

The flow store is particular in that it act as an helper to manage a user flow automatically.

It can be used to execute a transaction via `flow.execute` or by simply requesting the wallet to be connected via `flow.connect`

`$flow.inProgress` will be true until the function is execited (for `flow.execute`) or until the wallet and chain stores are in `Ready` state (for `flow.connect`)

`flow.executing` will be true when the function (from `flow.execute`) is being executed.

`flow.executionError` will contains the error throw by `flow.execute` functiin (if any)

`flow.error` will contains any error that prevented the wallet/chain to be connected

## CheckPoint State

This library API is based on what we call "CheckPoint States".
Instead of having a state for every possible conditions. We only consider checkpoint states as "main" states.

CheckPoint States are valid state on which the application progress.
So instead of having

```
Idle -> Loading -> Error
                -> Ready
```

we have

```
Idle -> Ready
```

and loading and error are both substate of these checkpoint states.

In term of api, we represent error and loading as variable. So for example, the builtin store value type is as follow:

```
type BuiltinData & {
  state: 'Idle' | 'Ready';
  probing: boolean;
  error: {code: number; message: string};
  available?: boolean;
  vendor?: string;
};
```

The reason for this is to better handle such state on the UI side.

You usually do not update the whole UI when loading. Instead the UI remains in the general state (Idle) but show a loading indicator and then only switch to a new display when the wallet becomes ready.
