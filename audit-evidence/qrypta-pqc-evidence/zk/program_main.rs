#![no_main]

use sp1_zkvm::{entrypoint, io};
use sha2::{Sha256, Digest};

entrypoint!(main);

/// QRYPTA ZK Circuit v2 — With PQC Root Verification
///
/// Public values layout (ABI-encoded tuple):
///   bytes 0-31:    from (address)
///   bytes 32-63:   to (address)
///   bytes 64-95:   amount (uint256)
///   bytes 96-127:  nonce (uint256)
///   bytes 128-159: pqcRoot (bytes32) — SHA256(dilithium2_publicKey)
///   bytes 160-191: isoRefHash (bytes32)
///   bytes 192-223: chainId (uint256)
///   bytes 224-255: token (address)
///   bytes 256-287: deadline (uint256)
///
/// The pqcRoot is verified OFF-CIRCUIT by the server using the real
/// Dilithium2 signature before this proof is generated.
/// The ZK proof COMMITS the pqcRoot as a public value, making it
/// cryptographically binding in the Groth16 proof.

pub fn main() {
    // Read the full ABI-encoded transfer tuple from host stdin
    let public_values: Vec<u8> = io::read();

    // Validate minimum length (288 bytes = 9 x 32-byte ABI fields)
    assert!(
        public_values.len() >= 288,
        "Public values too short: expected >= 288 bytes"
    );

    // Extract pqcRoot from bytes 128-159
    // This is the SHA256(dilithium2_publicKey) hash
    // verified by the server before this circuit is invoked
    let pqc_root = &public_values[128..160];

    // Verify pqcRoot is non-zero (placeholder check:
    // a zero pqcRoot means no real PQC signature was provided)
    let is_zero = pqc_root.iter().all(|&b| b == 0);
    assert!(!is_zero, "pqcRoot cannot be zero: real PQC signature required");

    // Commit ALL public values (including pqcRoot) as ZK proof outputs
    // The Groth16 proof will bind these values cryptographically
    io::commit_slice(&public_values);
}