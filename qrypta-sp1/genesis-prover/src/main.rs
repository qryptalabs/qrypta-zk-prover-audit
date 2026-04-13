use anyhow::{Context, Result};
use sp1_sdk::{ProverClient, SP1Stdin};
use std::{env, fs};

fn main() -> Result<()> {
    let elf_path = env::var("ELF").context("Missing ELF env var")?;
    let genesis_dir = env::var("GENESIS_DIR").context("Missing GENESIS_DIR env var")?;
    let chain_id = env::var("CHAIN_ID").context("Missing CHAIN_ID env var")?;

    let pv_path = format!("{}/publicValues_{}.hex", genesis_dir, chain_id);

    let elf = fs::read(&elf_path).with_context(|| format!("Reading ELF: {}", elf_path))?;
    let pv_hex = fs::read_to_string(&pv_path).with_context(|| format!("Reading: {}", pv_path))?;
    let pv_hex = pv_hex.trim().strip_prefix("0x").unwrap_or(pv_hex.trim());
    let public_values_bytes = hex::decode(pv_hex).context("Decoding publicValues hex")?;

    let mut stdin = SP1Stdin::new();
    stdin.write(&public_values_bytes);

    let client = ProverClient::from_env();
    let (pk, _vk) = client.setup(&elf);

    let proof = client.prove(&pk, &stdin).groth16().run().context("Groth16 prove failed")?;

    let out_public_values = proof.public_values.as_slice();
    let solidity_proof = proof.bytes();

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
