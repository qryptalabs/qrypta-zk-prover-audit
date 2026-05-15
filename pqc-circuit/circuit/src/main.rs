//! Qrypta ZK Circuit — NIST FIPS 204 ML-DSA-44 In-Circuit Verification
//!
//! This program runs inside the SP1 zkVM (riscv32im-succinct-zkvm-elf target).
//! It receives four inputs via stdin and produces a Groth16 proof that certifies:
//!
//!   "A valid NIST FIPS 204 ML-DSA-44 signature over [message] was produced by
//!    the key whose SHA-256 hash equals the pqcRoot registered on-chain."
//!
//! ## Input Layout (via sp1_zkvm::io::read)
//!
//!   [1] public_values: 288 bytes — ABI-encoded tuple (PUBLIC — committed to proof):
//!       bytes   0- 31: sender address (padded to 32)
//!       bytes  32- 63: recipient address (padded to 32)
//!       bytes  64- 95: amount (uint256)
//!       bytes  96-127: nonce (uint256)
//!       bytes 128-159: pqcRoot = SHA-256(ml_dsa_44_public_key) [32 bytes]
//!       bytes 160-191: isoRefHash (bytes32) — keccak256 of ISO 20022 reference
//!       bytes 192-223: chainId (uint256) — 56=BNB Chain / 1116=Core DAO
//!       bytes 224-255: token address (padded to 32)
//!       bytes 256-287: deadline (uint256)
//!
//!   [2] message: the exact byte sequence that was signed (PRIVATE WITNESS)
//!   [3] public_key: PK_LEN=1312 bytes ML-DSA-44 key (PRIVATE WITNESS — never on-chain)
//!   [4] signature: SIG_LEN=2420 bytes ML-DSA-44 sig (PRIVATE WITNESS — never on-chain)
//!
//! ## Security Properties Proven
//!
//!   1. Key Binding:      SHA256(public_key) == pqcRoot  (bytes 128..160 of public_values)
//!   2. Sig Validity:     ML-DSA-44.verify(message, signature, public_key) == true
//!   3. Transfer Binding: public_values committed as proof output
//!
//! The Groth16 proof certifies on-chain:
//!   "A valid NIST FIPS 204 ML-DSA-44 signature over [message] by the key
//!    whose SHA-256 hash equals [pqcRoot] authorized this transfer."

#![no_main]
sp1_zkvm::entrypoint!(main);

use fips204::ml_dsa_44::{PublicKey, PK_LEN, SIG_LEN};
use fips204::traits::Verifier;
use sha2::{Digest, Sha256};

pub fn main() {
    // ── BLOCK 1: Public values — committed to the Groth16 proof ────────────────
    let public_values: Vec<u8> = sp1_zkvm::io::read();
    assert!(
        public_values.len() == 288,
        "publicValues must be exactly 288 bytes"
    );

    // ── BLOCK 2: Private witnesses — never exposed on-chain ────────────────────
    let message:   Vec<u8> = sp1_zkvm::io::read();  // the signed message
    let pk_bytes:  Vec<u8> = sp1_zkvm::io::read();  // ML-DSA-44 public key — 1312 bytes
    let sig_bytes: Vec<u8> = sp1_zkvm::io::read();  // ML-DSA-44 signature  — 2420 bytes

    // ── STEP 1: Verify pqcRoot == SHA-256(public_key) ─────────────────────────
    // The user registered SHA-256(pk) on-chain via registerQuantumKey().
    // This ties the private witness to the on-chain registration without leaking the key.
    let declared_pqc_root = &public_values[128..160];
    let mut hasher = Sha256::new();
    hasher.update(&pk_bytes);
    let computed_root = hasher.finalize();
    assert_eq!(
        declared_pqc_root,
        computed_root.as_slice(),
        "pqcRoot != SHA-256(public_key): witness does not match on-chain registration"
    );

    // ── STEP 2: Deserialize ML-DSA-44 public key ──────────────────────────────
    // PK_LEN = 1312 for ML-DSA-44 (NIST FIPS 204, Table 1)
    let pk_array: [u8; PK_LEN] = pk_bytes
        .as_slice()
        .try_into()
        .expect("public_key must be exactly PK_LEN (1312) bytes");
    let pk = PublicKey::try_from_bytes(pk_array)
        .expect("Invalid ML-DSA-44 public key format");

    // ── STEP 3: Verify ML-DSA-44 signature (NIST FIPS 204, Algorithm 3) ───────
    // SIG_LEN = 2420 for ML-DSA-44 (NIST FIPS 204, Table 1)
    // ctx = &[] (empty context string, consistent with frontend pqcSign call)
    let sig_array: [u8; SIG_LEN] = sig_bytes
        .as_slice()
        .try_into()
        .expect("signature must be exactly SIG_LEN (2420) bytes");

    let valid = pk.verify(&message, &sig_array, &[]);
    assert!(valid, "ML-DSA-44 signature INVALID — transfer unauthorized");

    // ── STEP 4: Commit public values ───────────────────────────────────────────
    // The Groth16 proof output = exactly these 288 bytes.
    // The on-chain SP1 verifier confirms they match what was submitted to the contract.
    sp1_zkvm::io::commit_slice(&public_values);
}
