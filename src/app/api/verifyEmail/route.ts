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

export const dynamic = "force-dynamic";

const endpoint =
  process.env.DSTACK_SIMULATOR_ENDPOINT || "http://localhost:8090";

// function decryptWithPrivateKey(privateKey: string, encryptedMessage: string) {
//   return crypto.privateDecrypt(
//     privateKey,
//     Buffer.from(encryptedMessage, "base64"),
//   );
// }

export async function POST(request: NextRequest) {
  console.log(request);
  const { encryptedEmail } = await request.json();
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
  console.log(encryptedEmail);
  console.log(endpoint);
  const randomNumString = Math.random().toString();
  console.log(randomNumString);
  const getRemoteAttestation = await client.tdxQuote(randomNumString);
  return Response.json({ encryptedEmail, getRemoteAttestation });
}
