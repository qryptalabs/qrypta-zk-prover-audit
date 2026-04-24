# Reproducible Steps for CertiK Auditors

## Objective

This document demonstrates the QRYPTA hybrid PQC + ZK authorization flow:

1. Dilithium2 signs the full transfer payload off-chain.
2. Dilithium2 verification confirms authorization.
3. `pqcRoot = SHA256(dilithium2_publicKey)` acts as a stable on-chain identity commitment.
4. `publicValues` bind the identity and transfer parameters into the ZK verification flow.
5. The smart contract validates `pqcRoot`, transaction parameters, and the SP1/Groth16 proof.

## Transfer Payload Format

```text
sender:recipient:amount:nonce:chainId:token:isoReference:deadline
```

This includes:

- sender
- recipient
- amount
- nonce
- chainId
- token address
- ISO reference
- deadline

## Verify the Test Vector

From the repository root:

```bash
cd audit-evidence/qrypta-pqc-evidence

python3 - <<'PY'
import json

with open("pqc/test_vector.json") as f:
    d = json.load(f)

print("algorithm:", d["algorithm"])
print("verified:", d["verified"])
print("pqcRoot:", d["pqcRoot"])
print("publicKeyBytes:", d["publicKeyBytes"])
print("signatureBytes:", d["signatureBytes"])
print("transferPayloadDecoded:", d["transferPayloadDecoded"])
PY
```

Expected values:

```
verified: True
pqcRoot: 0x1f646140174722b52d3563107c0b78e383f244aae3754932920a52c80d9f265d
publicKeyBytes: 1312
signatureBytes: 2420
```

## Cryptographic Verification

The included test vector represents:

```
Dilithium2.verify(
  transferPayload,
  signature,
  publicKey
) == true
```

The `transferPayload` is not arbitrary data. It contains the full transfer context:

```
0xb2d4a69c646d0c6b92fc6c700f5adc930f457704:
0xb2d4a69c646d0c6b92fc6c700f5adc930f457704:
4000000000000000000:
1:
56:
0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153:
Pago a Chase Bank:
1780031258
```

## pqcRoot Derivation

```
pqcRoot = SHA256(dilithium2_publicKey)
```

For the included demo test vector:

```
0x1f646140174722b52d3563107c0b78e383f244aae3754932920a52c80d9f265d
```

## Real BSC Mainnet Transaction Evidence

The included mainnet transaction uses a different registered production keypair.

Real transaction `pqcRoot`:

```
0x802e1061f7ae45cb24c926585633ff5355deb7a45b88f33d30433df2590988c3
```

Transaction:

```
0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11
```

Network: BNB Smart Chain Mainnet  
Function: `quantumTransferZK`

## Authorization Chain

```
Dilithium2 publicKey
    |
    | SHA256
    v
pqcRoot
    |
    | registered on-chain
    v
quantumPublicKeyRoots[sender]

transferPayload
    |
    | Dilithium2.sign(...)
    v
signature
    |
    | Dilithium2.verify(...) == true
    v
off-chain authorization confirmed

pqcRoot + tx params
    |
    | encoded into publicValues
    v
SP1/Groth16 proof
    |
    | sp1Gateway.verifyProof(...)
    v
on-chain transfer execution
```

## Contract Validation

The smart contract validates:

- `pv.pqcRoot == quantumPublicKeyRoots[sender]`
- `pv.sender == msg.sender`
- `pv.recipient == recipient`
- `pv.amount == amount`
- `pv.nonce == nonce`
- `pv.chainId == block.chainid`
- `pv.token == address(this)`
- `pv.deadline >= block.timestamp`
- `sp1Gateway.verifyProof(programVKey, publicValues, proofBytes)`

## Result

- PQC authorization: valid
- pqcRoot identity binding: valid
- ZK publicValues binding: valid
- On-chain validation: valid
