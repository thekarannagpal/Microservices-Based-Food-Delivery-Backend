$ErrorActionPreference = 'Stop'
$spec = if ($env:SPEC) { $env:SPEC } else { 'http://localhost:8000/openapi.json' }
$out = if ($env:OUT) { $env:OUT } else { 'sdk' }
$root = (Get-Location).Path
New-Item -ItemType Directory -Force $out | Out-Null

docker run --rm -v "${root}\${out}:/local" openapitools/openapi-generator-cli generate `
  -i $spec -g python -o /local/python `
  --additional-properties=packageName=nexvia_client,projectName=nexvia-client

docker run --rm -v "${root}\${out}:/local" openapitools/openapi-generator-cli generate `
  -i $spec -g typescript-axios -o /local/typescript

Write-Host "SDKs written to $out\python and $out\typescript"
