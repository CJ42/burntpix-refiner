import { JsonRpcProvider, Wallet, ethers } from "ethers";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const RPC_URL = process.env.RPC_URL as string;

// https://explorer.execution.mainnet.lukso.network/address/0x3983151E0442906000DAb83c8b1cF3f2D2535F82?tab=contract
const BURNT_PIX_REGISTRY = "0x3983151E0442906000DAb83c8b1cF3f2D2535F82";

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY as string);

const signer = wallet.connect(provider);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const main = async () => {
  if (process.argv.length <= 3) {
    console.error("Expected at least two argument!");
    process.exit(1);
  }

  const tokenId = process.env.npm_config_burntpix_id;
  const numberOfTx = process.env.npm_config_tx_count;

  if (tokenId == undefined || numberOfTx == undefined) {
    console.error(`❌ Invalid parameters provided \n - burntpix-id=${tokenId} \n - tx-count=${numberOfTx}`)
    return;
  }

  if (tokenId.length !== 66) {
    console.error("❌ Invalid parameter `burntpix-id` provided: must be a 32 bytes long tokenId identifier (64 characters prefixed with 0x)")
    return
  }

  const balance = await provider.getBalance(signer.address);

  console.log("--Sending", numberOfTx, "tx for 🖼️ BurntPix ID: ", tokenId);
  console.log("✍🏼 Wallet address used to refine: ", signer.address);
  console.log("👝 Balance left in wallet: ", ethers.formatEther(balance));
  console.log("-".repeat(50))

  const contract = new ethers.Contract(
    BURNT_PIX_REGISTRY,
    ["function refine(bytes32 tokenId, uint256 iters) external"],
    signer
  );

  let nonce = await provider.getTransactionCount(signer.address);

  for (let i = 0; i < parseInt(numberOfTx, 10); i++) {
    let tx = await contract.refine(tokenId, "500", {
      gasLimit: 15_000_000,
      nonce,
    });
    nonce++;

    await delay(1000);
    console.log("Refining a burntpix: ", tx);
  }

  console.log("✅ Done!") 
  console.log("- Total nb of transactions = ", numberOfTx);
  console.log("- Total nb of iterations = ", parseInt(numberOfTx, 10) * 500);
};

main();