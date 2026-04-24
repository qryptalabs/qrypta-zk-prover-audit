# Proof Reference

## SP1 Groth16 Proof — Real On-Chain Evidence

**TX:** `0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11`  
**Block:** #94460793 — Status: **SUCCESS**  
**Gas used:** 316,147 (confirms SP1 verifier executed on-chain)  
**programVKey:** `0x0049b846e38aa48aa52ffe48bb40032ea99afbfc8abde9c8130267c2585f870e`

## How to Extract Full Proof Bytes

```bash
# Via BSC RPC:
node -e "
const https = require('https');
const body = JSON.stringify({jsonrpc:'2.0',method:'eth_getTransactionByHash',
  params:['0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11'],id:1});
// POST to: bsc-dataseed1.binance.org
// Parse result.input -> ABI decode -> proofBytes parameter
"
```

## Groth16 Proof Structure

```
SP1 Groth16 proof components:
  - Version prefix: 4 bytes
  - A  (G1 point):  64 bytes
  - B  (G2 point): 128 bytes
  - C  (G1 point):  64 bytes
  Total: ~260 bytes
```

## Independent Verification

```solidity
// Any BSC node can verify this proof:
ISP1Verifier(0x...).verifyProof(
    0x0049b846e38aa48aa52ffe48bb40032ea99afbfc8abde9c8130267c2585f870e,
    publicValues,  // see zk/publicValues_from_proof.hex
    proofBytes     // from TX 0xb63f791...d11 calldata
);
```

## Why We Don't Include Raw Proof Bytes Here

The Groth16 proof is only meaningful together with its `publicValues` and `programVKey`.
The on-chain execution (Block #94460793, Status: SUCCESS) is the strongest proof of validity — the BSC network's consensus already verified it.

## Real proofBytes (from TX calldata)

Length: 260 bytes

```
a4594c591b01b687d0fcf6aa2980e4a295a71c9f1fe5957d39e2f4d0730c068e9d541dad302394fbdb72ac99e92b8af4e7d673f41d9608d2a33f2d85cc5188a50a6ece201e21ca25cc753aa9da22b59817c6afd129ce7a9d0563d0af12cbeecf8efadb3d2b3095dfb6ac29dd5af4d556093d938c7d691c86a3173521bfd4ba317efe48bc038da4c577c0c47169506f4bcdc3983ca58bba61548c3bfbd8533b2587341fe123f269a01b1e4cae19eb0d356d14e796a375ef61654dd238c24ec948b43931b20d0a856c9e92efa81ed15ee952e7fe20681e723e085d10b8906b4d7c27f127742a5951b17111307abc1f0352ea473efa194324d6c762e9217035fb388706d4b7
```
