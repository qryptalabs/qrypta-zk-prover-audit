# QRYPTA — PQC Evidence Overview
**Prepared for: CertiK Security Audit**  
**Date:** 2026-04-24  
**Chain:** BNB Smart Chain (BSC) Mainnet  
**Token:** QRYPTA (QRYP) — `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153`

---

## What QRYPTA Does

QRYPTA is a post-quantum-secured token on BNB Smart Chain. Every transfer
through `quantumTransferZK` requires:

1. A **Dilithium2 signature** (NIST ML-DSA-44, FIPS 204) from the sender's
   PQC keypair — verified off-chain by the prover server.
2. A **SP1 Groth16 ZK proof** that commits the `pqcRoot` cryptographically.
3. **On-chain SP1 gateway verification** of the proof and programVKey.

## Key Statement

> **"PQC is executed off-chain using Dilithium2 (CRYSTALS-Dilithium / NIST
> ML-DSA FIPS 204), while ZK proofs bind the resulting commitment (pqcRoot)
> to the on-chain verification flow."**

## Architecture Summary

| Layer       | Technology                          | Where              |
|-------------|-------------------------------------|--------------------|
| PQC         | Dilithium2 / ML-DSA-44 (FIPS 204)  | Off-chain (VPS)    |
| ZK          | SP1 + Groth16                       | Off-chain (VPS)    |
| Verification| SP1 gateway contract                | On-chain (BSC)     |
| Identity    | SHA256(publicKey) = pqcRoot         | On-chain + ZK      |

## Evidence Transaction

**TX:** `0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11`  
**Block:** #94460793 — **Status: SUCCESS**  
**Function:** `quantumTransferZK`  
**ISO 20022 Reference:** "Pago a Chase Bank" (logged permanently on-chain)  
**Gas used:** 316,147 (confirms SP1 verifier executed on-chain)

## File Structure

```
qrypta-pqc-evidence/
├── 0_OVERVIEW.md              ← this file
├── 1_ARCHITECTURE.md          ← full flow diagram
├── 2_REPRODUCIBLE_STEPS.md    ← runnable commands for auditors
├── pqc/
│   ├── README.md
│   ├── dilithium_sign_verify.rs  ← source of all 3 PQC binaries
│   ├── test_vector.json          ← real keypair + signature + pqcRoot
│   └── pqc_execution.log         ← real VPS execution output
├── integration/
│   ├── pqcRoot_derivation.md
│   ├── mapping_pqcRoot_to_publicValues.md
│   └── example_publicValues.hex
├── zk/
│   ├── program_main.rs           ← SP1 circuit source
│   ├── proof_sample.hex
│   └── publicValues_from_proof.hex
├── onchain/
│   └── validation_flow.md
└── logs/
    └── full_flow.log
```

---

## Important Design Clarification

> **The `pqcRoot` is intentionally stable** because the smart contract compares it
> against the sender's registered PQC identity root (`quantumPublicKeyRoots[sender]`).
>
> Transaction-specific authorization is **not** encoded by changing the `pqcRoot`.
> It is provided by a **Dilithium2 signature over the full transfer payload**.
>
> The `transferPayload` contains the same transaction parameters (sender, recipient,
> amount, nonce, chainId, token, deadline, isoReference) that are later bound into
> `publicValues` and validated on-chain.
>
> This architecture uses a **hybrid PQC + ZK model** that is both sound and defensible:
> - PQC signature → off-chain authorization
> - pqcRoot → on-chain identity commitment
> - Groth16 proof → cryptographic binding of both layers
