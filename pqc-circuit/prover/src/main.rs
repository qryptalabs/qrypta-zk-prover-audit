//! Qrypta Genesis Prover — SP1 Groth16 Host
//!
//! This binary runs on the host machine (x86_64 Linux).
//! It reads witness files from disk, feeds them to the SP1 zkVM circuit,
//! generates a Groth16 proof, and writes the proof to disk for the API server.
//!
//! ## Environment Variables
//!   ELF          — Path to the compiled riscv32im ELF (circuit binary)
//!   GENESIS_DIR  — Directory containing witness .hex files
//!   CHAIN_ID     — Target chain (56=BNB, 1116=Core DAO)
//!
//! ## Input Files (read from GENESIS_DIR)
//!   publicValues_{CHAIN_ID}.hex  ← 288-byte ABI-encoded public tuple
//!   message_{CHAIN_ID}.hex       ← Signed message (private witness)
//!   pubkey_{CHAIN_ID}.hex        ← ML-DSA-44 public key (private witness)
//!   sig_{CHAIN_ID}.hex           ← ML-DSA-44 signature (private witness)
//!
//! ## Output Files (written to GENESIS_DIR)
//!   proof_{CHAIN_ID}.hex                    ← Groth16 proof bytes (on-chain)
//!   publicValues_from_proof_{CHAIN_ID}.hex  ← Committed public values

use anyhow::{Context, Result};
use sp1_sdk::{ProverClient, SP1Stdin};
use std::{env, fs};

fn main() -> Result<()> {
    let elf_path     = env::var("ELF").context("Missing ELF env var")?;
    let genesis_dir  = env::var("GENESIS_DIR").context("Missing GENESIS_DIR env var")?;
    let chain_id     = env::var("CHAIN_ID").context("Missing CHAIN_ID env var")?;

    // ── Read public values (committed to proof — goes on-chain) ───────────────
    let pv_path = format!("{}/publicValues_{}.hex", genesis_dir, chain_id);
    let elf = fs::read(&elf_path)
        .with_context(|| format!("Reading ELF: {}", elf_path))?;
    let pv_hex = fs::read_to_string(&pv_path)
        .with_context(|| format!("Reading publicValues: {}", pv_path))?;
    let pv_hex = pv_hex.trim().strip_prefix("0x").unwrap_or(pv_hex.trim());
    let public_values_bytes = hex::decode(pv_hex)
        .context("Decoding publicValues hex")?;

    assert_eq!(
        public_values_bytes.len(), 288,
        "publicValues must be 288 bytes, got {}", public_values_bytes.len()
    );

    // ── Read private witnesses (message, pubkey, signature) ───────────────────
    // These NEVER leave the prover machine — they are private ZK inputs
    let msg_path = format!("{}/message_{}.hex",   genesis_dir, chain_id);
    let pk_path  = format!("{}/pubkey_{}.hex",    genesis_dir, chain_id);
    let sig_path = format!("{}/sig_{}.hex",       genesis_dir, chain_id);

    let msg_hex = fs::read_to_string(&msg_path)
        .with_context(|| format!("Reading message: {}", msg_path))?;
    let pk_hex  = fs::read_to_string(&pk_path)
        .with_context(|| format!("Reading pubkey: {}", pk_path))?;
    let sig_hex = fs::read_to_string(&sig_path)
        .with_context(|| format!("Reading signature: {}", sig_path))?;

    let msg_bytes = hex::decode(msg_hex.trim().strip_prefix("0x").unwrap_or(msg_hex.trim()))
        .context("Decoding message hex")?;
    let pk_bytes  = hex::decode(pk_hex.trim().strip_prefix("0x").unwrap_or(pk_hex.trim()))
        .context("Decoding pubkey hex")?;
    let sig_bytes = hex::decode(sig_hex.trim().strip_prefix("0x").unwrap_or(sig_hex.trim()))
        .context("Decoding signature hex")?;

    println!("publicValues: {} bytes", public_values_bytes.len());
    println!("message:      {} bytes", msg_bytes.len());
    println!("public_key:   {} bytes (expected {} for ML-DSA-44)", pk_bytes.len(), 1312);
    println!("signature:    {} bytes (expected {} for ML-DSA-44)", sig_bytes.len(), 2420);

    // ── Feed all inputs to the ZK circuit via SP1Stdin ───────────────────────
    // Order MUST match circuit/src/main.rs io::read() calls
    let mut stdin = SP1Stdin::new();
    stdin.write(&public_values_bytes); // Block 1: public values (committed)
    stdin.write(&msg_bytes);           // Block 2: message (private witness)
    stdin.write(&pk_bytes);            // Block 3: ML-DSA-44 public key (private witness)
    stdin.write(&sig_bytes);           // Block 4: ML-DSA-44 signature (private witness)

    // ── Generate Groth16 proof via SP1 ────────────────────────────────────────
    let client = ProverClient::from_env();
    let (pk, _vk) = client.setup(&elf);

    println!("Generating Groth16 proof (ML-DSA-44 verification inside ZK circuit)...");
    let proof = client.prove(&pk, &stdin).groth16().run()
        .context("Groth16 prove failed")?;

    let out_public_values = proof.public_values.as_slice();
    let solidity_proof    = proof.bytes();

    // ── Write outputs ──────────────────────────────────────────────────────────
    fs::write(
        format!("{}/publicValues_from_proof_{}.hex", genesis_dir, chain_id),
        format!("0x{}", hex::encode(out_public_values)),
    )?;
    fs::write(
        format!("{}/proof_{}.hex", genesis_dir, chain_id),
        format!("0x{}", hex::encode(&solidity_proof)),
    )?;

    println!(
        "OK chainId={} proofBytesLen={} publicValuesLen={}",
        chain_id,
        solidity_proof.len(),
        out_public_values.len()
    );
    println!("proof=0x{}", hex::encode(&solidity_proof));
    println!("publicValues=0x{}", hex::encode(&out_public_values));

    Ok(())
}
