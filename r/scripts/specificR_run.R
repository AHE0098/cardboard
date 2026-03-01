#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Package 'jsonlite' is required. Install with install.packages('jsonlite').")
  }
})

fileArg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
scriptPath <- if (length(fileArg)) sub("^--file=", "", fileArg[[1]]) else "r/scripts/specificR_run.R"
scriptDir <- normalizePath(dirname(scriptPath), winslash = "/", mustWork = FALSE)

source(file.path(scriptDir, "specificR_lib.R"))

parseArgs <- function(args) {
  out <- list(configPath = "r/config/example_config.yml")
  if (!length(args)) return(out)
  for (i in seq_along(args)) {
    if (args[[i]] == "--config" && i < length(args)) out$configPath <- args[[i + 1]]
  }
  out
}

if (sys.nframe() == 0) {
  args <- parseArgs(commandArgs(trailingOnly = TRUE))
  res <- specificR_main(configPath = args$configPath, startDir = getwd())
  cat(sprintf("specificR complete. definitionsVersion=%s schemaVersion=%s\n", res$diagnostics$definitionsVersion, res$diagnostics$schemaVersion))
}
