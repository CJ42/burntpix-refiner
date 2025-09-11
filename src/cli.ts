import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const MAX_ITERATIONS_ALLOWED = 5000;

// Get the arguments from the command line
export function getCLIParams(): string[] {
  if (process.argv.length <= 3) {
    console.error("Expected at least two argument!");
    process.exit(1);
  }

  // required params
  const tokenId = process.env.npm_config_burntpix_id;
  const gasPrice = process.env.npm_config_gas_price;

  // optional params
  let numberOfTx = process.env.npm_config_tx_count;
  let iterations = process.env.npm_config_iterations;

  if (tokenId == undefined || gasPrice == undefined) {
    console.error(
      `❌ Invalid parameters provided \n - burntpix-id=${tokenId} \n - tx-count=${numberOfTx}`
    );
    return [];
  }

  // TODO: fallback to default gas price of the network if param not provided
  // if (gasPrice == undefined) {
  //   const networkGas = await provider.getFeeData()
  //   const gasPriceResult = networkGas.gasPrice;

  //   if (gasPriceResult == null) {
  //     throw new Error("Could not fetch default gas price from the network. Please provide a `--gas-price` flag")
  //   }

  //   console.log("result: ", gasPriceResult)
  //   throw new Error("aborting script...")
  //   return []
  // }

  if (numberOfTx == undefined) {
    numberOfTx = "100";
  }

  if (iterations == undefined) {
    iterations = "1000";
  }

  if (parseInt(iterations) > MAX_ITERATIONS_ALLOWED) {
    console.error(
      `❌ Invalid \`--iterations\` flag value. Max allowed = 5000, provided: ${iterations}`
    );
    return [];
  }

  if (tokenId.length !== 66) {
    console.error(
      "❌ Invalid parameter `burntpix-id` provided: must be a 32 bytes long tokenId identifier (64 characters prefixed with 0x)"
    );
    return [];
  }

  return [tokenId, numberOfTx, gasPrice, iterations];
}
