# Public Values Layout — 288-Byte ABI-Encoded Tuple

## Overview

Every Qrypta quantum transfer encodes a **288-byte ABI-encoded tuple** that is:
1. Passed as private input to the ZK circuit (the circuit commits it as public output)
2. Submitted on-chain to `quantumTransferZK()` as `publicValues`
3. Verified by the SP1 Groth16 verifier to match the proof

## Solidity ABI Type

```solidity
abi.encode(
    address sender,      // 32 bytes (padded)
    address recipient,   // 32 bytes (padded)
    uint256 amount,      // 32 bytes
    uint256 nonce,       // 32 bytes
    bytes32 pqcRoot,     // 32 bytes = SHA-256(ML-DSA-44 public key)
    bytes32 isoRefHash,  // 32 bytes = keccak256(ISO 20022 reference string)
    uint256 chainId,     // 32 bytes (56=BNB, 1116=Core DAO)
    address token,       // 32 bytes (padded)
    uint256 deadline     // 32 bytes
)
// Total: 9 × 32 = 288 bytes
```

## Byte Map

| Bytes | Field | Type | Notes |
|---|---|---|---|
| `0 – 31` | `sender` | `address` | Left-padded to 32 bytes |
| `32 – 63` | `recipient` | `address` | Left-padded to 32 bytes |
| `64 – 95` | `amount` | `uint256` | In wei (18 decimals) |
| `96 – 127` | `nonce` | `uint256` | From `pqcNonces[sender]` on-chain |
| **`128 – 159`** | **`pqcRoot`** | **`bytes32`** | **= SHA-256(ML-DSA-44 publicKey)** |
| `160 – 191` | `isoRefHash` | `bytes32` | = keccak256(ISO 20022 JSON string) |
| `192 – 223` | `chainId` | `uint256` | 56 (BNB) or 1116 (Core DAO) |
| `224 – 255` | `token` | `address` | `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153` |
| `256 – 287` | `deadline` | `uint256` | Unix timestamp |

## How the Circuit Uses This

```rust
// circuit/src/main.rs
let public_values: Vec<u8> = io::read();  // 288 bytes

// Extract pqcRoot from bytes 128..160
let declared_pqc_root = &public_values[128..160];

// Verify SHA256(witness_public_key) == declared_pqcRoot
let computed_root = Sha256::digest(&pk_bytes);
assert_eq!(declared_pqc_root, computed_root.as_slice());
```

## ISO 20022 Integration

The `isoRefHash` field at bytes 160–191 anchors a full ISO 20022 financial message on-chain.

The reference string is built in the frontend (`PqcTransferApp.tsx`) and supports the following ISO 20022 message types:

| Code | Message Type | Use Case |
|---|---|---|
| `pacs.008` | Customer Credit Transfer | Standard payments between individuals/businesses |
| `pacs.009` | FI Credit Transfer | Interbank settlement |
| `pacs.002` | Payment Status Report | Accepted/rejected/pending status |
| `camt.054` | Credit/Debit Notification | Account credit notification |
| `camt.053` | Bank Statement | Electronic account statement |
| `camt.052` | Intraday Report | Real-time intraday movements |
| `tsmt.001` | Trade Service Initiation | Letter of credit / trade finance |
| `setr.004` | Redemption Order | Token redemption |
| `sese.023` | Securities Settlement (DVP) | Delivery vs. Payment |
| `caaa.001` | Card Payment | POS terminal payment |

The ISO reference is hashed with `keccak256()` before inclusion in `publicValues`, making it immutable and verifiable on-chain without exposing the full message in calldata.
