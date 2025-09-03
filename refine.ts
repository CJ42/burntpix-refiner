import { JsonRpcProvider, Wallet, ethers } from "ethers";

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

// Function to get current spinner frame
const getSpinner = () => {
  return spinnerFrames[spinnerIndex];
};

// Function to start spinner
const startSpinner = () => {
  isRefining = true;
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    // Update the spinner line in place
    if (spinnerLine > 0) {
      process.stdout.cursorTo(0, spinnerLine);
      process.stdout.clearLine(0);
      process.stdout.write(`${getSpinner()} Refining in progress...`);
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

// Function to display header and table
const displayHeaderAndTable = (tokenId: string, numberOfTx: string, signerAddress: string, gasPrice: string, initialBalance: bigint, transactionsData: any[]) => {
  console.clear();
  console.log("-".repeat(100));
  console.log("🔀 Sending", numberOfTx, "tx for 🖼️ BurntPix ID: ", tokenId);
  console.log("🔑 Refiner wallet address: ", signerAddress);
  console.log("💵 Initial wallet balance: ", ethers.formatEther(initialBalance), "LYX");
  console.log("⛽️ Gas Price used (in gwei): ", gasPrice, "gwei");
  console.log("-".repeat(100));
  
  if (transactionsData.length > 0) {
    // Create table data with Operation Nb as first property
    const tableData = transactionsData.map((tx, index) => ({
      "Transaction Hash": tx["Transaction Hash"],
      "Block Number": tx["Block Number"],
      "Gas Used": tx["Gas Used"],
      "Refining Fee (LYX)": tx["Refining Fee (LYX)"],
      "Refiner Wallet Balance (LYX)": tx["Refiner Wallet Balance (LYX)"]
    }));
    
    // Use console.table with specific columns to show only what we want
    console.table(tableData, ["Transaction Hash", "Block Number", "Gas Used", "Refining Fee (LYX)", "Refiner Wallet Balance (LYX)"]);
  }
  
  if (isRefining) {
    spinnerLine = process.stdout.rows ? process.stdout.rows - 1 : 0;
  }
};

const main = async () => {
  if (process.argv.length <= 3) {
    console.error("Expected at least two argument!");
    process.exit(1);
  }

  // Get the arguments from the command line
  const tokenId = process.env.npm_config_burntpix_id;
  const numberOfTx = process.env.npm_config_tx_count;
  const gasPrice = process.env.npm_config_gas_price;

  if (tokenId == undefined || numberOfTx == undefined || gasPrice == undefined) {
    console.error(`❌ Invalid parameters provided \n - burntpix-id=${tokenId} \n - tx-count=${numberOfTx}`)
    return;
  }

  if (tokenId.length !== 66) {
    console.error("❌ Invalid parameter `burntpix-id` provided: must be a 32 bytes long tokenId identifier (64 characters prefixed with 0x)")
    return
  }

  const balance = await provider.getBalance(signer.address);

  const contract = new ethers.Contract(
    BURNT_PIX_REGISTRY,
    ["function refine(bytes32 tokenId, uint256 iters) external"],
    signer
  );

  let nonce = await provider.getTransactionCount(signer.address);
  const gasPriceInWei = ethers.parseUnits(`${gasPrice}`, "gwei");

  // Array to store all transaction data
  const transactionsData: any[] = [];
  let currentBalance = balance;

  // Display initial header
  displayHeaderAndTable(tokenId, numberOfTx, signer.address, gasPrice, balance, transactionsData);

  // Start the spinner
  startSpinner();

  for (let i = 0; i < parseInt(numberOfTx, 10); i++) {
    // Show refining in progress with continuous spinner
    displayHeaderAndTable(tokenId, numberOfTx, signer.address, gasPrice, balance, transactionsData);
    
    let tx = await contract.refine(tokenId, "1000", {
      gasLimit: 15_000_000,
      nonce,
      gasPrice: gasPriceInWei
    });
    nonce++;

    const receipt = await tx.wait()

    const { hash: txHash, blockNumber, gasUsed } = receipt

    // Calculate refining fee in LYX
    const refiningFeeInWei = gasUsed * gasPriceInWei;
    const refiningFeeInLYX = ethers.formatEther(refiningFeeInWei);
    
    // Update current balance
    currentBalance = currentBalance - refiningFeeInWei;
    const currentBalanceInLYX = ethers.formatEther(currentBalance);

    // Add transaction data to array
    transactionsData.push({
      "Transaction Hash": txHash,
      "Block Number": blockNumber,
      "Gas Used": gasUsed.toString(),
      "Refining Fee (LYX)": parseFloat(refiningFeeInLYX).toFixed(6),
      "Refiner Wallet Balance (LYX)": parseFloat(currentBalanceInLYX).toFixed(6)
    });

    // Display updated header and growing table
    displayHeaderAndTable(tokenId, numberOfTx, signer.address, gasPrice, balance, transactionsData);
  }

  // Stop the spinner when done
  stopSpinner();

  console.log("\n", "-".repeat(100));
  console.log("✅ BurntPix Refining Completed") 
  console.log("- Total nb of transactions = ", numberOfTx);
  console.log("- Total nb of iterations = ", parseInt(numberOfTx, 10) * 1000);
  console.log("- Final wallet balance = ", ethers.formatEther(currentBalance), "LYX");
};

main();