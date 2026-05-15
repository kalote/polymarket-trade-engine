import { Env } from "./utils/config.ts";

const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
const FUNDER = Env.get("POLY_FUNDER_ADDRESS")!;  // 0x4ce1c...
const SIGNER = "0x1d6A70dE525d658A3B3CE2F17dd8ac881a29A6e3";
const PROXY  = "0x201B150b9DfE2ED0D3D96e4D04B31E7C5113Bc52";

// Check allowances for the exchanges from each wallet
const EXCHANGES = [
  "0xE111180000d2663C0091e4f400237545B87B996B",
  "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
  "0xe2222d279d744050d28e00520010520000310F59",
];

const { ethers } = await import("ethers");
const provider = new ethers.JsonRpcProvider("https://polygon-bor-rpc.publicnode.com");
const abi = ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"];
const pusd = new ethers.Contract(PUSD, abi, provider);

for (const [label, addr] of [["Funder", FUNDER], ["Signer", SIGNER], ["Proxy", PROXY]]) {
  const bal = await pusd.balanceOf(addr);
  console.log(`${label} (${addr}): ${ethers.formatUnits(bal, 6)} pUSD`);
  for (const ex of EXCHANGES) {
    const allow = await pusd.allowance(addr, ex);
    console.log(`  -> allowance for ${ex.slice(0,10)}...: ${ethers.formatUnits(allow, 6)}`);
  }
}
