# Generated clients

Client SDKs are generated from the live OpenAPI specification with OpenAPI Generator and are intentionally not committed.

```bash
# Linux/macOS
./scripts/generate_sdk.sh

# Windows PowerShell
./scripts/generate_sdk.ps1
```

Outputs:

- `sdk/python/` — Python client (`nexvia_client`)
- `sdk/typescript/` — TypeScript + Axios client

Start the API first (`docker compose up -d`) so the generator can fetch `http://localhost:8000/openapi.json`. Override `SPEC` to generate from a checked-in spec file instead.
