# Audit Scope

## In scope
- `server.js`
- `package.json`
- `package-lock.json`
- `qrypta-sp1/genesis-prover/**`
- `qrypta-sp1/program/**`

## Out of scope
- `qrypta-airdrop/**`
- backup archives
- unrelated VPS services
- local caches and temporary artifacts

## Requested review areas
- End-to-end prover flow from API input to proof output
- ABI encoding and public-values construction
- Rust host prover integration with SP1 guest program
- Canonical public-values handling
- Trust boundary between off-chain prover and on-chain verifier
- Operational risks of single-flight proving on constrained hardware
- Any mismatch between claimed security properties and actual circuit behavior
