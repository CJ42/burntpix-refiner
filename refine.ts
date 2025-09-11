import { JsonRpcProvider, Wallet, ethers } from "ethers";
import { decodeDataSourceWithHash } from "@erc725/erc725.js";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { getCLIParams } from "./src/cli";
import { getFlames, getSpinner, SPINNER_FRAMES } from "./src/animations";

const RPC_URL = process.env.RPC_URL as string;

// https://explorer.execution.mainnet.lukso.network/address/0x3983151E0442906000DAb83c8b1cF3f2D2535F82?tab=contract
const BURNT_PIX_REGISTRY = "0x3983151E0442906000DAb83c8b1cF3f2D2535F82";

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY as string);
const signer = wallet.connect(provider);

// Spinner animation frames
let spinnerIndex = 0;
let isRefining = false;
let spinnerInterval: NodeJS.Timeout | null = null;
let spinnerLine = 0;
let flameCount = 0;
let flameDirection = 1; // 1 for growing, -1 for shrinking

// Function to start spinner
const startSpinner = () => {
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % SPINNER_FRAMES.length;

    // Update flame animation
    flameCount += flameDirection;
    if (flameCount >= 20) {
      flameDirection = -1;
    } else if (flameCount <= 0) {
      flameDirection = 1;
    }

    // Update the spinner line in place
    if (spinnerLine > 0) {
      process.stdout.cursorTo(0, spinnerLine);
      process.stdout.clearLine(0);
      process.stdout.write(
        `${getSpinner(spinnerIndex)} Refining in progress... ${getFlames(
          flameCount
        )}`
      );
    }
  }, 100);
};

// Function to stop spinner
const stopSpinner = () => {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
};

// Function to display header and table
const displayHeader = (
  tokenId: string,
  numberOfTx: string,
  signerAddress: string,
  gasPrice: string,
  iterations: string,
  initialBalance: bigint
) => {
  console.clear();
  console.log("-".repeat(100));
  console.log("🖼️ BurntPix ID: ", tokenId);
  console.log("🔀 Number of tx: ", numberOfTx);
  console.log("🔑 Refiner wallet address: ", signerAddress);
  console.log(
    "💵 Initial wallet balance: ",
    ethers.formatEther(initialBalance),
    "LYX"
  );
  console.log("⛽️ Gas Price used (in gwei): ", gasPrice, "gwei");
  console.log("🔄 Nb of iterations / tx: ", iterations);
};

const displayTable = (transactionsData: any[]) => {
  if (transactionsData.length > 0) {
    // this is a workaround to transform the value of the index column from an index to a string showing `index/numberOfTx`
    // so we can keep track of the transactions we have left
    const tableData = transactionsData.reduce((acc, { jobNumber, ...x }) => {
      acc[jobNumber] = x;
      return acc;
    }, {});

    console.table(tableData, [
      "Cumulated Iterations",
      "Tx Gas Used",
      "Refining Fee",
      "Transaction Hash",
      "Refiner Wallet Balance",
    ]);
  }

  if (isRefining) {
    spinnerLine = process.stdout.rows ? process.stdout.rows - 1 : 0;
  }
};

const main = async () => {
  // TODO: use process.env.exit for cleaner stop
  const cliParams = getCLIParams();
  if (cliParams.length == 0) return;

  const [tokenId, numberOfTx, gasPrice, iterations] = cliParams;

  const balance = await provider.getBalance(signer.address);
  let nonce = await provider.getTransactionCount(signer.address);
  const gasPriceInWei = ethers.parseUnits(`${gasPrice}`, "gwei");

  const burntPixRegistry = new ethers.Contract(
    BURNT_PIX_REGISTRY,
    [
      "function refine(bytes32 tokenId, uint256 iters) external",
      "function getDataForTokenId(bytes32 tokenId, bytes32 dataKey) external view returns (bytes)",
    ],
    signer
  );

  const abiDecoder = ethers.AbiCoder.defaultAbiCoder();

  // const burntPixAsAddress =

  // retrieve the number of iterations of the burntPix we are starting at
  // const burntPixNft = new ethers.Contract(
  //   abiDecoder.decode(["address"], tokenId),
  //   ["function iterations() external view returns (uint256)"],
  //   signer
  // );

  // fetch the metadata of the burntPix to see the number of iterations
  // get the starting number of iterations for the burntpix
  // TODO: refactor to use `iterations()` function on the fractal
  // But put this code first in the LSP Recipes repository, with a final `console.log(attributes)`
  const burntPixMetadataValue =
    await burntPixRegistry.getDataForTokenId.staticCall(
      tokenId,
      "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e" // LSP4Metadata
    );

  const decodedValue = decodeDataSourceWithHash(burntPixMetadataValue);
  const json = JSON.parse(
    decodedValue.url.replace("data:application/json;charset=UTF-8,", "")
  );
  const {
    LSP4Metadata: { attributes },
  } = json as any;

  // TODO: add cumulated gas consumed by the burntpix
  const startingIterationsObject = (attributes as any[]).find(
    ({ key }) => key == "Iterations"
  );
  const startingIterations = startingIterationsObject.value;

  // Array to store all transaction data
  const transactionsData: any[] = [];
  let currentBalance = balance;

  // Display initial header + spinner
  displayHeader(
    tokenId,
    numberOfTx,
    signer.address,
    gasPrice,
    iterations,
    balance
  );
  isRefining = true;
  startSpinner();

  for (let i = 0; i < parseInt(numberOfTx, 10); i++) {
    // Show refining in progress with continuous spinner
    displayHeader(
      tokenId,
      numberOfTx,
      signer.address,
      gasPrice,
      iterations,
      balance
    );
    displayTable(transactionsData);

    try {
      const dryRun = await burntPixRegistry.refine.staticCall(
        tokenId,
        iterations,
        {
          gasLimit: 30_000_000,
          nonce,
          gasPrice: gasPriceInWei,
        }
      );
    } catch (error) {
      isRefining = false;
      stopSpinner();
      console.error("Could not refine tx. See error below:");

      // TODO: Display better errors instead on the whole object (if error from smart contract, out of funds, etc...)
      // eg: "\t\t\t\t ↳ Out-of-refining-funds: not enough funds left in refining wallet"
      console.error(error);
      console.error("Killing process...");
      return;
    }

    const tx = await burntPixRegistry.refine(tokenId, iterations, {
      gasLimit: 40_000_000,
      nonce,
      gasPrice: gasPriceInWei,
    });
    nonce++;

    const receipt = await tx.wait();

    const { hash: txHash, gasUsed } = receipt;

    // Calculate refining fee in LYX
    const refiningFeeInWei = gasUsed * gasPriceInWei;
    const refiningFeeInLYX = ethers.formatEther(refiningFeeInWei);

    // Update current balance
    currentBalance = currentBalance - refiningFeeInWei;
    const currentBalanceInLYX = ethers.formatEther(currentBalance);

    // TODO: add total gas consumed
    // BUG it shows as last digits 25 instead of 24. Probably a parse float issue
    // Add transaction data to array
    transactionsData.push({
      jobNumber: `Job #${i + 1}/${numberOfTx}`,
      "Cumulated Iterations":
        startingIterations + parseInt(iterations) * (i + 1),
      "Tx Gas Used": gasUsed.toString(),
      "Refining Fee": parseFloat(refiningFeeInLYX).toFixed(6) + " LYX",
      "Transaction Hash": txHash,
      "Refiner Wallet Balance":
        parseFloat(currentBalanceInLYX).toFixed(6) + " LYX",
    });

    // Display updated header and growing table
    displayHeader(
      tokenId,
      numberOfTx,
      signer.address,
      gasPrice,
      iterations,
      balance
    );
    displayTable(transactionsData);
  }

  // Stop the spinner when done
  isRefining = false;
  stopSpinner();

  // print summary
  console.log("✅ BurntPix Refining Completed");
  console.log("🔀 Total nb of transactions = ", numberOfTx);
  console.log(
    "🔄 Total nb of iterations = ",
    parseInt(numberOfTx, 10) * parseInt(iterations)
  );
  console.log(
    "💵 Final refiner wallet balance = ",
    ethers.formatEther(currentBalance),
    "LYX"
  );
};

main();
