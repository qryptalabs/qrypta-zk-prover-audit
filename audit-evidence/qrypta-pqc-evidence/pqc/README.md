# PQC Module — Dilithium2 (ML-DSA-44)

| Property       | Value                                              |
|----------------|----------------------------------------------------|
| Algorithm      | CRYSTALS-Dilithium2 / ML-DSA-44                    |
| Standard       | NIST FIPS 204                                      |
| Security Level | NIST Level 2 (128-bit PQC security)                |
| Public key     | 1312 bytes                                         |
| Secret key     | 2528 bytes                                         |
| Signature      | 2420 bytes                                         |
| Library        | pqcrypto-dilithium v0.5.0 (FFI to reference C impl)|

## Files

- `dilithium_sign_verify.rs` — Source of pqc-keygen, pqc-sign, pqc-verify
- `test_vector.json` — Real keypair + signature + pqcRoot from VPS
- `pqc_execution.log` — Actual VPS execution log

## Security

- Secret key NEVER leaves the user browser (localStorage)
- Server only receives publicKey + signature for verification
- pqcRoot = SHA256(publicKey) — permanent identity commitment

---

## Important Clarification for Auditors

> **The `pqcRoot` is an identity commitment derived from the Dilithium2 public key.**
>
> It does **not** encode transaction authorization.
>
> Transaction authorization is provided by a **Dilithium2 signature over the
> `transferPayload`** (which contains sender, recipient, amount, nonce, chainId,
> token, isoReference, and deadline).
>
> **ZK proofs bind both**: the identity (`pqcRoot`) and all transaction parameters
> into a single Groth16 proof verified on-chain by the SP1 gateway contract.

This is intentional by design:
- **Stable pqcRoot** → enables the smart contract to compare against a registered root
- **Per-tx signature** → proves the user authorized each specific transfer
- **ZK proof** → makes both tamper-proof and verifiable without revealing the secret key

See `integration/authorization_binding.md` for the complete flow.
