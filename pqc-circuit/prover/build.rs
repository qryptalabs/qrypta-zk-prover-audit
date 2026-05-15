// build.rs — Compiles the ZK circuit ELF during `cargo build`
// This ensures the riscv32im-succinct-zkvm-elf binary is always in sync
// with the circuit source before the host prover reads it.

fn main() {
    sp1_build::build_program("../circuit");
}
