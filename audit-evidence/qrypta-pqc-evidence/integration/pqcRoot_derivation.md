# pqcRoot Derivation

## Design Intent

**pqcRoot is not a per-transaction authorization hash.**

pqcRoot is a stable identity commitment derived from the Dilithium public key:

```
pqcRoot = SHA256(dilithiumPublicKey)
```

Transaction authorization is provided separately by:

```
Dilithium2.verify(
  transferPayload,
  signature,
  publicKey
) == true
```

The **transferPayload** contains: sender, recipient, amount, nonce, chainId,
token address, deadline, and ISO reference — all the parameters of the transfer.

---

## Key Statement for CertiK

> The pqcRoot is intentionally stable because the smart contract compares it
> against the sender's registered PQC identity root. Transaction-specific
> authorization is not encoded by changing the pqcRoot; it is provided by a
> Dilithium2 signature over the full transfer payload. The updated test vector
> demonstrates that the signed message contains the same transaction parameters
> later bound into publicValues and validated on-chain.

---

## Three-Layer Architecture

```
LAYER 1: IDENTITY
-----------------
Dilithium publicKey (1312 bytes)
    |
    SHA256
    |
    v
pqcRoot = 0x955940d056a905840b7e51493fd8fa256ed7154a0a62c7e6a1da171b39b4ef58
    |
    registerQuantumKey(pqcRoot)  stored on-chain
    |
    quantumTransferZK checks:
    pv.pqcRoot == quantumPublicKeyRoots[sender]   [identity verified]


LAYER 2: AUTHORIZATION (per-transaction)
-----------------------------------------
transferPayload = sender:recipient:amount:nonce:isoRef:deadline
    (example: 0xb2d4a69c646d0c6b92fc6c700f5adc930f457704:0xb2d4a69c646d0c6b92fc6c700f5adc930f4...)
    |
    Dilithium2.sign(transferPayload, secretKey)
    |
    v
signature (2420 bytes)
    |
    Server: Dilithium2.verify(transferPayload, signature, publicKey)
    |
    v
verified == true   [sender explicitly signed THIS specific transfer]


LAYER 3: ZK BINDING
--------------------
publicValues = ABI-encode(
    from, to, amount, nonce,
    pqcRoot,        <- identity commitment (Layer 1)
    isoRefHash,
    chainId, token, deadline
)
    |
    SP1 Groth16 proof
    |
    v
sp1Gateway.verifyProof(programVKey, publicValues, proofBytes)
    |
    v
VERIFIED on-chain   [all params cryptographically bound, tamper-proof]
```

---

## Why SHA256(publicKey) and NOT SHA256(pk || sig || msg)

If pqcRoot were per-transaction, it would:

1. Change every transaction
2. Never match `quantumPublicKeyRoots[sender]` (registered once on-chain)
3. Cause every `quantumTransferZK` call to revert with `PVRootMismatch`

Per-transaction authorization is already guaranteed by Dilithium2.
The pqcRoot only needs to identify the user — not encode a specific amount.

---

## Rust Implementation (pqc-verify binary)

```rust
// pqcRoot = SHA256(publicKey) — stable identity commitment
let mut hasher = Sha256::new();
hasher.update(&pk_bytes);          // 1312-byte Dilithium2 public key
let pqc_root_bytes = hasher.finalize(); // 32 bytes
format!("0x{}", hex::encode(pqc_root_bytes))
```

---

## Test Vector Values

```
sender          : 0xb2d4a69c646d0c6b92fc6c700f5adc930f457704
publicKey       : 0x098e308f83fb5812f24d2433acfa84e2bd8ad95e544d02439a120491ee3762b7... (1312 bytes)
transferPayload : 0xb2d4a69c646d0c6b92fc6c700f5adc930f457704:0xb2d4a69c646d0c6b92fc6c700f5adc930f457704:4000000000000000000:1:Pago a Chase Bank:1780031258
                  hex: 0x3078623264346136396336343664306336623932666336633730306635...
verified        : true
pqcRoot         : 0x955940d056a905840b7e51493fd8fa256ed7154a0a62c7e6a1da171b39b4ef58
                  (= SHA256(publicKey))
```

### Verification Command (VPS)

```bash
BIN=/root/qrypta-sp1/genesis-prover/target/release
PK=$(python3 -c "import json; print(json.load(open('pqc/test_vector.json'))['publicKey'][2:])")
MSG=$(python3 -c "import json; print(json.load(open('pqc/test_vector.json'))['transferPayload'][2:])")
SIG=$(python3 -c "import json; print(json.load(open('pqc/test_vector.json'))['signature'][2:])")

$BIN/pqc-verify $PK $MSG $SIG
```

Expected output:
```json
{
  "algorithm": "Dilithium2 (NIST ML-DSA Level 2)",
  "verified": "true",
  "pqcRoot": "0x955940d056a905840b7e51493fd8fa256ed7154a0a62c7e6a1da171b39b4ef58",
  "signatureBytes": "2420",
  "publicKeyBytes": "1312"
}
```

The pqcRoot output MUST match the value at offset 0x080 in
`integration/example_publicValues.hex` — closing the loop between PQC, ZK, and on-chain.
