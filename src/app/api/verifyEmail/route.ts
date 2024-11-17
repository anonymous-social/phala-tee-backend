import { TappdClient } from "@phala/dstack-sdk";
import "dotenv/config";
import { NextRequest } from "next/server";
import { createVlayerClient, preverifyEmail } from "@vlayer/sdk";
import {
  getConfig,
  createContext,
  deployVlayerContracts,
} from "@vlayer/sdk/config";
// @ts-ignore
import proverSpec from "../../../../EmailProver";
// @ts-ignore
import verifierSpec from "../../../../EmailProofVerifier";
import { filterDKIMHeaders } from "@/app/lib/utils";
import { SignProtocolClient, SpMode, EvmChains } from "@ethsign/sp-sdk";
import { keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const dynamic = "force-dynamic";

const endpoint =
  process.env.DSTACK_SIMULATOR_ENDPOINT || "http://localhost:8090";

// function decryptWithPrivateKey(privateKey: string, encryptedMessage: string) {
//   return crypto.privateDecrypt(
//     privateKey,
//     Buffer.from(encryptedMessage, "base64"),
//   );
// }

const privateKey =
  "0x58b0402e54e4072fabac98782a4c58083bff90f384fa37dc0eb9c179f525f045";

export async function POST(request: NextRequest) {
  const signClient = new SignProtocolClient(SpMode.OnChain, {
    chain: EvmChains.sepolia,
    account: privateKeyToAccount(privateKey),
  });

  console.log(request);
  const { encryptedEmail, address } = await request.json();
  const processedEmail = filterDKIMHeaders(encryptedEmail);
  const unverifiedEmail = await preverifyEmail(processedEmail);
  const { prover, verifier } = await deployVlayerContracts({
    proverSpec,
    verifierSpec,
  });

  const config = getConfig();
  console.log("Prover URL:", config.proverUrl); // Add this log

  const { chain, ethClient, account, proverUrl, confirmations } =
    await createContext(config);

  console.log("Proving...");

  const vlayer = createVlayerClient({
    url: proverUrl,
  });
  const hash = await vlayer.prove({
    address: prover,
    proverAbi: proverSpec.abi,
    functionName: "main",
    chainId: chain.id,
    args: [unverifiedEmail],
  });
  const result = await vlayer.waitForProvingResult(hash);
  console.log("Proof:", result[0]);

  console.log("Verifying...");

  const txHash = await ethClient.writeContract({
    address: verifier,
    abi: verifierSpec.abi,
    functionName: "verify",
    args: result,
    chain,
    account: account,
  });

  await ethClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations,
    retryCount: 60,
    retryDelay: 1000,
  });

  console.log("Verified!");

  const client = new TappdClient(endpoint);
  // const testDeriveKey = await client.deriveKey("/", "test");
  // const keccakPrivateKey = keccak256(testDeriveKey.asUint8Array());
  // const email = decryptWithPrivateKey(keccakPrivateKey, encryptedEmail);
  console.log(endpoint);
  const randomNumString = Math.random().toString();
  console.log(randomNumString);
  const getRemoteAttestation = await client.tdxQuote(randomNumString);

  const res = await signClient.createAttestation({
    schemaId: "0x31d",
    data: { verifiedUser: address },
    indexingValue: "xxx",
  });

  console.log(res);

  return Response.json({ encryptedEmail, getRemoteAttestation });
}
