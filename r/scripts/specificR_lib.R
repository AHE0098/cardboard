findRepoRoot <- function(startDir = getwd()) {
  current <- normalizePath(startDir, winslash = "/", mustWork = TRUE)
  repeat {
    candidate <- file.path(current, "shared", "definitions.json")
    if (file.exists(candidate)) return(current)
    parent <- dirname(current)
    if (identical(parent, current)) break
    current <- parent
  }
  stop("Could not locate repo root containing shared/definitions.json")
}

resolvePaths <- function(configPath = NULL, startDir = getwd()) {
  root <- findRepoRoot(startDir)
  cfg <- if (is.null(configPath)) file.path(root, "r", "config", "example_config.yml") else configPath
  if (!grepl("^(/|[A-Za-z]:)", cfg)) cfg <- file.path(root, cfg)

  list(
    root = root,
    definitions = file.path(root, "shared", "definitions.json"),
    deckSchema = file.path(root, "shared", "schema", "deck.schema.json"),
    cardSchema = file.path(root, "shared", "schema", "card.schema.json"),
    exampleDecks = file.path(root, "shared", "example_decks.json"),
    outDir = file.path(root, "r", "out"),
    config = normalizePath(cfg, winslash = "/", mustWork = FALSE)
  )
}

readJsonFile <- function(path) {
  jsonlite::fromJSON(path, simplifyVector = FALSE)
}

parseSimpleConfig <- function(path) {
  if (!file.exists(path)) return(list())
  lines <- readLines(path, warn = FALSE)
  lines <- trimws(lines)
  lines <- lines[nzchar(lines) & !startsWith(lines, "#")]
  out <- list()
  for (ln in lines) {
    parts <- strsplit(ln, ":", fixed = TRUE)[[1]]
    key <- trimws(parts[1])
    value <- trimws(paste(parts[-1], collapse = ":"))
    if (grepl("^[0-9]+$", value)) value <- as.integer(value)
    out[[key]] <- value
  }
  out
}

normalizeDeckCardEntry <- function(entry) {
  if (is.character(entry) && length(entry) == 1) {
    return(list(cardId = entry, count = 1L))
  }
  if (is.list(entry) && !is.null(entry$cardId)) {
    return(list(cardId = as.character(entry$cardId), count = as.integer(entry$count %||% 1L)))
  }
  stop("Invalid card entry in deck")
}

`%||%` <- function(x, y) if (is.null(x)) y else x

validateDecks <- function(decks) {
  errs <- c()
  for (i in seq_along(decks)) {
    d <- decks[[i]]
    if (is.null(d$deckId) || !nzchar(as.character(d$deckId))) errs <- c(errs, paste0("Deck ", i, " missing deckId"))
    if (is.null(d$name) || !nzchar(as.character(d$name))) errs <- c(errs, paste0("Deck ", i, " missing name"))
    if (!is.list(d$cards)) errs <- c(errs, paste0("Deck ", i, " cards must be array"))
  }
  list(valid = length(errs) == 0, errors = errs)
}

generateDecks <- function(definitions, config) {
  deckRules <- definitions$deckRules
  keywords <- definitions$keywords
  cardsPerDeck <- as.integer(config$cardsPerDeck %||% 10L)
  decksToGenerate <- as.integer(config$decksToGenerate %||% 2L)

  keywordIds <- vapply(keywords, function(k) as.character(k$key %||% "unknown"), character(1))
  if (!length(keywordIds)) keywordIds <- c("vanilla")

  out <- vector("list", decksToGenerate)
  for (i in seq_len(decksToGenerate)) {
    selected <- sample(keywordIds, size = cardsPerDeck, replace = TRUE)
    cards <- lapply(selected, function(id) list(cardId = paste0("unit-", id), count = 1L, extras = list(sourceKeyword = id)))
    out[[i]] <- list(
      deckId = paste0("generated-", i),
      name = paste("Generated Deck", i),
      cards = cards,
      maxCopies = as.integer(deckRules$maxCopiesDefault %||% 4L),
      meta = list(strategy = "keyword-sampled", extras = list())
    )
  }
  out
}

writeJsonPretty <- function(x, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  jsonlite::write_json(x, path = path, pretty = TRUE, auto_unbox = TRUE)
}

specificR_main <- function(configPath = NULL, startDir = getwd()) {
  paths <- resolvePaths(configPath = configPath, startDir = startDir)
  defs <- readJsonFile(paths$definitions)
  cfg <- parseSimpleConfig(paths$config)

  if (!is.null(cfg$seed)) set.seed(as.integer(cfg$seed))

  generatedDecks <- generateDecks(defs, cfg)
  validation <- validateDecks(generatedDecks)

  diagnostics <- list(
    definitionsVersion = defs$version %||% NA_character_,
    schemaVersion = defs$schemaVersion %||% NA_character_,
    generatedDeckCount = length(generatedDecks),
    validation = validation,
    timestampUtc = format(Sys.time(), tz = "UTC", usetz = TRUE)
  )

  manifest <- list(
    status = if (validation$valid) "ok" else "error",
    definitionsVersion = defs$version %||% NA_character_,
    schemaVersion = defs$schemaVersion %||% NA_character_,
    configPath = paths$config,
    outputs = list(
      generatedDecks = "r/out/generated_decks.json",
      diagnostics = "r/out/diagnostics.json"
    )
  )

  writeJsonPretty(generatedDecks, file.path(paths$outDir, "generated_decks.json"))
  writeJsonPretty(diagnostics, file.path(paths$outDir, "diagnostics.json"))
  writeJsonPretty(manifest, file.path(paths$outDir, "run_manifest.json"))

  invisible(list(paths = paths, diagnostics = diagnostics, generatedDecks = generatedDecks))
}
