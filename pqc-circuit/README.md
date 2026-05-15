# Qrypta PQC-ZK Circuit — Audit Addendum for CertiK

## Overview

This repository contains the complete implementation of Qrypta's **Post-Quantum Cryptography (PQC) layer**, submitted to CertiK as an **addendum** to the previously audited `QryptaToken` smart contract.

> The `QryptaToken.sol` smart contract (including `quantumTransferZK()` and `registerQuantumKey()`) was already audited by CertiK. This addendum focuses exclusively on proving the cryptographic correctness of the **in-circuit ML-DSA-44 (NIST FIPS 204) signature verification** executed via a **Groth16 ZK proof using Succinct Labs' SP1 zkVM**.

---

## What This Proves

Qrypta executes **the first EVM-compatible, mainnet-deployed protocol** where:

1. A **NIST FIPS 204 ML-DSA-44** (Dilithium2) signature is verified **inside** a ZK circuit
2. The ZK circuit compiles to a **riscv32im ELF** and runs inside **SP1 zkVM** (Succinct Labs)
3. A **Groth16 proof** is generated and submitted on-chain
4. The **SP1 Groth16 verifier** (already integrated in `QryptaToken.sol`) validates the proof for fractions of a cent
5. This has been executed **live on BNB Chain (chainId=56) and Core DAO (chainId=1116) Mainnets**

---

## Repository Structure

```
qrypta-pqc-circuit/
├── circuit/           ← ZK Program (riscv32im ELF) — The core of the audit
│   ├── src/main.rs    ← ML-DSA-44 + SHA256 in-circuit verification
│   └── Cargo.toml     ← fips204 v0.4.6 (ML-DSA-44), sha2, sp1-zkvm 5.2.4
│
├── prover/            ← Rust host that generates the Groth16 proof
│   ├── src/main.rs    ← Feeds witnesses to SP1, writes proof to disk
│   ├── build.rs       ← Forces riscv32im target compilation
│   └── Cargo.toml     ← sp1-sdk 5.2.4
│
├── api/               ← Node.js orchestrator (Express server)
│   └── server.js      ← /prove endpoint: writes witnesses → invokes Rust prover
│
├── frontend/          ← Browser-side PQC implementation
│   ├── pqcKeyManager.ts    ← ML-DSA-44 key generation + signing (WASM)
│   └── PqcTransferApp.tsx  ← DApp component that assembles the PQC transfer
│
├── verifier/          ← Succinct Labs SP1 Groth16 verifier (on-chain)
│   ├── Groth16Verifier.sol
│   └── SP1VerifierGroth16.sol
│
├── artifacts/         ← Mainnet proof evidence
│   ├── proof_bnb_mainnet.hex
│   ├── proof_core_mainnet.hex
│   ├── publicValues_bnb_mainnet.hex
│   ├── publicValues_core_mainnet.hex
│   ├── programVKey.txt
│   └── elf_info.txt
│
└── docs/
    ├── ARCHITECTURE.md
    ├── public_values_layout.md
    ├── threat_model.md
    └── nist_compliance.md
```

---

## Key Parameters (NIST FIPS 204 — ML-DSA-44)

| Parameter | Value | Source |
|---|---|---|
| Algorithm | ML-DSA-44 (Dilithium2) | NIST FIPS 204 (August 2024) |
| Public Key Length | **1312 bytes** | FIPS 204, Section 5 |
| Signature Length | **2420 bytes** | FIPS 204, Section 5 |
| Security Level | **Category 2** (AES-128 equivalent) | NIST SP 800-57 |
| Rust Crate | `fips204 v0.4.6` | crates.io |
| Feature Flag | `ml-dsa-44` | Cargo.toml |
| Context String | `&[]` (empty) | FIPS 204, Algorithm 3 |
| Hash for pqcRoot | **SHA-256(publicKey)** | circuit/src/main.rs |

---

## On-Chain Verification Keys

| Network | Chain ID | programVKey | Contract |
|---|---|---|---|
| BNB Chain | 56 | `0x003457a9e5439f84f34a661756a0f5eaf6f53f7b65448ff98e418501d95d589f` | `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153` |
| Core DAO | 1116 | `0x003457a9e5439f84f34a661756a0f5eaf6f53f7b65448ff98e418501d95d589f` | `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153` |

> The `programVKey` is the **SHA256 of the SP1 program's verification key**, deterministically derived from the compiled ELF binary. It can be reproduced by running `cargo run --bin qrypta-genesis-prover` and reading the `vk.bytes32()` output.

---

## SP1 Version & Toolchain

| Component | Version |
|---|---|
| SP1 zkVM | **5.2.4** |
| SP1 Build target | `riscv32im-succinct-zkvm-elf` |
| Groth16 circuit | `sp1-gnark:v5.0.0` (Docker) |
| Succinct Labs | [github.com/succinctlabs/sp1](https://github.com/succinctlabs/sp1) |

---

## Mainnet Execution Evidence

| Network | Proof File | Public Values |
|---|---|---|
| BNB Chain (56) | `artifacts/proof_bnb_mainnet.hex` | `artifacts/publicValues_bnb_mainnet.hex` |
| Core DAO (1116) | `artifacts/proof_core_mainnet.hex` | `artifacts/publicValues_core_mainnet.hex` |

---

## Quick Start (Reproduce Locally)

```bash
# 1. Install SP1 toolchain
curl -L https://sp1up.succinct.xyz | bash && sp1up --version 5.2.4

# 2. Build the ZK circuit (compiles to riscv32im ELF)
cd circuit && cargo +succinct build --release

# 3. Run the genesis prover (generates Groth16 proof)
cd ../prover
ELF=../circuit/target/elf-compilation/riscv32im-succinct-zkvm-elf/release/program \
GENESIS_DIR=. CHAIN_ID=56 \
cargo run --release --bin qrypta-genesis-prover
```

---

## License
MIT — Provident Quantum Tech / Qrypta Labs
