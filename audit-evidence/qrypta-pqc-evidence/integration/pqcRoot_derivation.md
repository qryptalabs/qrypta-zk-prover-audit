# pqcRoot Derivation

## Definition

```text
pqcRoot = SHA256(dilithium2_publicKey)
```

`pqcRoot` is a stable identity commitment. It is not a per-transaction authorization hash.

## Authorization Model

Transaction authorization is provided by a Dilithium2 signature over the full transfer payload.

```text
transferPayload =
sender:recipient:amount:nonce:chainId:token:isoReference:deadline
```

Verification:

```
Dilithium2.verify(
  transferPayload,
  signature,
  publicKey
) == true
```

## Why pqcRoot Is Stable

The smart contract compares the submitted `pqcRoot` against the sender's registered PQC identity root:

```solidity
pv.pqcRoot == quantumPublicKeyRoots[sender]
```

Therefore, `pqcRoot` must remain stable for a registered Dilithium public key.

If `pqcRoot` were computed as `SHA256(publicKey || signature || message)`, it would change on
every transaction and would not match the registered on-chain root.

## Layered Model

```
Layer 1 — Identity:
    pqcRoot = SHA256(dilithium2_publicKey)

Layer 2 — Authorization:
    Dilithium2 signature over transferPayload

Layer 3 — ZK Binding:
    publicValues include pqcRoot and transaction parameters

Layer 4 — On-chain Enforcement:
    contract validates publicValues and SP1/Groth16 proof
```

## Demo Test Vector

The included demo test vector uses:

```
pqcRoot:
0x1f646140174722b52d3563107c0b78e383f244aae3754932920a52c80d9f265d
```

This value is derived from the included demo Dilithium2 public key.

## Real BSC Mainnet Transaction

The real mainnet transaction uses a different registered production keypair.

```
real TX pqcRoot:
0x802e1061f7ae45cb24c926585633ff5355deb7a45b88f33d30433df2590988c3
```

The demo root and real transaction root differ because they come from different Dilithium keypairs.

The invariant is the same:

```
pqcRoot = SHA256(dilithium2_publicKey)
```

## Key Statement for CertiK

> The `pqcRoot` is intentionally stable because the smart contract compares it against the
> sender's registered PQC identity root.
>
> Transaction-specific authorization is not encoded by changing `pqcRoot`.
>
> Transaction-specific authorization is provided by a Dilithium2 signature over the full
> `transferPayload`.
>
> The test vector demonstrates that the signed message contains the same transaction parameters
> later bound into `publicValues` and validated on-chain.
