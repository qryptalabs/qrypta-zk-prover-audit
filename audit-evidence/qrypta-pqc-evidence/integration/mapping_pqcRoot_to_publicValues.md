# Mapping: pqcRoot to publicValues

## ABI Encoding (288 bytes)

```
[0x000] from      address  32 bytes
[0x020] to        address  32 bytes
[0x040] amount    uint256  32 bytes
[0x060] nonce     uint256  32 bytes
[0x080] pqcRoot   bytes32  32 bytes  <-- SHA256(publicKey)
[0x0A0] isoRefHash bytes32 32 bytes
[0x0C0] chainId   uint256  32 bytes
[0x0E0] token     address  32 bytes
[0x100] deadline  uint256  32 bytes
```

## pqcRoot in Evidence TX

TX: `0xb63f79131e50c0005be6cbb65a080d47252dbb0440b24e8b5e0d798483221d11`

pqcRoot @ offset 0x080: `0x8dfb25fc402fd089ea2301b4a3daf27666f37d0fe10fbc5ed812bea1e3df7fa4`

## SP1 Circuit Access

```rust
let pqc_root = &public_values[128..160];
assert!(!pqc_root.iter().all(|&b| b == 0), "pqcRoot cannot be zero");
io::commit_slice(&public_values);
```
