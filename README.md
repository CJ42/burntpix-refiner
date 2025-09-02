# Simple Burntpix refining script

![Burntpix refiner image](./burntpix-refiner-image.webp)

Simple automated script to refine your favourite [burntpix](http://burntpix.com) on LUKSO! 

> _Set to 500 iterations with a gas limit of 15 millions gas units._

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


4. Run the following command with the right parameters. You can configure the gas price as you want in gwei.


```
npm run refine --burntpix-id=[burnt pix ID] --tx-count=[number of transactions] --gas-price=0.5
```