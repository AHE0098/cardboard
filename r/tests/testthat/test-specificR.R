test_that("shared definitions can be loaded", {
  source(file.path("..", "..", "scripts", "specificR_lib.R"))
  paths <- resolvePaths(startDir = getwd())
  defs <- readJsonFile(paths$definitions)
  expect_true(is.list(defs))
  expect_true(!is.null(defs$version))
  expect_true(!is.null(defs$keywords))
})

test_that("deck generation returns iteratable structures", {
  source(file.path("..", "..", "scripts", "specificR_lib.R"))
  defs <- readJsonFile(file.path("..", "..", "..", "shared", "definitions.json"))
  decks <- generateDecks(defs, list(decksToGenerate = 1, cardsPerDeck = 3))
  expect_equal(length(decks), 1)
  expect_true(!is.null(decks[[1]]$meta$extras))
  expect_true(length(decks[[1]]$cards) == 3)
})
