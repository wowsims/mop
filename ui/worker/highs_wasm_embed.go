package worker

import _ "embed"

// HighsWASM is the HiGHS WebAssembly module from the npm `highs` package, the same binary the
// frontend reforge worker fetches. highs.wasm is a generated copy of
// node_modules/highs/build/highs.wasm rather than a hand-maintained file: run `make update-highs`
// to resync it (along with highs_names_gen.go) after changing the pinned version in package.json.
// It is committed so `go build` works without npm.
//
//go:embed highs.wasm
var HighsWASM []byte
