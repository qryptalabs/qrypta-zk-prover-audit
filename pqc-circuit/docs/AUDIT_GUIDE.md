# CertiK Audit Addendum Guide

## Scope of This Audit

This is a **targeted addendum** to the previously audited `QryptaToken` smart contract.  
The scope is **exclusively** the post-quantum cryptographic layer:

| Component | In Scope |
|---|---|
| ZK Circuit (`circuit/src/main.rs`) | ✅ PRIMARY FOCUS |
| Genesis Prover (`prover/src/main.rs`) | ✅ |
| API Server (`api/server.js`) | ✅ |
| Frontend PQC (`frontend/pqcKeyManager.ts`) | ✅ |
| SP1 Groth16 Verifier contracts (`verifier/`) | ✅ (reference — from Succinct Labs) |
| `QryptaToken.sol` (ERC-20 + quantumTransferZK) | ❌ Already audited |

---

## Primary Focus: `circuit/src/main.rs`

This is the **cryptographic heart** of the system. The auditor should verify:

### Check 1 — Correct ML-DSA-44 Parameter Sizes
```rust
use fips204::ml_dsa_44::{PK_LEN, SIG_LEN};
// PK_LEN must equal 1312
// SIG_LEN must equal 2420
```
**Risk if wrong**: Wrong sizes would allow truncated keys/signatures to pass, bypassing security.

### Check 2 — SHA-256 Key Binding is Correct
```rust
let declared_pqc_root = &public_values[128..160];  // must be bytes 128..160
let computed_root = Sha256::digest(&pk_bytes);
assert_eq!(declared_pqc_root, computed_root.as_slice());
```
**Risk if wrong**: An attacker could substitute a different public key, breaking the binding to the on-chain registration.

### Check 3 — ML-DSA-44.verify() Uses Empty Context
```rust
let valid = pk.verify(&message, &sig_array, &[]);  // ctx = &[] is correct
```
**Risk if wrong**: Non-empty context would reject valid signatures from the frontend (which also uses `ctx = &[]`).

### Check 4 — publicValues Length Assertion
```rust
assert!(public_values.len() == 288, "publicValues must be exactly 288 bytes");
```
**Risk if wrong**: Partial publicValues could allow spoofing transfer parameters.

### Check 5 — io::commit_slice Output Binding
```rust
io::commit_slice(&public_values);
```
**Risk if wrong**: Without this, the proof would not be bound to the actual transfer parameters, allowing proof replay with different calldata.

---

## Verifying programVKey On-Chain

The `programVKey` is the SP1 verification key for the compiled ELF. It must match what is stored in the `QryptaToken` contract.

```bash
# To reproduce:
cd prover
ELF=../circuit/target/elf-compilation/riscv32im-succinct-zkvm-elf/release/program \
GENESIS_DIR=. CHAIN_ID=56 \
RUST_LOG=info cargo run --release --bin qrypta-genesis-prover 2>&1 | grep vkey

# Expected output:
# programVKey: 0x003457a9e5439f84f34a661756a0f5eaf6f53f7b65448ff98e418501d95d589f
```

To verify on-chain (BNB Chain):
- Contract: `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153`
- Function: `programVKey()` → must return `0x003457a9e5439f84f34a661756a0f5eaf6f53f7b65448ff98e418501d95d589f`
- BscScan: https://bscscan.com/address/0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153#readContract

---

## Verifying Mainnet Proof Artifacts

The files in `artifacts/` are real proofs generated on May 14, 2026.

### BNB Chain Proof
- File: `artifacts/proof_bnb_mainnet.hex`
- Public Values: `artifacts/publicValues_bnb_mainnet.hex`
- These can be replayed against the on-chain SP1 verifier

### Core DAO Proof  
- File: `artifacts/proof_core_mainnet.hex`
- Public Values: `artifacts/publicValues_core_mainnet.hex`

### Verification Script (Hardhat/Foundry)
```javascript
const verifier = await ethers.getContractAt("SP1VerifierGroth16", VERIFIER_ADDRESS);
const proof = fs.readFileSync("artifacts/proof_bnb_mainnet.hex", "utf8").trim();
const publicValues = fs.readFileSync("artifacts/publicValues_bnb_mainnet.hex", "utf8").trim();
const PROGRAM_VKEY = "0x003457a9e5439f84f34a661756a0f5eaf6f53f7b65448ff98e418501d95d589f";

// This should NOT revert if the proof is valid
await verifier.verifyProof(PROGRAM_VKEY, publicValues, proof);
```

---

## Expected Audit Findings (Addendum)

Based on the prior audit findings, this addendum is designed to formally mitigate **QRA-11**:

> *"QRA-11: The ZK circuit does not perform in-circuit verification of the PQC signature"*

**Resolution**: `circuit/src/main.rs` now performs:
1. `SHA256(pk) == pqcRoot` ← Closes the key-binding gap
2. `ML-DSA-44.verify(msg, sig, pk)` ← Full NIST FIPS 204 in-circuit verification

This makes the system **cryptographically complete** — no trust assumption on off-chain signature verification is required.
