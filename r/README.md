# Cardboard R Harness

This harness reads shared app-first configuration from `../shared/definitions.json` and generates artifacts under `r/out/`.

## Run from repo root

```bash
Rscript r/scripts/specificR_run.R --config r/config/example_config.yml
```

## Run from RStudio

1. Open `r/cardboard-r.Rproj`.
2. Run `source("scripts/specificR_run.R")` or execute:

```r
specificR_main(configPath = "config/example_config.yml")
```

## Outputs

- `r/out/run_manifest.json`
- `r/out/generated_decks.json`
- `r/out/diagnostics.json`

All outputs include `definitionsVersion` and `schemaVersion` for traceability.
