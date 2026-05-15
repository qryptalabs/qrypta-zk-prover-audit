# Architecture: Qrypta PQC-ZK System

## Full Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (providentquantum.tech/pqc-transfer)                           │
│                                                                         │
│  pqcKeyManager.ts                                                       │
│  ├─ generatePQCKeyPair()   → WASM (fips204) → { publicKey, privateKey } │
│  ├─ registerQuantumKey()   → pqcRoot = SHA256(publicKey) → on-chain     │
│  └─ pqcSign(message, sk)   → ML-DSA-44.sign() → signature (2420 bytes)  │
│                                                                         │
│  PqcTransferApp.tsx                                                     │
│  └─ POST /prove {                                                       │
│       publicValuesHex,   ← 288 bytes ABI-encoded tuple (public)         │
│       messageHex,        ← signed message (private witness)             │
│       publicKey,         ← ML-DSA-44 public key 1312 bytes (private)   │
│       signature,         ← ML-DSA-44 signature 2420 bytes (private)    │
│     }                                                                   │
└───────────────────────────────────────────────────────────────────────┬─┘
                                                                        │ HTTPS
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VPS: api.providentquantum.tech (Nginx + Node.js :3001)                │
│                                                                         │
│  server.js                                                              │
│  ├─ Validates 288-byte publicValues structure                           │
│  ├─ Writes witness files to disk:                                       │
│  │    publicValues_{chainId}.hex  ← PUBLIC (goes on-chain)             │
│  │    message_{chainId}.hex       ← PRIVATE (never on-chain)           │
│  │    pubkey_{chainId}.hex        ← PRIVATE (never on-chain)           │
│  │    sig_{chainId}.hex           ← PRIVATE (never on-chain)           │
│  └─ Invokes Rust prover via cargo run                                   │
└───────────────────────────────────────────────────────────────────────┬─┘
                                                                        │
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RUST GENESIS PROVER (prover/src/main.rs)                              │
│                                                                         │
│  ├─ Reads publicValues (288 bytes) + 3 private witnesses                │
│  ├─ Constructs SP1Stdin:                                                │
│  │    stdin.write(&public_values_bytes)  → Block 1                     │
│  │    stdin.write(&msg_bytes)            → Block 2                     │
│  │    stdin.write(&pk_bytes)             → Block 3                     │
│  │    stdin.write(&sig_bytes)            → Block 4                     │
│  ├─ client.setup(&elf) → loads the riscv32im ELF                       │
│  └─ client.prove(&pk, &stdin).groth16().run() → Groth16 proof          │
└───────────────────────────────────────────────────────────────────────┬─┘
                                                                        │
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ZK CIRCUIT (circuit/src/main.rs) — riscv32im ELF inside SP1 zkVM     │
│                                                                         │
│  STEP 1 — Key Binding (SHA-256)                                        │
│  ├─ declared_pqc_root = public_values[128..160]                        │
│  ├─ computed_root     = SHA256(pk_bytes)                               │
│  └─ assert!(declared_pqc_root == computed_root)                        │
│       ↳ Proves: the private key corresponds to the on-chain pqcRoot    │
│                                                                         │
│  STEP 2 — NIST FIPS 204 Signature Verification (ML-DSA-44)            │
│  ├─ pk  = PublicKey::try_from_bytes([u8; 1312])                        │
│  ├─ sig = [u8; 2420]                                                   │
│  └─ assert!(pk.verify(&message, &sig, &[]))                            │
│       ↳ Proves: the ML-DSA-44 signature is mathematically valid        │
│                                                                         │
│  STEP 3 — Commit public values                                         │
│  └─ io::commit_slice(&public_values)                                   │
│       ↳ Binds proof output to the 288-byte transfer tuple              │
└───────────────────────────────────────────────────────────────────────┬─┘
                                                                        │
                           SP1 Groth16 Prover (Docker: sp1-gnark:v5.0.0)│
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  GROTH16 PROOF                                                          │
│  ├─ proof.hex          ← ~260 bytes (submitted on-chain)               │
│  └─ publicValues.hex   ← 288 bytes (submitted on-chain)               │
└───────────────────────────────────────────────────────────────────────┬─┘
                                                                        │
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SMART CONTRACT — QryptaToken.sol (already audited by CertiK)          │
│                                                                         │
│  function quantumTransferZK(                                            │
│    recipient, amount, publicValues, proofBytes, isoReference            │
│  ) {                                                                    │
│    // 1. Verify Groth16 proof via SP1VerifierGroth16                   │
│    sp1Verifier.verifyProof(PROGRAM_VKEY, publicValues, proofBytes)     │
│                                                                         │
│    // 2. Decode publicValues (288 bytes)                               │
│    //    Verifies sender, recipient, amount, nonce, pqcRoot, chainId   │
│                                                                         │
│    // 3. Execute ERC-20 transfer                                        │
│    _transfer(sender, recipient, amount)                                 │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Properties Enforced by the ZK Proof

| Property | Mechanism | Where |
|---|---|---|
| **Key authenticity** | SHA256(pk) == pqcRoot (on-chain) | circuit/src/main.rs:STEP1 |
| **Signature validity** | ML-DSA-44.verify() == true | circuit/src/main.rs:STEP2 |
| **Transfer binding** | publicValues committed in proof | circuit/src/main.rs:STEP3 |
| **Replay protection** | nonce in publicValues | QryptaToken.sol (audited) |
| **Chain isolation** | chainId in publicValues | prover/src/main.rs |
| **Privacy** | pk, sig, msg never on-chain | server.js + circuit |

## Why Groth16 (not STARK)?

Groth16 proofs are **~260 bytes constant size** and verify in **O(1) time on EVM**, making them the most gas-efficient proving system for on-chain verification. SP1 uses Docker-based `gnark` for the Groth16 prover, which is the same technology used by Zcash, Tornado Cash, and other production ZK protocols.
