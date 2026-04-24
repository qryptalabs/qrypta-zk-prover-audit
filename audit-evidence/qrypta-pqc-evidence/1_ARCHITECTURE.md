# QRYPTA Architecture — PQC + ZK + On-Chain

## Full Flow

```
BROWSER
  1. ml_dsa44.keygen()  ->  publicKey (1312B) + secretKey (2528B)
  2. ml_dsa44.sign(transferMessage, secretKey)  ->  signature (2420B)
  3. POST /prove { sender, recipient, amount, nonce,
                   publicKey, signature, messageHex, isoReference }
        |
        v HTTPS
VPS PROVER SERVER
  4. pqc-verify binary (Rust / pqcrypto-dilithium):
       dilithium2::verify_detached_signature(sig, msg, pk)
       pqcRoot = SHA256(publicKey)
       -> { verified: true, pqcRoot: "0x..." }
  5. IF verified == false -> reject 400
  6. ABI-encode publicValues:
       abi.encode(from, to, amount, nonce, pqcRoot,
                  isoRefHash, chainId, token, deadline)
  7. SP1 circuit (program/src/main.rs):
       assert pqcRoot != 0x00
       io::commit_slice(&public_values)
       -> Groth16 proof
  8. Return { proof, publicValues }
        |
        v
BSC MAINNET (QryptaQuantumToken)
  9.  quantumTransferZK(recipient, amount, publicValues, proofBytes, isoRef)
  10. pv.pqcRoot == quantumPublicKeyRoots[sender]  <- PQC check
  11. sp1Gateway.verifyProof(programVKey, publicValues, proofBytes)
  12. Transfer + burn + ISO20022Transfer event
```

## Key Values

| Item           | Value                                                              |
|----------------|--------------------------------------------------------------------|
| Contract       | `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153`                      |
| programVKey    | `0x0049b846e38aa48aa52ffe48bb40032ea99afbfc8abde9c8130267c2585f870e` |
| Evidence TX    | `0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11` |

## pqcRoot Formula

```
pqcRoot = SHA256(dilithium2_publicKey)
        = bytes32 stored on-chain: registerQuantumKey(pqcRoot)
        = bytes32 in ZK proof publicValues at offset 128-159
        = verified: pv.pqcRoot == quantumPublicKeyRoots[sender]
```
