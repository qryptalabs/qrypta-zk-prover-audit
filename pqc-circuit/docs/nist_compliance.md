# NIST FIPS 204 Compliance — ML-DSA-44 in Qrypta

## Standard Reference

- **Standard**: NIST FIPS 204 — Module-Lattice-Based Digital Signature Standard
- **Publication**: August 13, 2024 (Final)
- **Algorithm**: ML-DSA-44 (also known as Dilithium2 pre-standardization)
- **Category**: Post-Quantum Digital Signature

Official document: https://doi.org/10.6028/NIST.FIPS.204

---

## Algorithm Parameters (ML-DSA-44)

As defined in NIST FIPS 204, Table 1:

| Parameter | ML-DSA-44 | Notes |
|---|---|---|
| Security Category | 2 | AES-128 equivalent |
| `n` (ring dimension) | 256 | Cyclotomic polynomial |
| `q` (modulus) | 8,380,417 | Prime |
| `k` (rows in A) | 4 | Matrix dimension |
| `l` (cols in A) | 4 | Matrix dimension |
| `η` (secret key bound) | 2 | Coefficient bound |
| `τ` (ones in challenge) | 39 | Challenge polynomial |
| `γ₁` (y coefficient range) | 2^17 | Masking range |
| `γ₂` (low-order rounding) | (q-1)/88 | Rounding |
| `λ` (commitment bits) | 128 | Security bits |
| **Public Key size** | **1312 bytes** | Stored off-chain |
| **Signature size** | **2420 bytes** | Stored off-chain |
| **Private Key size** | 2528 bytes | Never leaves browser |

---

## How Qrypta Uses ML-DSA-44

### 1. Key Generation (Browser — pqcKeyManager.ts)
```typescript
// Uses fips204 WASM compiled from the same Rust crate
const keypair = ml_dsa_44.keygen();
// publicKey: Uint8Array(1312)
// privateKey: Uint8Array(2528)

// Registration: SHA256(publicKey) stored on-chain as pqcRoot
const pqcRoot = sha256(publicKey); // bytes32
await contract.registerQuantumKey(pqcRoot);
```

### 2. Signing (Browser — pqcKeyManager.ts)
```typescript
// Signs the transfer message with empty context (FIPS 204, Algorithm 2)
const signature = ml_dsa_44.sign(privateKey, message, ctx = new Uint8Array(0));
// signature: Uint8Array(2420)
```

### 3. In-Circuit Verification (circuit/src/main.rs — NIST Algorithm 3)
```rust
// Rust crate: fips204 v0.4.6, feature = "ml-dsa-44"
use fips204::ml_dsa_44::{PublicKey, PK_LEN, SIG_LEN};
use fips204::traits::Verifier;

// PK_LEN = 1312, SIG_LEN = 2420 — enforced at compile time
let pk_array: [u8; PK_LEN] = pk_bytes.try_into().unwrap();
let sig_array: [u8; SIG_LEN] = sig_bytes.try_into().unwrap();

let pk = PublicKey::try_from_bytes(pk_array).unwrap();
let valid = pk.verify(&message, &sig_array, &[]); // ctx = &[] per FIPS 204
assert!(valid, "ML-DSA-44 signature INVALID");
```

---

## Crate Provenance

The `fips204` Rust crate used in the ZK circuit:

- **Crate**: `fips204 v0.4.6`
- **Author**: Eric Schorn (NCC Group)
- **Repository**: https://github.com/integritychain/fips204
- **License**: MIT OR Apache-2.0
- **Audit note**: This is one of the reference implementations that closely follows the NIST FIPS 204 pseudocode. The `ml-dsa-44` feature enables exactly the parameter set audited herein.

Cargo.toml entry:
```toml
[dependencies]
fips204 = { version = "0.4.6", features = ["ml-dsa-44"] }
```

---

## ZK Circuit Enforcement

The ZK circuit (`circuit/src/main.rs`) enforces the following cryptographic invariants **before** generating the Groth16 proof:

### Invariant 1 — Key Binding
```
SHA-256(ml_dsa_44_public_key) == pqcRoot
```
- `pqcRoot` is the value stored on-chain by `registerQuantumKey()` (verified by the audited contract)
- This invariant prevents an attacker from substituting a different public key in the witness

### Invariant 2 — Signature Validity (FIPS 204, Algorithm 3 — `ML-DSA.Verify`)
```
ML-DSA-44.Verify(publicKey, message, signature, ctx="") == true
```
- Full mathematical verification of the lattice-based signature
- Any forgery attempt — including quantum computer-assisted forgery against ECDSA — would fail this check
- The security reduction guarantees hardness under **Module Learning With Errors (MLWE)** and **Module Short Integer Solution (MSIS)** problems

### Invariant 3 — Transfer Binding
```
io::commit_slice(&public_values)
```
- The Groth16 proof cryptographically binds the transfer parameters (sender, recipient, amount, nonce, chainId, pqcRoot) to the signature verification result
- No one can swap these parameters after proof generation

---

## Quantum Resistance

ML-DSA-44 is **immune to Shor's algorithm** (which breaks ECDSA/RSA) because its security relies on lattice problems (MLWE/MSIS), not discrete logarithm or integer factorization.

NIST projects that ML-DSA-44 maintains 128-bit classical security even assuming a cryptographically relevant quantum computer (CRQC) with **millions of physical qubits**.

By verifying ML-DSA-44 signatures inside a ZK circuit, Qrypta ensures that **even if an attacker possesses a quantum computer**, they cannot forge a valid transaction because:
1. They cannot produce a valid ML-DSA-44 signature without the private key (quantum-resistant hardness)
2. They cannot forge the ZK proof without the actual signature (Groth16 soundness — computational hardness under discrete log in pairing groups)
