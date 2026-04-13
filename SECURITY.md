# Security Notes

## Secrets
Do not commit:
- private keys
- wallet mnemonics
- production .env files
- RPC credentials
- internal passwords

## Known design notes
- The current guest circuit commits host-provided bytes as public values.
- The current production-like deployment uses one proof job at a time as a stability safeguard.
- The off-chain prover and on-chain verifier must be reviewed together for correct end-to-end security assumptions.
