import { JsonRpcProvider, Wallet, ethers } from "ethers";
import { decodeDataSourceWithHash } from "@erc725/erc725.js"

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const RPC_URL = process.env.RPC_URL as string;

// https://explorer.execution.mainnet.lukso.network/address/0x3983151E0442906000DAb83c8b1cF3f2D2535F82?tab=contract
const BURNT_PIX_REGISTRY = "0x3983151E0442906000DAb83c8b1cF3f2D2535F82";

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY as string);
const signer = wallet.connect(provider);

// Spinner animation frames
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;
let isRefining = false;
let spinnerInterval: NodeJS.Timeout | null = null;
let spinnerLine = 0;
let flameIndex = 0;
let flameDirection = 1; // 1 for growing, -1 for shrinking

// Function to get current spinner frame
const getSpinner = () => {
  return spinnerFrames[spinnerIndex];
};

// Function to get flame emojis
const getFlames = () => {
  const flames = ['🔥'.repeat(flameIndex)];
  return flames.join('');
};

// Function to start spinner
const startSpinner = () => {
  isRefining = true;
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    
    // Update flame animation
    flameIndex += flameDirection;
    if (flameIndex >= 20) {
      flameDirection = -1;
    } else if (flameIndex <= 0) {
      flameDirection = 1;
    }
    
    // Update the spinner line in place
    if (spinnerLine > 0) {
      process.stdout.cursorTo(0, spinnerLine);
      process.stdout.clearLine(0);
      process.stdout.write(`${getSpinner()} Refining in progress... ${getFlames()}`);
    }
  }, 100);
};

// Function to stop spinner
const stopSpinner = () => {
  isRefining = false;
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
};

// Get the arguments from the command line
function getCLIParams(): string[] {
  // required params
  const tokenId = process.env.npm_config_burntpix_id;
  
  // optional params
  let numberOfTx = process.env.npm_config_tx_count;
  let gasPrice = process.env.npm_config_gas_price; // TODO see below
  let iterations = process.env.npm_config_iterations;

  if (tokenId == undefined || gasPrice == undefined) {
    console.error(`❌ Invalid parameters provided \n - burntpix-id=${tokenId} \n - tx-count=${numberOfTx}`)
    return [];
  }

  // if no params provided, fallback to default gas price of the network
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
    iterations = "1000"
  }

  if (parseInt(iterations) > 2000) {
    console.error(`❌ Invalid \`--iterations\` flag value. Max allowed = 1000, provided: ${iterations}`)
    return []
  }

  if (tokenId.length !== 66) {
    console.error("❌ Invalid parameter `burntpix-id` provided: must be a 32 bytes long tokenId identifier (64 characters prefixed with 0x)")
    return []
  }

  return [ tokenId, numberOfTx, gasPrice, iterations ]
}

// Function to display header and table
const displayHeader = (tokenId: string, numberOfTx: string, signerAddress: string, gasPrice: string, iterations: string, initialBalance: bigint) => {
  console.clear();
  console.log("-".repeat(100));
  console.log("🖼️ BurntPix ID: ", tokenId)
  console.log("🔀 Number of tx: ", numberOfTx);
  console.log("🔑 Refiner wallet address: ", signerAddress);
  console.log("💵 Initial wallet balance: ", ethers.formatEther(initialBalance), "LYX");
  console.log("⛽️ Gas Price used (in gwei): ", gasPrice, "gwei");
  console.log("🔄 Nb of iterations / tx: ", iterations);
};

const displayTable = (transactionsData: any[]) => {
  if (transactionsData.length > 0) {
    // Create table data with Operation Nb as first property
    const tableData = transactionsData.map((tx, index) => ({
      "BurntPix Total Iterations": tx["BurntPix Total Iterations"],
      // "BurntPix Gas Consumed": tx["BurntPix Gas Consumed"],
      "Tx Gas Used": tx["Tx Gas Used"],
      "Refining Fee": tx["Refining Fee"],
      "Transaction Hash": tx["Transaction Hash"],
      "Refiner Wallet Balance": tx["Refiner Wallet Balance"]
    }));
    
    // Use console.table with specific columns to show only what we want
    console.table(tableData, ["BurntPix Total Iterations", "Tx Gas Used", "Refining Fee", "Transaction Hash", "Refiner Wallet Balance"]);
  }
  
  if (isRefining) {
    spinnerLine = process.stdout.rows ? process.stdout.rows - 1 : 0;
  }
}

const main = async () => {
  if (process.argv.length <= 3) {
    console.error("Expected at least two argument!");
    process.exit(1);
  }

  const cliParams = await getCLIParams();

  if (cliParams.length == 0) return;
  const [ tokenId, numberOfTx, gasPrice, iterations ] = cliParams;

  const balance = await provider.getBalance(signer.address);
  let nonce = await provider.getTransactionCount(signer.address);
  const gasPriceInWei = ethers.parseUnits(`${gasPrice}`, "gwei");

  const contract = new ethers.Contract(
    BURNT_PIX_REGISTRY,
    [
      "function refine(bytes32 tokenId, uint256 iters) external",
      "function getDataForTokenId(bytes32 tokenId, bytes32 dataKey) external view returns (bytes)"
    ],
    signer
  );

  // fetch the metadata of the burntPix to see the number of iterations
  // get the starting number of iterations for the burntpix
  // TODO: refactor to use `iterations()` function on the fractal
  const burntPixMetadataValue = await contract.getDataForTokenId.staticCall(
    tokenId,
    "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e" // LSP4Metadata
  );

  const decodedValue = decodeDataSourceWithHash(burntPixMetadataValue);
  const json = JSON.parse(decodedValue.url.replace('data:application/json;charset=UTF-8,', ""))
  const { LSP4Metadata: {attributes}} = json as any

  // TODO: add cumulated gas consumed by the burntpix
  const startingIterationsObject = (attributes as any[]).find(({ key }) => key == "Iterations")
  const startingIterations = startingIterationsObject.value

  // Array to store all transaction data
  const transactionsData: any[] = [];
  let currentBalance = balance;

  // Display initial header + spinner
  displayHeader(tokenId, numberOfTx, signer.address, gasPrice, iterations, balance);
  startSpinner();

  for (let i = 0; i < parseInt(numberOfTx, 10); i++) {
    // Show refining in progress with continuous spinner
    displayHeader(tokenId, numberOfTx, signer.address, gasPrice, iterations, balance);
    displayTable(transactionsData);

    try {
      const dryRun = await contract.refine.staticCall(tokenId, iterations, {
        gasLimit: 30_000_000, 
        nonce,
        gasPrice: gasPriceInWei
      });
      // console.log(dryRun)
      process.stdout.cursorTo(1);
      process.stdout.write(`${getSpinner()} Dispatching Refining transaction #${i + 1} - Hash = ...`)
    } catch (error) {
      stopSpinner()
      console.error("Could not refine tx. See error below:");

      const { info: {error: {code: errorCode} }} = error as any
      if (errorCode == -32000) {
        console.error("\t\t\t\t ↳ Out-of-refining-funds: not enough funds left in refining wallet")
      }
      console.error("Killing process...");
      return;
    }
    
    const tx = await contract.refine(tokenId, iterations, {
      gasLimit: 30_000_000, 
      nonce,
      gasPrice: gasPriceInWei
    });
    nonce++;

    const receipt = await tx.wait()

    const { hash: txHash, gasUsed } = receipt

    // Calculate refining fee in LYX
    const refiningFeeInWei = gasUsed * gasPriceInWei;
    const refiningFeeInLYX = ethers.formatEther(refiningFeeInWei);
    
    // Update current balance
    currentBalance = currentBalance - refiningFeeInWei;
    const currentBalanceInLYX = ethers.formatEther(currentBalance);

    // TODO: add total gas consumed
    // BUG it shows as last digits 25 instead of 24
    // Add transaction data to array
    transactionsData.push({
      "BurntPix Total Iterations": startingIterations + (parseInt(iterations) * i + 1),
      "Tx Gas Used": gasUsed.toString(),
      "Refining Fee": parseFloat(refiningFeeInLYX).toFixed(6) + " LYX",
      "Transaction Hash": txHash,
      "Refiner Wallet Balance": parseFloat(currentBalanceInLYX).toFixed(6) + " LYX"
    });

    // Display updated header and growing table
    displayHeader(tokenId, numberOfTx, signer.address, gasPrice, iterations, balance);
    displayTable(transactionsData);
  }

  // Stop the spinner when done
  stopSpinner();

  // print summary
  console.log("✅ BurntPix Refining Completed") 
  console.log("🔀 Total nb of transactions = ", numberOfTx);
  console.log("🔄 Total nb of iterations = ", parseInt(numberOfTx, 10) * parseInt(iterations));
  console.log("💵 Final refiner wallet balance = ", ethers.formatEther(currentBalance), "LYX");
};

main();