# Burntpix Refining script

![Burntpix refiner image](./img/burntpix-refiner-image.webp)

Automated script to refine your favourite [burntpix](http://burntpix.com) on LUKSO! See CLI options below 👇🏻

> _Set with a gas limit of 30 millions gas units._

## How to use it?

1. Clone this repository

```
git clone https://github.com/CJ42/burntpix-refiner.git
```

2. Install the dependencies by running the following command in your terminal

```
npm i
```

3. Create a `.env` file, copy the code snippet below and fill in your private key (without the `0x` prefix).

```
RPC_URL="https://rpc.mainnet.lukso.network"
PRIVATE_KEY=""
```

4. Refine your BurntPix with the command below. You can also use the options below for more fine grained configurations.


```
npm run refine --burntpix-id=[burnt pix ID] --gas-price=0.5
```

## Options

```bash
--burntpix-id  # [Required] `bytes32` token ID of the burnt pix to refine (left padded with 12 x `0x00` bytes)
--gas-price    # [Required] configure gas price per refining tx (in gwei)
--tx-count     # [Optional] total number of refining tx to run (default = 100)
--iterations   # [Optional] number of iterations per refining tx (default = 1,000)
```

# 🫡 Upcoming features

- [ ] styling and ASCII art in the terminal 💅🏻
- [x] new `--iterations` flag 🔄
- [x] display new total iterations of the burntpix ID for each row in the table
- [x] improve error handling by simulating tx and if failed, return error (prevent dispatching and wasting balance)
- [ ] make `--gas-price` flag optional, using default network gas price from network if not provided
- [ ] Retrieve the iterations and cumulated gas of the burntpix by calling the burntpix id using the `iterations()` and `gasUsed()` view function.
See the Solidity code of `fractal.sol` or in `registry.sol` contract.
https://explorer.execution.mainnet.lukso.network/address/0x3983151E0442906000DAb83c8b1cF3f2D2535F82?tab=contract_code
- [ ] Improve script efficiency by re-introducing the previously put `delay()` function with the timeout (dispatching a tx every second). Introduce with this a `--batch` flag (default to `10` tx dispatched to the network every 0.1 seconds)
- [ ] Improve codebase structure by putting everything in a `src/` folder broken down across multiple files

# 🛣️ Future roadmap

- [ ] Interactive CLI mode
  - [ ] Start / Stop