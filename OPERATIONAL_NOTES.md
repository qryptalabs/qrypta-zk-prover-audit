# Operational Notes

## Single-flight proving
The prover accepts one active proving job at a time in the current VPS deployment.

### Reason
Proof generation is resource-intensive on the current infrastructure.
Allowing concurrent proving jobs risks:
- CPU / memory exhaustion
- degraded service reliability
- higher timeout probability
- operational instability during proof generation

### Intent
This is a deliberate temporary control to preserve service integrity.
It should not be interpreted as the intended final scaling model.

### Future direction
Planned evolution is to migrate toward:
- queued job scheduling
- worker isolation
- explicit capacity management
- horizontal proving scale
