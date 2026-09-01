// Command gen_highs syncs the HiGHS solver artifacts from the npm `highs` package into the repo.
//
// It copies node_modules/highs/build/highs.wasm to ui/worker/highs.wasm and generates
// ui/worker/highs_names_gen.go, which maps emscripten's symbolic import/export names to the
// single-letter names the wasm actually uses.
//
// That map is why this tool exists. The npm package is built with
// -sMINIFY_WASM_IMPORTS_AND_EXPORTS, so highs.wasm imports "a"."f" and exports "y" rather than
// __syscall_openat and _Highs_run. Which letter means what changes with every upstream build, so
// the Go wazero host (sim/core/reforge_optimizer/highswasm.go) cannot hardcode them; it looks
// them up by symbolic name through the generated map instead.
//
// Run via `make update-highs` after changing the pinned `highs` version in package.json.
package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"go/format"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	npmPackageDir  = "node_modules/highs"
	wasmDestPath   = "ui/worker/highs.wasm"
	namesDestPath  = "ui/worker/highs_names_gen.go"
	generatorLabel = "tools/gen_highs"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "gen_highs: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	repoRoot, err := findRepoRoot()
	if err != nil {
		return err
	}

	version, err := readNpmVersion(filepath.Join(repoRoot, npmPackageDir, "package.json"))
	if err != nil {
		return err
	}

	jsSource, err := os.ReadFile(filepath.Join(repoRoot, npmPackageDir, "build/highs.js"))
	if err != nil {
		return fmt.Errorf("reading highs.js: %w (run `npm install` first)", err)
	}
	wasmSource, err := os.ReadFile(filepath.Join(repoRoot, npmPackageDir, "build/highs.wasm"))
	if err != nil {
		return fmt.Errorf("reading highs.wasm: %w (run `npm install` first)", err)
	}

	names, err := extractNames(jsSource, wasmSource)
	if err != nil {
		return err
	}
	names.Version = version

	if err := os.WriteFile(filepath.Join(repoRoot, wasmDestPath), wasmSource, 0o644); err != nil {
		return fmt.Errorf("writing %s: %w", wasmDestPath, err)
	}
	generated, err := renderNamesFile(names)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(repoRoot, namesDestPath), generated, 0o644); err != nil {
		return fmt.Errorf("writing %s: %w", namesDestPath, err)
	}

	fmt.Printf("gen_highs: synced highs %s (%d imports, %d exports, %d bytes of wasm)\n",
		version, len(names.Imports), len(names.Exports), len(wasmSource))
	return nil
}

// findRepoRoot walks up from the working directory looking for go.mod, so the tool works from
// anywhere (`go run ./tools/gen_highs` runs in the caller's directory).
func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find go.mod above the working directory")
		}
		dir = parent
	}
}

func readNpmVersion(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("reading %s: %w (run `npm install` first)", path, err)
	}
	var manifest struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return "", fmt.Errorf("parsing %s: %w", path, err)
	}
	if manifest.Version == "" {
		return "", fmt.Errorf("%s has no version", path)
	}
	return manifest.Version, nil
}

type wasmImport struct {
	Symbol   string
	Minified string
	Params   []byte
	Results  []byte
}

type highsNames struct {
	Version      string
	ImportModule string
	MemoryExport string
	Imports      []wasmImport
	Exports      map[string]string
}

var (
	// var wasmImports={a:___cxa_throw,d:___syscall_fcntl64,...};
	wasmImportsPattern = regexp.MustCompile(`wasmImports\s*=\s*\{([^}]*)\}`)
	// function assignWasmExports(wasmExports){_Highs_run=Module["_Highs_run"]=wasmExports["y"];...}
	assignExportsPattern = regexp.MustCompile(`function assignWasmExports\([^)]*\)\s*\{([^}]*)\}`)
	// _Highs_run=Module["_Highs_run"]=wasmExports["y"] — the leading identifier is the symbol.
	exportStatementPattern = regexp.MustCompile(`^([A-Za-z_$][\w$]*)\s*=.*wasmExports\["([^"]+)"\]$`)
	// initRuntime(){...;wasmExports["v"]();...} — the __wasm_call_ctors export, which
	// assignWasmExports does not list.
	callCtorsPattern = regexp.MustCompile(`function initRuntime\(\)\s*\{[^}]*?wasmExports\["([^"]+)"\]\(\)`)
)

// callCtorsSymbol is emscripten's name for the static-constructor entry point. It is called
// positionally from initRuntime rather than assigned a symbolic name, so it gets one here.
const callCtorsSymbol = "__wasm_call_ctors"

func extractNames(jsSource []byte, wasmSource []byte) (*highsNames, error) {
	js := string(jsSource)

	moduleName, importTypes, memoryExport, firstFuncExport, err := parseWasmNames(wasmSource)
	if err != nil {
		return nil, err
	}

	imports, err := parseWasmImports(js, importTypes)
	if err != nil {
		return nil, err
	}
	exports, err := parseWasmExports(js, memoryExport)
	if err != nil {
		return nil, err
	}

	// __wasm_call_ctors is always the first function export of an emscripten module. Cross-check
	// the name scraped out of initRuntime against that so a changed upstream JS shape fails here
	// rather than at solve time.
	if got := exports[callCtorsSymbol]; got != firstFuncExport {
		return nil, fmt.Errorf("%s is export %q but the first function export is %q", callCtorsSymbol, got, firstFuncExport)
	}

	return &highsNames{
		ImportModule: moduleName,
		MemoryExport: memoryExport,
		Imports:      imports,
		Exports:      exports,
	}, nil
}

func parseWasmImports(js string, importTypes map[string]funcType) ([]wasmImport, error) {
	match := wasmImportsPattern.FindStringSubmatch(js)
	if match == nil {
		return nil, fmt.Errorf("could not find the wasmImports object in highs.js")
	}

	var imports []wasmImport
	for entry := range strings.SplitSeq(match[1], ",") {
		minified, symbol, found := strings.Cut(entry, ":")
		if !found {
			return nil, fmt.Errorf("could not parse wasmImports entry %q", entry)
		}
		minified, symbol = strings.TrimSpace(minified), strings.TrimSpace(symbol)
		signature, ok := importTypes[minified]
		if !ok {
			return nil, fmt.Errorf("highs.js supplies import %q (%s) but highs.wasm does not import it", minified, symbol)
		}
		imports = append(imports, wasmImport{
			Symbol:   symbol,
			Minified: minified,
			Params:   signature.params,
			Results:  signature.results,
		})
	}
	if len(imports) != len(importTypes) {
		return nil, fmt.Errorf("highs.wasm imports %d functions but highs.js supplies %d", len(importTypes), len(imports))
	}

	sort.Slice(imports, func(i, j int) bool { return imports[i].Symbol < imports[j].Symbol })
	return imports, nil
}

func parseWasmExports(js string, memoryExport string) (map[string]string, error) {
	match := assignExportsPattern.FindStringSubmatch(js)
	if match == nil {
		return nil, fmt.Errorf("could not find assignWasmExports in highs.js")
	}

	exports := map[string]string{}
	for statement := range strings.SplitSeq(match[1], ";") {
		statement = strings.TrimSpace(statement)
		if statement == "" {
			continue
		}
		parts := exportStatementPattern.FindStringSubmatch(statement)
		if parts == nil {
			continue
		}
		// Only minified function exports are useful here. assignWasmExports also picks up the
		// memory and the (unminified) indirect function table, both of which the wasm export
		// section already describes.
		if parts[2] == memoryExport || len(parts[2]) > 2 {
			continue
		}
		exports[parts[1]] = parts[2]
	}
	if len(exports) == 0 {
		return nil, fmt.Errorf("assignWasmExports in highs.js listed no function exports")
	}

	ctors := callCtorsPattern.FindStringSubmatch(js)
	if ctors == nil {
		return nil, fmt.Errorf("could not find the %s call in initRuntime in highs.js", callCtorsSymbol)
	}
	exports[callCtorsSymbol] = ctors[1]

	return exports, nil
}

type funcType struct {
	params  []byte
	results []byte
}

// parseWasmNames reads the type, import and export sections of a wasm binary and returns the
// module name every import shares, the signature of each imported function keyed by its minified
// name, the name of the exported memory, and the name of the first exported function.
func parseWasmNames(wasm []byte) (moduleName string, importTypes map[string]funcType, memoryExport string, firstFuncExport string, err error) {
	if len(wasm) < 8 || !bytes.Equal(wasm[:4], []byte("\x00asm")) {
		return "", nil, "", "", fmt.Errorf("highs.wasm is not a wasm binary")
	}

	var types []funcType
	importTypes = map[string]funcType{}
	reader := &wasmReader{data: wasm, offset: 8}

	for reader.offset < len(wasm) {
		sectionID, sectionEnd, sectionErr := reader.section()
		if sectionErr != nil {
			return "", nil, "", "", sectionErr
		}
		switch sectionID {
		case 1: // type
			if types, err = reader.readTypeSection(); err != nil {
				return "", nil, "", "", err
			}
		case 2: // import
			if moduleName, err = reader.readImportSection(types, importTypes); err != nil {
				return "", nil, "", "", err
			}
		case 7: // export
			if memoryExport, firstFuncExport, err = reader.readExportSection(); err != nil {
				return "", nil, "", "", err
			}
		}
		reader.offset = sectionEnd
	}

	switch {
	case moduleName == "":
		return "", nil, "", "", fmt.Errorf("highs.wasm has no function imports")
	case memoryExport == "":
		return "", nil, "", "", fmt.Errorf("highs.wasm exports no memory")
	case firstFuncExport == "":
		return "", nil, "", "", fmt.Errorf("highs.wasm exports no functions")
	}
	return moduleName, importTypes, memoryExport, firstFuncExport, nil
}

type wasmReader struct {
	data   []byte
	offset int
}

func (r *wasmReader) byte() (byte, error) {
	if r.offset >= len(r.data) {
		return 0, fmt.Errorf("unexpected end of wasm binary")
	}
	value := r.data[r.offset]
	r.offset++
	return value, nil
}

func (r *wasmReader) uvarint() (uint64, error) {
	value, read := binary.Uvarint(r.data[r.offset:])
	if read <= 0 {
		return 0, fmt.Errorf("malformed LEB128 at offset %d", r.offset)
	}
	r.offset += read
	return value, nil
}

func (r *wasmReader) name() (string, error) {
	length, err := r.uvarint()
	if err != nil {
		return "", err
	}
	if r.offset+int(length) > len(r.data) {
		return "", fmt.Errorf("name at offset %d runs past the end of the wasm binary", r.offset)
	}
	value := string(r.data[r.offset : r.offset+int(length)])
	r.offset += int(length)
	return value, nil
}

func (r *wasmReader) section() (id byte, end int, err error) {
	if id, err = r.byte(); err != nil {
		return 0, 0, err
	}
	size, err := r.uvarint()
	if err != nil {
		return 0, 0, err
	}
	end = r.offset + int(size)
	if end > len(r.data) {
		return 0, 0, fmt.Errorf("section %d runs past the end of the wasm binary", id)
	}
	return id, end, nil
}

func (r *wasmReader) readTypeSection() ([]funcType, error) {
	count, err := r.uvarint()
	if err != nil {
		return nil, err
	}
	types := make([]funcType, 0, count)
	for range count {
		form, err := r.byte()
		if err != nil {
			return nil, err
		}
		if form != 0x60 {
			return nil, fmt.Errorf("unsupported type form 0x%02x in highs.wasm", form)
		}
		params, err := r.readValueTypes()
		if err != nil {
			return nil, err
		}
		results, err := r.readValueTypes()
		if err != nil {
			return nil, err
		}
		types = append(types, funcType{params: params, results: results})
	}
	return types, nil
}

func (r *wasmReader) readValueTypes() ([]byte, error) {
	count, err := r.uvarint()
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, nil
	}
	valueTypes := make([]byte, 0, count)
	for range count {
		valueType, err := r.byte()
		if err != nil {
			return nil, err
		}
		valueTypes = append(valueTypes, valueType)
	}
	return valueTypes, nil
}

func (r *wasmReader) readImportSection(types []funcType, importTypes map[string]funcType) (string, error) {
	count, err := r.uvarint()
	if err != nil {
		return "", err
	}
	moduleName := ""
	for range count {
		module, err := r.name()
		if err != nil {
			return "", err
		}
		field, err := r.name()
		if err != nil {
			return "", err
		}
		kind, err := r.byte()
		if err != nil {
			return "", err
		}
		switch kind {
		case 0: // func
			typeIdx, err := r.uvarint()
			if err != nil {
				return "", err
			}
			if int(typeIdx) >= len(types) {
				return "", fmt.Errorf("import %s.%s references unknown type %d", module, field, typeIdx)
			}
			if moduleName != "" && module != moduleName {
				return "", fmt.Errorf("highs.wasm imports from more than one module (%q and %q)", moduleName, module)
			}
			moduleName = module
			importTypes[field] = types[typeIdx]
		case 1: // table
			if err := r.skipTable(); err != nil {
				return "", err
			}
		case 2: // memory
			if err := r.skipLimits(); err != nil {
				return "", err
			}
		case 3: // global
			r.offset += 2
		default:
			return "", fmt.Errorf("unsupported import kind %d in highs.wasm", kind)
		}
	}
	return moduleName, nil
}

func (r *wasmReader) skipTable() error {
	if _, err := r.byte(); err != nil { // element type
		return err
	}
	return r.skipLimits()
}

func (r *wasmReader) skipLimits() error {
	flags, err := r.byte()
	if err != nil {
		return err
	}
	if _, err := r.uvarint(); err != nil { // minimum
		return err
	}
	if flags&1 != 0 {
		if _, err := r.uvarint(); err != nil { // maximum
			return err
		}
	}
	return nil
}

func (r *wasmReader) readExportSection() (memoryExport string, firstFuncExport string, err error) {
	count, err := r.uvarint()
	if err != nil {
		return "", "", err
	}
	for range count {
		name, err := r.name()
		if err != nil {
			return "", "", err
		}
		kind, err := r.byte()
		if err != nil {
			return "", "", err
		}
		if _, err := r.uvarint(); err != nil { // index
			return "", "", err
		}
		switch kind {
		case 0:
			if firstFuncExport == "" {
				firstFuncExport = name
			}
		case 2:
			if memoryExport != "" {
				return "", "", fmt.Errorf("highs.wasm exports more than one memory")
			}
			memoryExport = name
		}
	}
	return memoryExport, firstFuncExport, nil
}

func renderNamesFile(names *highsNames) ([]byte, error) {
	var out strings.Builder
	fmt.Fprintf(&out, "// Code generated by %s. DO NOT EDIT.\n", generatorLabel)
	fmt.Fprintf(&out, "// Source: npm highs@%s (node_modules/highs/build/highs.js).\n", names.Version)
	fmt.Fprintf(&out, "// Regenerate with `make update-highs` after changing the pinned version in package.json.\n\n")
	out.WriteString("package worker\n\n")

	fmt.Fprintf(&out, "// HighsVersion is the npm `highs` release highs.wasm and these names came from.\n")
	fmt.Fprintf(&out, "const HighsVersion = %q\n\n", names.Version)

	out.WriteString("// HighsWASMImportModule is the single module name every highs.wasm import is namespaced\n")
	out.WriteString("// under. emscripten minifies it along with the import names themselves.\n")
	fmt.Fprintf(&out, "const HighsWASMImportModule = %q\n\n", names.ImportModule)

	out.WriteString("// HighsWASMMemoryExport is the minified name of highs.wasm's exported linear memory.\n")
	fmt.Fprintf(&out, "const HighsWASMMemoryExport = %q\n\n", names.MemoryExport)

	out.WriteString("// HighsWASMImport is one host function highs.wasm expects to be given, with the\n")
	out.WriteString("// signature read out of the wasm binary's type section. Params and Results hold raw wasm\n")
	out.WriteString("// value-type bytes, which are exactly wazero's api.ValueType values.\n")
	out.WriteString("type HighsWASMImport struct {\n")
	out.WriteString("\t// Symbol is emscripten's stable name for the import, e.g. \"_fd_read\".\n")
	out.WriteString("\tSymbol string\n")
	out.WriteString("\t// Minified is the name highs.wasm actually imports, e.g. \"q\".\n")
	out.WriteString("\tMinified string\n")
	out.WriteString("\tParams   []byte\n")
	out.WriteString("\tResults  []byte\n")
	out.WriteString("}\n\n")

	out.WriteString("// HighsWASMImports lists every function highs.wasm imports, keyed by symbol so callers\n")
	out.WriteString("// never have to know the minified names.\n")
	out.WriteString("var HighsWASMImports = []HighsWASMImport{\n")
	for _, imp := range names.Imports {
		fmt.Fprintf(&out, "\t{Symbol: %q, Minified: %q, Params: %s, Results: %s},\n",
			imp.Symbol, imp.Minified, renderValueTypes(imp.Params), renderValueTypes(imp.Results))
	}
	out.WriteString("}\n\n")

	out.WriteString("// HighsWASMExports maps each emscripten export symbol to the minified name highs.wasm\n")
	out.WriteString("// exports it under.\n")
	out.WriteString("var HighsWASMExports = map[string]string{\n")
	for _, symbol := range sortedKeys(names.Exports) {
		fmt.Fprintf(&out, "\t%q: %q,\n", symbol, names.Exports[symbol])
	}
	out.WriteString("}\n")

	formatted, err := format.Source([]byte(out.String()))
	if err != nil {
		return nil, fmt.Errorf("formatting generated %s: %w", namesDestPath, err)
	}
	return formatted, nil
}

func renderValueTypes(valueTypes []byte) string {
	if len(valueTypes) == 0 {
		return "nil"
	}
	rendered := make([]string, 0, len(valueTypes))
	for _, valueType := range valueTypes {
		rendered = append(rendered, fmt.Sprintf("0x%02x", valueType))
	}
	return "[]byte{" + strings.Join(rendered, ", ") + "}"
}

func sortedKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
