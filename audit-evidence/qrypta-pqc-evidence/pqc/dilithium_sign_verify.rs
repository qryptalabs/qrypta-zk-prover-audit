//! QRYPTA Dilithium2 PQC Binaries — Source Code
//! cargo build --release --bin pqc-keygen --bin pqc-sign --bin pqc-verify
//! Library: pqcrypto-dilithium v0.5.0

// === Cargo.toml ===
// [dependencies]
// pqcrypto-dilithium = "0.5"
// pqcrypto-traits = "0.3"
// sha2 = "0.10"
// hex = "0.4"
// serde_json = "1"

// ─── pqc-keygen (src/bin/pqc_keygen.rs) ─────────────────────────────────────
// use pqcrypto_dilithium::dilithium2;
// use pqcrypto_traits::sign::{PublicKey, SecretKey};
// use std::collections::HashMap;
// fn main() {
//     let (pk, sk) = dilithium2::keypair();
//     let mut out = HashMap::new();
//     out.insert("algorithm", "Dilithium2 (NIST ML-DSA Level 2)".to_string());
//     out.insert("publicKey",  hex::encode(pk.as_bytes()));
//     out.insert("secretKey",  hex::encode(sk.as_bytes()));
//     out.insert("publicKeyBytes", pk.as_bytes().len().to_string());
//     out.insert("secretKeyBytes", sk.as_bytes().len().to_string());
//     println!("{}", serde_json::to_string_pretty(&out).unwrap());
// }

// ─── pqc-sign (src/bin/pqc_sign.rs) ─────────────────────────────────────────
// use pqcrypto_dilithium::dilithium2;
// use pqcrypto_traits::sign::{DetachedSignature, SecretKey};
// use std::env;
// use std::collections::HashMap;
// fn main() {
//     let args: Vec<String> = env::args().collect();
//     let sk_bytes  = hex::decode(&args[1]).unwrap();
//     let msg_bytes = hex::decode(&args[2]).unwrap();
//     let sk = dilithium2::SecretKey::from_bytes(&sk_bytes).unwrap();
//     let signature = dilithium2::detached_sign(&msg_bytes, &sk);
//     let mut out = HashMap::new();
//     out.insert("algorithm",      "Dilithium2".to_string());
//     out.insert("signatureHex",   hex::encode(signature.as_bytes()));
//     out.insert("signatureBytes", signature.as_bytes().len().to_string());
//     println!("{}", serde_json::to_string_pretty(&out).unwrap());
// }

// ─── pqc-verify (src/bin/pqc_verify.rs) ──────────────────────────────────────
// use pqcrypto_dilithium::dilithium2;
// use pqcrypto_traits::sign::{DetachedSignature, PublicKey};
// use sha2::{Sha256, Digest};
// use std::env;
// use std::collections::HashMap;
// fn main() {
//     let pk_bytes  = hex::decode(&env::args().nth(1).unwrap()).unwrap();
//     let msg_bytes = hex::decode(&env::args().nth(2).unwrap()).unwrap();
//     let sig_bytes = hex::decode(&env::args().nth(3).unwrap()).unwrap();
//     let pk  = dilithium2::PublicKey::from_bytes(&pk_bytes).unwrap();
//     let sig = dilithium2::DetachedSignature::from_bytes(&sig_bytes).unwrap();
//     let valid = dilithium2::verify_detached_signature(&sig, &msg_bytes, &pk).is_ok();
//     // pqcRoot = SHA256(publicKey) — stable on-chain commitment
//     let mut h = Sha256::new();
//     h.update(&pk_bytes);
//     let root = h.finalize();
//     let mut out = HashMap::new();
//     out.insert("algorithm",    "Dilithium2 (NIST ML-DSA Level 2)".to_string());
//     out.insert("verified",     valid.to_string());
//     out.insert("pqcRoot",      format!("0x{}", hex::encode(root)));
//     out.insert("signatureBytes", sig_bytes.len().to_string());
//     out.insert("publicKeyBytes", pk_bytes.len().to_string());
//     println!("{}", serde_json::to_string_pretty(&out).unwrap());
// }
