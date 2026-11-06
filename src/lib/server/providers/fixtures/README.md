# Provider contract fixtures

These payloads are test fixtures for the normalized contract, one per adapter.
They are shaped from [SPEC §10.3](../../../../../SPEC.md) rather than captured
from live providers, because the hosted APIs need real accounts. They
deliberately disagree on the details adapters must absorb:

| Fixture           | Quirk                                                               |
| ----------------- | ------------------------------------------------------------------- |
| `jev.json`        | documented response with a versioned `model` and full probabilities |
| `laya.json`       | percentages instead of 0..1, index-keyed score, out-of-range `noul` |
| `clef.json`       | partial probability map, `raw_score`, out-of-range `noul`           |
| `cloudflare.json` | Workers AI `{ success, result }` envelope, unknown question         |
| `systemone.json`  | clean contract response, as the reference bridge returns            |

Replace a fixture with a real capture (redacted of anything account-specific)
once a provider account is available. The expected values live in
`contract.test.ts`; changing a fixture means updating that table on purpose.
