from fastapi.responses import HTMLResponse

from .config import PLANS


def portal_html() -> str:
    plan_rows = "".join(
        f"<tr><td>{plan['name']}</td><td>${plan['price_cents'] / 100:.0f}/mo</td>"
        f"<td>{plan['rate_per_minute']}/min</td><td>{plan['monthly_quota']:,}/mo</td></tr>"
        for plan in PLANS.values()
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nexvia Developer Portal</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 880px; margin: 40px auto; color: #14213d; }}
    header {{ border-bottom: 3px solid #4361ee; padding-bottom: 12px; }}
    code, pre {{ background: #f1f3f9; padding: 2px 6px; border-radius: 4px; }}
    pre {{ padding: 14px; overflow-x: auto; }}
    table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
    th, td {{ border: 1px solid #d5d9e5; padding: 10px; text-align: left; }}
    th {{ background: #eef1fb; }}
    .card {{ border: 1px solid #d5d9e5; border-radius: 8px; padding: 16px; margin: 16px 0; }}
  </style>
</head>
<body>
<header><h1>Nexvia Developer Portal</h1><p>Text-analysis API with keys, quotas, metering and billing.</p></header>

<div class="card">
  <h2>Quickstart</h2>
  <pre>curl -X POST http://localhost:8000/v1/analyze \\
  -H "X-API-Key: nex_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{{"text": "This food is absolutely delicious!"}}'</pre>
  <p>Create keys with <code>POST /v1/keys</code> using the <code>X-Admin-Token</code> header.</p>
</div>

<h2>Plans</h2>
<table><thead><tr><th>Plan</th><th>Price</th><th>Rate limit</th><th>Monthly quota</th></tr></thead>
<tbody>{plan_rows}</tbody></table>

<div class="card">
  <h2>Explore</h2>
  <ul>
    <li><a href="/docs">Interactive Swagger UI</a></li>
    <li><a href="/redoc">ReDoc</a></li>
    <li><a href="/openapi.json">OpenAPI specification</a> — use it with OpenAPI Generator</li>
    <li><a href="/metrics">Prometheus metrics</a></li>
    <li><a href="/v1/usage">Your metered usage</a></li>
  </ul>
</div>

<div class="card">
  <h2>Client SDKs</h2>
  <p>Generate Python and TypeScript clients from the OpenAPI spec:</p>
  <pre>./scripts/generate_sdk.sh</pre>
</div>
</body>
</html>"""
