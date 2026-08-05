package worker

import _ "embed"

// HighsWASM is the same HiGHS WebAssembly module used by the frontend reforge worker.
//
//go:embed highs.wasm
var HighsWASM []byte
