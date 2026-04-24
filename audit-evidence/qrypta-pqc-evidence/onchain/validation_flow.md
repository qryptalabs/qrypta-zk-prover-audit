# On-Chain Validation Flow

## Contract: QryptaQuantumToken
Address: `0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153`

## Function: quantumTransferZK

```solidity
function quantumTransferZK(
    address recipient,
    uint256 amount,
    bytes calldata publicValues,
    bytes calldata proofBytes,
    string calldata isoReference
) external returns (bool)
```

## Validation Steps

1. `quantumPublicKeyRoots[sender] != 0`  (must have registered PQC key)
2. `programVKey != 0`  (SP1 vkey must be configured)
3. `pv = abi.decode(publicValues, (PublicValues))`
4. `pv.from == msg.sender`
5. `pv.to == recipient`
6. `pv.amount == amount`
7. `pv.nonce == pqcNonces[sender]`  (anti-replay)
8. **`pv.pqcRoot == quantumPublicKeyRoots[sender]`**  <- PQC VERIFICATION
9. `pv.isoRefHash == keccak256(isoReference)`
10. `pv.chainId == block.chainid`
11. `pv.token == address(this)`
12. `block.timestamp <= pv.deadline`
13. **`sp1Gateway.verifyProof(programVKey, publicValues, proofBytes)`**  <- ZK
14. `pqcNonces[sender]++`
15. Transfer + burn 0.25% + emit ISO20022Transfer

## Security Properties

| Property           | Mechanism                                      |
|--------------------|------------------------------------------------|
| PQC auth           | Dilithium2 verified off-chain, pqcRoot on-chain|
| ZK binding         | Groth16 proof binds ALL publicValues fields    |
| Anti-replay        | pqcNonces[sender] increments per transfer      |
| Transfer integrity | All params in proof, verified on-chain         |
| ISO 20022          | isoReference hashed + logged in event forever  |

## Evidence

TX: `0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11`  
Block: #94460793 -- SUCCESS -- Gas: 316,147  
https://bscscan.com/tx/0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11
