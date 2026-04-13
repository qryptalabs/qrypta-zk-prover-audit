# QRYPTA ZK Prover Audit Repository

This repository contains the off-chain proving components used to generate the proof payload that is later consumed by the QRYPTA verifier / contract flow under audit.

## Included scope

- `server.js`
  - Node.js API exposing `/prove` and `/status/:jobId`
  - Builds ABI-encoded public values when raw `publicValuesHex` is not supplied
  - Persists prover input for Rust host execution
  - Launches SP1 host prover and returns proof + canonical public values

- `qrypta-sp1/genesis-prover`
  - Rust host prover using SP1 SDK
  - Reads the guest ELF and ABI-encoded public values
  - Produces Groth16 proof bytes and proof-derived public values

- `qrypta-sp1/program`
  - SP1 zkVM guest program

## Important implementation note

The current guest program reads bytes from the host and commits them as public values.
It does not currently enforce higher-level business logic, PQC verification, signature verification, or payload validity checks inside the circuit itself.

## Operational note

The current prover deployment intentionally processes one proof job at a time.
This is a deliberate operational safeguard for the current VPS footprint, where proof generation is resource-intensive enough that concurrent executions may degrade stability and reliability.
This serialization is temporary capacity control, not the intended long-term scaling architecture.

## Out of scope

- Airdrop / faucet server
- Temporary operational scripts
- Backups and deployment artifacts
- Secrets and production credentials
