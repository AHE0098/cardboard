if (!requireNamespace("testthat", quietly = TRUE)) {
  stop("Package 'testthat' is required. Install with install.packages('testthat').")
}

fileArg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
scriptPath <- if (length(fileArg)) sub("^--file=", "", fileArg[[1]]) else "r/tests/testthat.R"
scriptDir <- normalizePath(dirname(scriptPath), winslash = "/", mustWork = FALSE)

library(testthat)
test_dir(file.path(scriptDir, "testthat"), reporter = "summary")
