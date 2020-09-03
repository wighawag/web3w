# Library to handle web3 wallets using a store / observable API

The main store is wallet.

![wallet](docs/diagrams/wallet/wallet.svg?raw=true)

Store to track injected EIP-1193 ethereum object :

![wallet](docs/diagrams/builtin/builtin.svg?raw=true)

Chain store

![chain](docs/diagrams/chain/chain.svg?raw=true)

# CheckPoint State

This library api is based on what we call "CheckPoint States".
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
  loading: boolean;
  error: {code: number; message: string};
  available?: boolean;
  vendor?: string;
};
```

The reason for this is to better handle such state on the UI side.

You usually do not update the whole UI when loading. Instead the UI remains in the general state (Idle) but show a loading indicator and then only switch to a new display when the wallet becomes ready.
