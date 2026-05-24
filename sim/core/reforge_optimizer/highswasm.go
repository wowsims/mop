//go:build !(js && wasm)

package reforgeoptimizer

import (
	"encoding/binary"
	"fmt"
	"math"
	goruntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	wasmtime "github.com/bytecodealliance/wasmtime-go"
	worker "github.com/wowsims/mop/ui/worker"
)

const (
	highsStatusOK             = 0
	highsStatusWarning        = 1
	highsModelStatusOptimal   = 7
	highsModelStatusTimeLimit = 13
)

type highsWasmModule struct {
	engine *wasmtime.Engine
	module *wasmtime.Module
}

var (
	highsWasmModuleOnce  sync.Once
	highsWasmModuleValue *highsWasmModule
	highsWasmModuleErr   error
	highsWasmRuntimePool = make(chan struct{}, getHiGHSWasmRuntimeConcurrency())
)

type highsWasmRuntime struct {
	store    *wasmtime.Store
	instance *wasmtime.Instance
	memory   *wasmtime.Memory

	nextFD int32
	files  map[int32]*highsWasmFile
	paths  map[string][]byte
	stdout strings.Builder
	stderr strings.Builder

	runtimeInit              *wasmtime.Func
	highsCreate              *wasmtime.Func
	highsDestroy             *wasmtime.Func
	highsRun                 *wasmtime.Func
	highsReadModel           *wasmtime.Func
	highsWriteSolutionPretty *wasmtime.Func
	highsSetIntOption        *wasmtime.Func
	highsSetDoubleOption     *wasmtime.Func
	highsSetStringOption     *wasmtime.Func
	highsGetModelStatus      *wasmtime.Func
	malloc                   *wasmtime.Func
}

type highsWasmFile struct {
	path     string
	contents []byte
	position int64
}

func solveMIPWithHiGHS(model mipModel, timeout time.Duration, mipRelGap float64) (mipSolution, bool, error) {
	acquireHiGHSWasmRuntime()
	defer releaseHiGHSWasmRuntime()

	wasmRuntime, err := newHiGHSWasmRuntime()
	if err != nil {
		return mipSolution{}, false, err
	}

	wasmRuntime.paths["/m.lp"] = []byte(modelToHiGHSLP(model))
	wasmRuntime.paths["m.lp"] = wasmRuntime.paths["/m.lp"]

	if _, err := wasmRuntime.runtimeInit.Call(wasmRuntime.store); err != nil {
		return mipSolution{}, false, fmt.Errorf("initializing HiGHS wasm runtime: %w", err)
	}

	highs, err := callI32(wasmRuntime.store, wasmRuntime.highsCreate)
	if err != nil {
		return mipSolution{}, false, fmt.Errorf("creating HiGHS wasm instance: %w", err)
	}
	if highs == 0 {
		return mipSolution{}, false, fmt.Errorf("failed to create HiGHS wasm instance")
	}
	defer wasmRuntime.highsDestroy.Call(wasmRuntime.store, highs)

	modelPath, err := wasmRuntime.writeCString("m.lp")
	if err != nil {
		return mipSolution{}, false, err
	}
	if status, err := callI32(wasmRuntime.store, wasmRuntime.highsReadModel, highs, modelPath); err != nil {
		return mipSolution{}, false, fmt.Errorf("reading HiGHS LP model: %w", err)
	} else if !isHighsSuccess(status) {
		return mipSolution{}, false, fmt.Errorf("failed reading HiGHS LP model: %d", status)
	}

	if err := wasmRuntime.setStringOption(highs, "presolve", "on"); err != nil {
		return mipSolution{}, false, err
	}
	if err := wasmRuntime.setDoubleOption(highs, "time_limit", timeout.Seconds()); err != nil {
		return mipSolution{}, false, err
	}
	if mipRelGap > 0 {
		if err := wasmRuntime.setDoubleOption(highs, "mip_rel_gap", mipRelGap); err != nil {
			return mipSolution{}, false, err
		}
	}

	if status, err := callI32(wasmRuntime.store, wasmRuntime.highsRun, highs); err != nil {
		return mipSolution{}, false, fmt.Errorf("running HiGHS wasm solve: %w", err)
	} else if !isHighsSuccess(status) {
		return mipSolution{}, false, fmt.Errorf("HiGHS wasm solve failed: %d", status)
	}

	modelStatus, err := callI32(wasmRuntime.store, wasmRuntime.highsGetModelStatus, highs)
	if err != nil {
		return mipSolution{}, false, fmt.Errorf("reading HiGHS wasm model status: %w", err)
	}
	if modelStatus != highsModelStatusOptimal && modelStatus != highsModelStatusTimeLimit {
		return mipSolution{}, false, fmt.Errorf("HiGHS wasm returned model status %d", modelStatus)
	}

	wasmRuntime.stdout.Reset()
	wasmRuntime.stderr.Reset()
	emptyPath, err := wasmRuntime.writeCString("")
	if err != nil {
		return mipSolution{}, false, err
	}
	if status, err := callI32(wasmRuntime.store, wasmRuntime.highsWriteSolutionPretty, highs, emptyPath); err != nil {
		return mipSolution{}, false, fmt.Errorf("writing HiGHS wasm solution: %w", err)
	} else if !isHighsSuccess(status) {
		return mipSolution{}, false, fmt.Errorf("failed writing HiGHS wasm solution: %d", status)
	}

	solution, err := parseHiGHSWasmSolution(wasmRuntime.stdout.String(), len(model.variables))
	if err != nil {
		if modelStatus == highsModelStatusTimeLimit {
			return mipSolution{}, false, nil
		}
		return mipSolution{}, false, err
	}
	return solution, true, nil
}

func getHiGHSWasmRuntimeConcurrency() int {
	return max(1, goruntime.NumCPU()/4)
}

func acquireHiGHSWasmRuntime() {
	highsWasmRuntimePool <- struct{}{}
}

func releaseHiGHSWasmRuntime() {
	<-highsWasmRuntimePool
}

func newHiGHSWasmRuntime() (*highsWasmRuntime, error) {
	module, err := getHiGHSWasmModule()
	if err != nil {
		return nil, err
	}

	runtime := &highsWasmRuntime{
		store:  wasmtime.NewStore(module.engine),
		nextFD: 3,
		files:  map[int32]*highsWasmFile{},
		paths:  map[string][]byte{},
	}

	imports, err := runtime.buildImports(module.module)
	if err != nil {
		return nil, err
	}
	instance, err := wasmtime.NewInstance(runtime.store, module.module, imports)
	if err != nil {
		return nil, fmt.Errorf("instantiating HiGHS wasm: %w", err)
	}
	runtime.instance = instance
	runtime.memory = instance.GetExport(runtime.store, "t").Memory()
	if runtime.memory == nil {
		return nil, fmt.Errorf("HiGHS wasm export t is not memory")
	}

	runtime.runtimeInit = mustWasmFunc(instance, runtime.store, "u")
	runtime.highsCreate = mustWasmFunc(instance, runtime.store, "v")
	runtime.highsDestroy = mustWasmFunc(instance, runtime.store, "w")
	runtime.highsRun = mustWasmFunc(instance, runtime.store, "x")
	runtime.highsReadModel = mustWasmFunc(instance, runtime.store, "y")
	runtime.highsWriteSolutionPretty = mustWasmFunc(instance, runtime.store, "A")
	runtime.highsSetIntOption = mustWasmFunc(instance, runtime.store, "C")
	runtime.highsSetDoubleOption = mustWasmFunc(instance, runtime.store, "D")
	runtime.highsSetStringOption = mustWasmFunc(instance, runtime.store, "E")
	runtime.highsGetModelStatus = mustWasmFunc(instance, runtime.store, "F")
	runtime.malloc = mustWasmFunc(instance, runtime.store, "J")
	return runtime, nil
}

func getHiGHSWasmModule() (*highsWasmModule, error) {
	highsWasmModuleOnce.Do(func() {
		config := wasmtime.NewConfig()
		config.SetCraneliftOptLevel(wasmtime.OptLevelSpeed)
		engine := wasmtime.NewEngineWithConfig(config)
		module, err := wasmtime.NewModule(engine, worker.HighsWASM)
		if err != nil {
			highsWasmModuleErr = fmt.Errorf("compiling embedded highs.wasm: %w", err)
			return
		}
		highsWasmModuleValue = &highsWasmModule{engine: engine, module: module}
	})
	return highsWasmModuleValue, highsWasmModuleErr
}

func (runtime *highsWasmRuntime) buildImports(module *wasmtime.Module) ([]wasmtime.AsExtern, error) {
	imports := make([]wasmtime.AsExtern, 0, len(module.Imports()))
	for _, importType := range module.Imports() {
		name := ""
		if importType.Name() != nil {
			name = *importType.Name()
		}
		funcType := importType.Type().FuncType()
		if funcType == nil {
			return nil, fmt.Errorf("unsupported HiGHS wasm import %s.%s", importType.Module(), name)
		}
		imports = append(imports, wasmtime.NewFunc(runtime.store, funcType, runtime.importFunc(name)))
	}
	return imports, nil
}

func (runtime *highsWasmRuntime) importFunc(name string) func(*wasmtime.Caller, []wasmtime.Val) ([]wasmtime.Val, *wasmtime.Trap) {
	return func(caller *wasmtime.Caller, args []wasmtime.Val) ([]wasmtime.Val, *wasmtime.Trap) {
		switch name {
		case "a":
			return nil, wasmtime.NewTrap("HiGHS wasm exception handling import was called")
		case "b", "j":
			return nil, wasmtime.NewTrap(fmt.Sprintf("HiGHS wasm exited with code %d", args[0].I32()))
		case "c", "m":
			return []wasmtime.Val{wasmtime.ValF64(float64(time.Now().UnixNano()) / float64(time.Millisecond))}, nil
		case "d", "g":
			return []wasmtime.Val{wasmtime.ValI32(0)}, nil
		case "e":
			return []wasmtime.Val{wasmtime.ValI32(runtime.fdClose(args[0].I32()))}, nil
		case "f":
			return []wasmtime.Val{wasmtime.ValI32(runtime.fdRead(caller, args[0].I32(), args[1].I32(), args[2].I32(), args[3].I32()))}, nil
		case "h":
			return []wasmtime.Val{wasmtime.ValI32(runtime.openAt(caller, args[0].I32(), args[1].I32(), args[2].I32()))}, nil
		case "i":
			return []wasmtime.Val{wasmtime.ValI32(runtime.fdWrite(caller, args[0].I32(), args[1].I32(), args[2].I32(), args[3].I32()))}, nil
		case "k", "r":
			return nil, wasmtime.NewTrap("HiGHS wasm abort")
		case "l":
			return []wasmtime.Val{wasmtime.ValI32(0)}, nil
		case "n":
			return []wasmtime.Val{wasmtime.ValI32(runtime.environGet(caller, args[0].I32(), args[1].I32()))}, nil
		case "o":
			return []wasmtime.Val{wasmtime.ValI32(runtime.environSizesGet(caller, args[0].I32(), args[1].I32()))}, nil
		case "p":
			return []wasmtime.Val{wasmtime.ValI32(runtime.clockTimeGet(caller, args[0].I32(), args[2].I32()))}, nil
		case "q":
			return []wasmtime.Val{wasmtime.ValI32(runtime.fdSeek(caller, args[0].I32(), args[1].I64(), args[2].I32(), args[3].I32()))}, nil
		case "s":
			return []wasmtime.Val{wasmtime.ValI32(runtime.resizeHeap(caller, args[0].I32()))}, nil
		default:
			return nil, wasmtime.NewTrap(fmt.Sprintf("unsupported HiGHS wasm import a.%s", name))
		}
	}
}

func (runtime *highsWasmRuntime) memoryBytes(store wasmtime.Storelike) []byte {
	if runtime.memory != nil {
		return runtime.memory.UnsafeData(store)
	}
	return nil
}

func (runtime *highsWasmRuntime) callerMemoryBytes(caller *wasmtime.Caller) []byte {
	if runtime.memory == nil {
		return nil
	}
	return runtime.memory.UnsafeData(caller)
}

func (runtime *highsWasmRuntime) openAt(caller *wasmtime.Caller, _ int32, pathPtr int32, _ int32) int32 {
	path := runtime.readCString(runtime.callerMemoryBytes(caller), pathPtr)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	contents, ok := runtime.paths[path]
	if !ok {
		return -44
	}
	fd := runtime.nextFD
	runtime.nextFD++
	runtime.files[fd] = &highsWasmFile{path: path, contents: contents}
	return fd
}

func (runtime *highsWasmRuntime) fdClose(fd int32) int32 {
	if fd <= 2 {
		return 0
	}
	delete(runtime.files, fd)
	return 0
}

func (runtime *highsWasmRuntime) fdRead(caller *wasmtime.Caller, fd int32, iovsPtr int32, iovsLen int32, nreadPtr int32) int32 {
	file := runtime.files[fd]
	if file == nil {
		return 8
	}
	memory := runtime.callerMemoryBytes(caller)
	bytesRead := int32(0)
	for iovIdx := int32(0); iovIdx < iovsLen; iovIdx++ {
		iovPtr := int(iovsPtr + 8*iovIdx)
		bufferPtr := int32(binary.LittleEndian.Uint32(memory[iovPtr:]))
		bufferLen := int32(binary.LittleEndian.Uint32(memory[iovPtr+4:]))
		if bufferLen <= 0 || file.position >= int64(len(file.contents)) {
			continue
		}
		remaining := int32(len(file.contents) - int(file.position))
		copyLen := min(bufferLen, remaining)
		copy(memory[bufferPtr:bufferPtr+copyLen], file.contents[file.position:file.position+int64(copyLen)])
		file.position += int64(copyLen)
		bytesRead += copyLen
		if copyLen < bufferLen {
			break
		}
	}
	binary.LittleEndian.PutUint32(memory[nreadPtr:], uint32(bytesRead))
	return 0
}

func (runtime *highsWasmRuntime) fdWrite(caller *wasmtime.Caller, fd int32, iovsPtr int32, iovsLen int32, nwrittenPtr int32) int32 {
	memory := runtime.callerMemoryBytes(caller)
	bytesWritten := int32(0)
	for iovIdx := int32(0); iovIdx < iovsLen; iovIdx++ {
		iovPtr := int(iovsPtr + 8*iovIdx)
		bufferPtr := int32(binary.LittleEndian.Uint32(memory[iovPtr:]))
		bufferLen := int32(binary.LittleEndian.Uint32(memory[iovPtr+4:]))
		if bufferLen <= 0 {
			continue
		}
		chunk := string(memory[bufferPtr : bufferPtr+bufferLen])
		switch fd {
		case 1:
			runtime.stdout.WriteString(chunk)
		case 2:
			runtime.stderr.WriteString(chunk)
		}
		bytesWritten += bufferLen
	}
	binary.LittleEndian.PutUint32(memory[nwrittenPtr:], uint32(bytesWritten))
	return 0
}

func (runtime *highsWasmRuntime) fdSeek(caller *wasmtime.Caller, fd int32, offset int64, whence int32, newOffsetPtr int32) int32 {
	file := runtime.files[fd]
	if file == nil {
		return 8
	}
	var nextOffset int64
	switch whence {
	case 0:
		nextOffset = offset
	case 1:
		nextOffset = file.position + offset
	case 2:
		nextOffset = int64(len(file.contents)) + offset
	default:
		return 28
	}
	if nextOffset < 0 {
		return 28
	}
	file.position = nextOffset
	memory := runtime.callerMemoryBytes(caller)
	binary.LittleEndian.PutUint64(memory[newOffsetPtr:], uint64(nextOffset))
	return 0
}

func (runtime *highsWasmRuntime) environSizesGet(caller *wasmtime.Caller, countPtr int32, sizePtr int32) int32 {
	memory := runtime.callerMemoryBytes(caller)
	binary.LittleEndian.PutUint32(memory[countPtr:], 0)
	binary.LittleEndian.PutUint32(memory[sizePtr:], 0)
	return 0
}

func (runtime *highsWasmRuntime) environGet(_ *wasmtime.Caller, _ int32, _ int32) int32 {
	return 0
}

func (runtime *highsWasmRuntime) clockTimeGet(caller *wasmtime.Caller, _ int32, timePtr int32) int32 {
	memory := runtime.callerMemoryBytes(caller)
	binary.LittleEndian.PutUint64(memory[timePtr:], uint64(time.Now().UnixNano()))
	return 0
}

func (runtime *highsWasmRuntime) resizeHeap(caller *wasmtime.Caller, requestedSize int32) int32 {
	memory := caller.GetExport("t").Memory()
	if memory == nil {
		return 0
	}
	currentBytes := uint64(memory.DataSize(caller))
	if uint64(requestedSize) <= currentBytes {
		return 1
	}
	const pageSize = 64 * 1024
	neededPages := (uint64(requestedSize) - currentBytes + pageSize - 1) / pageSize
	if _, err := memory.Grow(caller, neededPages); err != nil {
		return 0
	}
	return 1
}

func (runtime *highsWasmRuntime) readCString(memory []byte, ptr int32) string {
	if ptr <= 0 || int(ptr) >= len(memory) {
		return ""
	}
	end := int(ptr)
	for end < len(memory) && memory[end] != 0 {
		end++
	}
	return string(memory[ptr:end])
}

func (runtime *highsWasmRuntime) writeCString(value string) (int32, error) {
	ptr, err := callI32(runtime.store, runtime.malloc, int32(len(value)+1))
	if err != nil {
		return 0, fmt.Errorf("allocating HiGHS wasm string: %w", err)
	}
	memory := runtime.memoryBytes(runtime.store)
	copy(memory[ptr:], value)
	memory[int(ptr)+len(value)] = 0
	return ptr, nil
}

func (runtime *highsWasmRuntime) setDoubleOption(highs int32, name string, value float64) error {
	namePtr, err := runtime.writeCString(name)
	if err != nil {
		return err
	}
	status, err := callI32(runtime.store, runtime.highsSetDoubleOption, highs, namePtr, value)
	if err != nil {
		return fmt.Errorf("setting HiGHS wasm option %q: %w", name, err)
	}
	if !isHighsSuccess(status) {
		return fmt.Errorf("failed setting HiGHS wasm option %q: %d", name, status)
	}
	return nil
}

func (runtime *highsWasmRuntime) setStringOption(highs int32, name string, value string) error {
	namePtr, err := runtime.writeCString(name)
	if err != nil {
		return err
	}
	valuePtr, err := runtime.writeCString(value)
	if err != nil {
		return err
	}
	status, err := callI32(runtime.store, runtime.highsSetStringOption, highs, namePtr, valuePtr)
	if err != nil {
		return fmt.Errorf("setting HiGHS wasm option %q: %w", name, err)
	}
	if !isHighsSuccess(status) {
		return fmt.Errorf("failed setting HiGHS wasm option %q: %d", name, status)
	}
	return nil
}

func callI32(store wasmtime.Storelike, fn *wasmtime.Func, args ...interface{}) (int32, error) {
	result, err := fn.Call(store, args...)
	if err != nil {
		return 0, err
	}
	switch value := result.(type) {
	case int32:
		return value, nil
	case wasmtime.Val:
		return value.I32(), nil
	default:
		return 0, fmt.Errorf("expected i32 result, got %T", result)
	}
}

func mustWasmFunc(instance *wasmtime.Instance, store wasmtime.Storelike, name string) *wasmtime.Func {
	fn := instance.GetFunc(store, name)
	if fn == nil {
		panic(fmt.Sprintf("HiGHS wasm export %s is not a function", name))
	}
	return fn
}

func isHighsSuccess(status int32) bool {
	return status == highsStatusOK || status == highsStatusWarning
}

func parseHiGHSWasmSolution(output string, variableCount int) (mipSolution, error) {
	lines := strings.Split(output, "\n")
	solution := mipSolution{values: make([]float64, variableCount)}
	inColumns := false
	parsedColumns := 0
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "Columns" {
			inColumns = true
			continue
		}
		if trimmed == "Rows" {
			break
		}
		if !inColumns || trimmed == "" || strings.HasPrefix(trimmed, "Index ") {
			continue
		}
		fields := strings.Fields(trimmed)
		if len(fields) < 5 {
			continue
		}
		name := fields[len(fields)-1]
		if !strings.HasPrefix(name, "x") {
			continue
		}
		variableIdx, err := strconv.Atoi(strings.TrimPrefix(name, "x"))
		if err != nil || variableIdx < 0 || variableIdx >= variableCount {
			continue
		}
		offset := 1
		if _, err := strconv.ParseFloat(fields[1], 64); err != nil {
			offset = 2
		}
		primalIdx := offset + 2
		if primalIdx >= len(fields)-1 {
			continue
		}
		primal, err := parseHiGHSNumber(fields[primalIdx])
		if err != nil {
			return mipSolution{}, fmt.Errorf("parsing HiGHS wasm solution value for %s: %w", name, err)
		}
		solution.values[variableIdx] = primal
		parsedColumns++
	}
	if parsedColumns == 0 && variableCount > 0 {
		return mipSolution{}, fmt.Errorf("HiGHS wasm solution did not include any columns")
	}
	return solution, nil
}

func parseHiGHSNumber(value string) (float64, error) {
	switch value {
	case "inf":
		return math.Inf(1), nil
	case "-inf":
		return math.Inf(-1), nil
	default:
		return strconv.ParseFloat(value, 64)
	}
}
