use sp1_sdk::{ProverClient, HashableKey};
use std::fs;

fn main() {
    // La ruta exacta de tu programa compilado
    let elf_path = "/home/perera93/qrypta-sp1/program/target/elf-compilation/riscv32im-succinct-zkvm-elf/release/program";
    
    println!("Leyendo el cerebro del programa (ELF)...");
    
    // Leemos el archivo
    let elf = fs::read(elf_path).expect("❌ ERROR: No encontré el archivo ELF en la ruta especificada.");
    
    // Generamos la VKEY
    let client = ProverClient::from_env();
    let (_, vk) = client.setup(&elf);
    
    println!("\n============================================");
    println!("🔑 TU NUEVA VKEY (Copiar para BscScan):");
    println!("{}", vk.bytes32());
    println!("============================================\n");
}
