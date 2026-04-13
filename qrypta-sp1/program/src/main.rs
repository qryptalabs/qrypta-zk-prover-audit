#![no_main]

use sp1_zkvm::{entrypoint, io};

entrypoint!(main);

pub fn main() {
    // Lee input desde el host como bytes
    let input: Vec<u8> = io::read();

    // IMPORTANTE: commitea bytes crudos (sin prefijo de longitud)
    io::commit_slice(&input);
}
