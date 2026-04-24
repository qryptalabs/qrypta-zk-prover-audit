# QRYPTA CertiK PQC Evidence Update

This repository includes an additional evidence package clarifying the PQC implementation.

The original submission focused on the SP1/Groth16 proving layer. This update adds the off-chain PQC authorization layer.

## Location

audit-evidence/qrypta-pqc-evidence/

## Key Points

- Dilithium2 signing and verification implemented off-chain
- pqcRoot derived from Dilithium public key (stable identity)
- transferPayload includes full transaction parameters
- signature verifies authorization of transferPayload
- ZK proof binds pqcRoot and transaction parameters into publicValues
- smart contract validates consistency and executes transfer

## Important Clarification

pqcRoot is a stable identity commitment derived from the Dilithium public key.

Transaction authorization is provided by a Dilithium2 signature over the full transfer payload.

ZK proofs bind both identity and transaction parameters into the on-chain verification flow.
