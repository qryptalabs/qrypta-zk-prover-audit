# QRYPTA CertiK PQC Evidence Update

This repository includes an additional evidence package clarifying the PQC implementation.

The original submission focused on the SP1/Groth16 proving layer. This update adds the off-chain PQC authorization layer.

## Location

audit-evidence/qrypta-pqc-evidence/

## Key Points

- Dilithium2 signing and verification is implemented off-chain.
- pqcRoot is derived from the Dilithium public key as a stable identity commitment.
- transferPayload includes the full transaction parameters.
- The Dilithium2 signature verifies authorization of transferPayload.
- The ZK proof binds pqcRoot and transaction parameters into publicValues.
- The smart contract validates consistency and executes the transfer.

## Important Clarification

pqcRoot is a stable identity commitment derived from the Dilithium public key.

Transaction-specific authorization is not encoded by changing pqcRoot.

Transaction authorization is provided by a Dilithium2 signature over the full transferPayload.

ZK proofs bind both identity and transaction parameters into the on-chain verification flow.
