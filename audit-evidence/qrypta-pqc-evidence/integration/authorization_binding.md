# Authorization Binding: Signature → Payload → publicValues

## The Bridge Between PQC and ZK

This document makes explicit how a Dilithium2 signature authorizes
a specific transfer and how that authorization flows into the ZK proof.

---

## Step 1 — What Gets Signed

The Dilithium2 signature is computed over `transferPayload`:

```
transferPayload = sender:recipient:amount:nonce:chainId:token:isoReference:deadline
```

Field breakdown:

| Field         | Value in Test Vector                           | Purpose                           |
|---------------|------------------------------------------------|-----------------------------------|
| sender        | 0xb2d4a69c646d0c6b92fc6c700f5adc930f457704 | Who is sending                    |
| recipient     | 0xb2d4a69c646d0c6b92fc6c700f5adc930f457704 | Who receives                      |
| amount        | 4000000000000000000 | How much (wei)           |
| nonce         | 1   | Anti-replay (per-user counter)    |
| chainId       | 56   | Anti-replay across chains (BSC)   |
| token         | 0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153 | Anti-replay across contracts      |
| isoReference  | Pago a Chase Bank         | ISO 20022 payment reference       |
| deadline      | 1780031258      | Time-bound authorization          |

By signing this payload, the sender proves they explicitly authorized
**this specific transfer** — not any other amount, recipient, or chain.

---

## Step 2 — What Gets Encoded into publicValues

The same fields are ABI-encoded into the `publicValues` tuple:

```
publicValues = abi.encode(
    from,           ← same as sender
    to,             ← same as recipient
    amount,         ← same as amount
    nonce,          ← same as nonce
    pqcRoot,        ← SHA256(publicKey) — identity of the signer
    isoRefHash,     ← keccak256(isoReference)
    chainId,        ← same as chainId
    token,          ← same as token
    deadline        ← same as deadline
)
```

---

## Step 3 — ZK Proof Binds Everything

The SP1 circuit commits `publicValues` as its public output:

```rust
io::commit_slice(&public_values); // 288 bytes
```

The Groth16 proof mathematically proves:
- The circuit ran with this exact `publicValues` as output
- Any modification (amount, recipient, pqcRoot, etc.) invalidates the proof

---

## The Complete Authorization Chain

```
transferPayload
  = sender:recipient:amount:nonce:chainId:token:isoRef:deadline
        │
        │  Dilithium2.sign(transferPayload, secretKey)
        ▼
signature (2420 bytes)
        │
        │  Server: Dilithium2.verify(transferPayload, signature, publicKey) == true
        ▼
AUTHORIZATION CONFIRMED ✓
        │
        │  pqcRoot = SHA256(publicKey) — registered on-chain identity
        │  Both pqcRoot + transferPayload fields → ABI-encoded into publicValues
        ▼
publicValues (288 bytes)
        │
        │  SP1 Groth16 proof: io::commit_slice(&public_values)
        ▼
proofBytes (Groth16)
        │
        │  Contract: pv.pqcRoot == quantumPublicKeyRoots[sender]  ← identity
        │  Contract: sp1Gateway.verifyProof(programVKey, publicValues, proof)  ← ZK
        ▼
TRANSFER EXECUTED ON-CHAIN ✓
```

---

## Why This Architecture is Sound

- **Authorization** — Dilithium2 signature proves the sender signed this exact payload
- **Identity** — pqcRoot links the publicKey to the on-chain sender address
- **Integrity** — ZK proof makes all parameters immutable post-signing
- **Anti-replay** — nonce + chainId + token prevent cross-chain and cross-contract replay
- **Auditability** — isoReference logged permanently on-chain (ISO 20022 compliant)

---

## Evidence

Real mainnet transaction where this flow completed successfully:

```
TX:       0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11
Block:    #94460793
Status:   SUCCESS
Gas:      316,147 (SP1 verifier ran on-chain)
ISO ref:  "Pago a Chase Bank" (logged permanently)
```

View: https://bscscan.com/tx/0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11
