//go:build !(js && wasm)

package reforgeoptimizer

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	goruntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	worker "github.com/wowsims/mop/ui/worker"
)

const (
	highsStatusOK             = 0
	highsStatusWarning        = 1
	highsModelStatusOptimal   = 7
	highsModelStatusTimeLimit = 13
)

type highsWasmModule struct {
	runtime wazero.Runtime
	module  wazero.CompiledModule
}

var (
	highsWasmModuleOnce   sync.Once
	highsWasmModuleValue  *highsWasmModule
	highsWasmModuleErr    error
	highsWasmRuntimeSlots = make(chan struct{}, getHiGHSWasmRuntimeConcurrency())
	highsWasmRuntimePool  = make(chan *highsWasmRuntime, getHiGHSWasmRuntimeConcurrency())
)

type highsWasmRuntime struct {
	ctx      context.Context
	instance api.Module
	memory   api.Memory

	nextFD    int32
	files     map[int32]*highsWasmFile
	paths     map[string][]byte
	lpScratch []byte // reused LP-text buffer, one owner per pooled runtime
	stdout    bytes.Buffer
	stderr    bytes.Buffer

	runtimeInit              api.Function
	runtimeInitialized       bool
	highsCreate              api.Function
	highsDestroy             api.Function
	highsRun                 api.Function
	highsReadModel           api.Function
	highsWriteSolutionPretty api.Function
	highsSetIntOption        api.Function
	highsSetDoubleOption     api.Function
	highsSetStringOption     api.Function
	highsGetModelStatus      api.Function
	malloc                   api.Function
}

type highsWasmRuntimeContextKey struct{}

type highsWasmFile struct {
	path     string
	contents []byte
	position int64
}

func solveMIPWithHiGHS(model mipModel, timeout time.Duration, mipRelGap float64) (mipSolution, bool, error) {
	wasmRuntime, err := acquireHiGHSWasmRuntime()
	if err != nil {
		return mipSolution{}, false, err
	}
	defer releaseHiGHSWasmRuntime(wasmRuntime)

	// Reuse a per-runtime buffer for the LP text instead of allocating a fresh []byte each
	// solve. The runtime has a single owner between acquire/release, and the wasm fully reads
	// the bytes within this call, so the buffer is safe to overwrite on the next solve.
	wasmRuntime.lpScratch = append(wasmRuntime.lpScratch[:0], modelToHiGHSLP(model)...)
	wasmRuntime.paths["/m.lp"] = wasmRuntime.lpScratch
	wasmRuntime.paths["m.lp"] = wasmRuntime.lpScratch

	if !wasmRuntime.runtimeInitialized {
		if _, err := wasmRuntime.runtimeInit.Call(wasmRuntime.ctx); err != nil {
			return mipSolution{}, false, fmt.Errorf("initializing HiGHS wasm runtime: %w", err)
		}
		wasmRuntime.runtimeInitialized = true
	}

	highs, err := callI32(wasmRuntime.ctx, wasmRuntime.highsCreate)
	if err != nil {
		return mipSolution{}, false, fmt.Errorf("creating HiGHS wasm instance: %w", err)
	}
	if highs == 0 {
		return mipSolution{}, false, fmt.Errorf("failed to create HiGHS wasm instance")
	}
	defer wasmRuntime.highsDestroy.Call(wasmRuntime.ctx, uint64(uint32(highs)))

	modelPath, err := wasmRuntime.writeCString("m.lp")
	if err != nil {
		return mipSolution{}, false, err
	}
	if status, err := callI32(wasmRuntime.ctx, wasmRuntime.highsReadModel, wasmI32(highs), wasmI32(modelPath)); err != nil {
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

	if status, err := callI32(wasmRuntime.ctx, wasmRuntime.highsRun, wasmI32(highs)); err != nil {
		return mipSolution{}, false, fmt.Errorf("running HiGHS wasm solve: %w", err)
	} else if !isHighsSuccess(status) {
		return mipSolution{}, false, fmt.Errorf("HiGHS wasm solve failed: %d", status)
	}

	modelStatus, err := callI32(wasmRuntime.ctx, wasmRuntime.highsGetModelStatus, wasmI32(highs))
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
	if status, err := callI32(wasmRuntime.ctx, wasmRuntime.highsWriteSolutionPretty, wasmI32(highs), wasmI32(emptyPath)); err != nil {
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
	if rawCap := os.Getenv("WOWSIMS_HIGHS_WASM_RUNTIME_CONCURRENCY"); rawCap != "" {
		if cap, err := strconv.Atoi(rawCap); err == nil && cap > 0 {
			return cap
		}
	}
	return defaultHiGHSWasmRuntimeConcurrency(goruntime.NumCPU())
}

func defaultHiGHSWasmRuntimeConcurrency(numCPU int) int {
	return max(1, numCPU)
}

func acquireHiGHSWasmRuntime() (*highsWasmRuntime, error) {
	highsWasmRuntimeSlots <- struct{}{}
	select {
	case runtime := <-highsWasmRuntimePool:
		return runtime, nil
	default:
		runtime, err := newHiGHSWasmRuntime()
		if err != nil {
			<-highsWasmRuntimeSlots
			return nil, err
		}
		return runtime, nil
	}
}

func releaseHiGHSWasmRuntime(runtime *highsWasmRuntime) {
	if runtime != nil {
		runtime.resetForNextSolve()
		select {
		case highsWasmRuntimePool <- runtime:
		default:
			_ = runtime.instance.Close(runtime.ctx)
		}
	}
	<-highsWasmRuntimeSlots
}

func newHiGHSWasmRuntime() (*highsWasmRuntime, error) {
	module, err := getHiGHSWasmModule()
	if err != nil {
		return nil, err
	}

	runtime := &highsWasmRuntime{
		nextFD: 3,
		files:  map[int32]*highsWasmFile{},
		paths:  map[string][]byte{},
	}
	runtime.ctx = context.WithValue(context.Background(), highsWasmRuntimeContextKey{}, runtime)

	instance, err := module.runtime.InstantiateModule(runtime.ctx, module.module, wazero.NewModuleConfig().WithName("").WithStartFunctions())
	if err != nil {
		return nil, fmt.Errorf("instantiating HiGHS wasm: %w", err)
	}
	runtime.instance = instance
	runtime.memory = instance.ExportedMemory("t")
	if runtime.memory == nil {
		return nil, fmt.Errorf("HiGHS wasm export t is not memory")
	}

	runtime.runtimeInit = mustWasmFunc(instance, "u")
	runtime.highsCreate = mustWasmFunc(instance, "v")
	runtime.highsDestroy = mustWasmFunc(instance, "w")
	runtime.highsRun = mustWasmFunc(instance, "x")
	runtime.highsReadModel = mustWasmFunc(instance, "y")
	runtime.highsWriteSolutionPretty = mustWasmFunc(instance, "A")
	runtime.highsSetIntOption = mustWasmFunc(instance, "C")
	runtime.highsSetDoubleOption = mustWasmFunc(instance, "D")
	runtime.highsSetStringOption = mustWasmFunc(instance, "E")
	runtime.highsGetModelStatus = mustWasmFunc(instance, "F")
	runtime.malloc = mustWasmFunc(instance, "J")
	return runtime, nil
}

func (runtime *highsWasmRuntime) resetForNextSolve() {
	runtime.nextFD = 3
	for fd := range runtime.files {
		delete(runtime.files, fd)
	}
	for path := range runtime.paths {
		delete(runtime.paths, path)
	}
	runtime.stdout.Reset()
	runtime.stderr.Reset()
}

func getHiGHSWasmModule() (*highsWasmModule, error) {
	highsWasmModuleOnce.Do(func() {
		ctx := context.Background()
		runtime := wazero.NewRuntimeWithConfig(ctx, wazero.NewRuntimeConfigCompiler())
		if err := instantiateHiGHSWasmHostModule(ctx, runtime); err != nil {
			highsWasmModuleErr = err
			return
		}
		module, err := runtime.CompileModule(ctx, worker.HighsWASM)
		if err != nil {
			highsWasmModuleErr = fmt.Errorf("compiling embedded highs.wasm: %w", err)
			return
		}
		highsWasmModuleValue = &highsWasmModule{runtime: runtime, module: module}
	})
	return highsWasmModuleValue, highsWasmModuleErr
}

// WarmUp eagerly compiles the embedded HiGHS WASM module, instantiates a runtime, runs its
// one-time init and a trivial solve, then returns the runtime to the pool ready for reuse.
// This moves the ~1s+ module-compile/instantiate/init cost to server startup instead of the
// first reforge-optimize request. It only primes shared lazy state (the compiled module and
// the runtime pool) and never affects solve results, so it is safe to call at any time,
// concurrently, and more than once.
func WarmUp() error {
	_, _, err := solveMIPWithHiGHS(mipModel{
		variables: []mipVariable{{objective: 1, upper: 1, integer: true}},
	}, 5*time.Second, 0)
	return err
}

// Registers the HiGHS wasm host imports using wazero's stack-based
// (GoModuleFunction) dispatch rather than reflection-based WithFunc. HiGHS calls
// these imports (file I/O, clock, heap growth) many times per solve; reflection
// dispatch boxed every argument via reflect.New/reflect.Value.Call, which
// dominated allocations in bulk reforge runs. The stack convention passes params
// as a []uint64 and writes results back in place, eliminating that per-call
// reflection. Behavior is identical — only the calling convention changed.
func instantiateHiGHSWasmHostModule(ctx context.Context, runtime wazero.Runtime) error {
	const i32 = api.ValueTypeI32
	const i64 = api.ValueTypeI64
	const f64 = api.ValueTypeF64

	builder := runtime.NewHostModuleBuilder("a")
	addFunc := func(name string, params []api.ValueType, results []api.ValueType, fn api.GoModuleFunc) {
		builder.NewFunctionBuilder().WithGoModuleFunction(fn, params, results).Export(name)
	}

	nowMillis := func(_ context.Context, _ api.Module, stack []uint64) {
		stack[0] = api.EncodeF64(float64(time.Now().UnixNano()) / float64(time.Millisecond))
	}

	addFunc("a", []api.ValueType{i32, i32, i32}, nil, func(context.Context, api.Module, []uint64) {
		panic("HiGHS wasm exception handling import was called")
	})
	addFunc("b", []api.ValueType{i32}, nil, func(_ context.Context, _ api.Module, stack []uint64) {
		panic(fmt.Sprintf("HiGHS wasm exited with code %d", api.DecodeU32(stack[0])))
	})
	addFunc("c", nil, []api.ValueType{f64}, nowMillis)
	addFunc("d", []api.ValueType{i32, i32, i32}, []api.ValueType{i32}, func(_ context.Context, _ api.Module, stack []uint64) {
		stack[0] = 0
	})
	addFunc("e", []api.ValueType{i32}, []api.ValueType{i32}, func(ctx context.Context, _ api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).fdClose(int32(api.DecodeU32(stack[0])))))
	})
	addFunc("f", []api.ValueType{i32, i32, i32, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).fdRead(module, int32(api.DecodeU32(stack[0])), int32(api.DecodeU32(stack[1])), int32(api.DecodeU32(stack[2])), int32(api.DecodeU32(stack[3])))))
	})
	addFunc("g", []api.ValueType{i32, i32, i32}, []api.ValueType{i32}, func(_ context.Context, _ api.Module, stack []uint64) {
		stack[0] = 0
	})
	addFunc("h", []api.ValueType{i32, i32, i32, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).openAt(module, int32(api.DecodeU32(stack[0])), int32(api.DecodeU32(stack[1])), int32(api.DecodeU32(stack[2])), int32(api.DecodeU32(stack[3])))))
	})
	addFunc("i", []api.ValueType{i32, i32, i32, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).fdWrite(module, int32(api.DecodeU32(stack[0])), int32(api.DecodeU32(stack[1])), int32(api.DecodeU32(stack[2])), int32(api.DecodeU32(stack[3])))))
	})
	addFunc("j", []api.ValueType{i32}, nil, func(_ context.Context, _ api.Module, stack []uint64) {
		panic(fmt.Sprintf("HiGHS wasm exited with code %d", api.DecodeU32(stack[0])))
	})
	addFunc("k", nil, nil, func(context.Context, api.Module, []uint64) { panic("HiGHS wasm abort") })
	addFunc("l", []api.ValueType{i32, f64}, []api.ValueType{i32}, func(_ context.Context, _ api.Module, stack []uint64) {
		stack[0] = 0
	})
	addFunc("m", nil, []api.ValueType{f64}, nowMillis)
	addFunc("n", []api.ValueType{i32, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).environGet(module, int32(api.DecodeU32(stack[0])), int32(api.DecodeU32(stack[1])))))
	})
	addFunc("o", []api.ValueType{i32, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).environSizesGet(module, int32(api.DecodeU32(stack[0])), int32(api.DecodeU32(stack[1])))))
	})
	addFunc("p", []api.ValueType{i32, i64, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).clockTimeGet(module, int32(api.DecodeU32(stack[0])), int32(api.DecodeU32(stack[2])))))
	})
	addFunc("q", []api.ValueType{i32, i64, i32, i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).fdSeek(module, int32(api.DecodeU32(stack[0])), int64(stack[1]), int32(api.DecodeU32(stack[2])), int32(api.DecodeU32(stack[3])))))
	})
	addFunc("r", nil, nil, func(context.Context, api.Module, []uint64) { panic("HiGHS wasm abort") })
	addFunc("s", []api.ValueType{i32}, []api.ValueType{i32}, func(ctx context.Context, module api.Module, stack []uint64) {
		stack[0] = api.EncodeU32(uint32(highsWasmRuntimeFromContext(ctx).resizeHeap(module, int32(api.DecodeU32(stack[0])))))
	})

	if _, err := builder.Instantiate(ctx); err != nil {
		return fmt.Errorf("instantiating HiGHS wasm host imports: %w", err)
	}
	return nil
}

func highsWasmRuntimeFromContext(ctx context.Context) *highsWasmRuntime {
	runtime, _ := ctx.Value(highsWasmRuntimeContextKey{}).(*highsWasmRuntime)
	if runtime == nil {
		panic("missing HiGHS wasm runtime context")
	}
	return runtime
}

func (runtime *highsWasmRuntime) memoryBytes() []byte {
	if runtime.memory == nil {
		return nil
	}
	memory, _ := runtime.memory.Read(0, runtime.memory.Size())
	return memory
}

func moduleMemoryBytes(module api.Module) []byte {
	memory := module.Memory()
	if memory == nil {
		return nil
	}
	bytes, _ := memory.Read(0, memory.Size())
	return bytes
}

func (runtime *highsWasmRuntime) openAt(module api.Module, _ int32, pathPtr int32, _ int32, _ int32) int32 {
	path := runtime.readCString(moduleMemoryBytes(module), pathPtr)
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

func (runtime *highsWasmRuntime) fdRead(module api.Module, fd int32, iovsPtr int32, iovsLen int32, nreadPtr int32) int32 {
	file := runtime.files[fd]
	if file == nil {
		return 8
	}
	memory := moduleMemoryBytes(module)
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

func (runtime *highsWasmRuntime) fdWrite(module api.Module, fd int32, iovsPtr int32, iovsLen int32, nwrittenPtr int32) int32 {
	memory := moduleMemoryBytes(module)
	bytesWritten := int32(0)
	for iovIdx := int32(0); iovIdx < iovsLen; iovIdx++ {
		iovPtr := int(iovsPtr + 8*iovIdx)
		bufferPtr := int32(binary.LittleEndian.Uint32(memory[iovPtr:]))
		bufferLen := int32(binary.LittleEndian.Uint32(memory[iovPtr+4:]))
		if bufferLen <= 0 {
			continue
		}
		switch fd {
		case 1:
			runtime.stdout.Write(memory[bufferPtr : bufferPtr+bufferLen])
		case 2:
			runtime.stderr.Write(memory[bufferPtr : bufferPtr+bufferLen])
		}
		bytesWritten += bufferLen
	}
	binary.LittleEndian.PutUint32(memory[nwrittenPtr:], uint32(bytesWritten))
	return 0
}

func (runtime *highsWasmRuntime) fdSeek(module api.Module, fd int32, offset int64, whence int32, newOffsetPtr int32) int32 {
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
	memory := moduleMemoryBytes(module)
	binary.LittleEndian.PutUint64(memory[newOffsetPtr:], uint64(nextOffset))
	return 0
}

func (runtime *highsWasmRuntime) environSizesGet(module api.Module, countPtr int32, sizePtr int32) int32 {
	memory := moduleMemoryBytes(module)
	binary.LittleEndian.PutUint32(memory[countPtr:], 0)
	binary.LittleEndian.PutUint32(memory[sizePtr:], 0)
	return 0
}

func (runtime *highsWasmRuntime) environGet(_ api.Module, _ int32, _ int32) int32 {
	return 0
}

func (runtime *highsWasmRuntime) clockTimeGet(module api.Module, _ int32, timePtr int32) int32 {
	memory := moduleMemoryBytes(module)
	binary.LittleEndian.PutUint64(memory[timePtr:], uint64(time.Now().UnixNano()))
	return 0
}

func (runtime *highsWasmRuntime) resizeHeap(module api.Module, requestedSize int32) int32 {
	memory := module.Memory()
	if memory == nil {
		return 0
	}
	currentBytes := uint64(memory.Size())
	if uint64(requestedSize) <= currentBytes {
		return 1
	}
	const pageSize = 64 * 1024
	neededPages := uint32((uint64(requestedSize) - currentBytes + pageSize - 1) / pageSize)
	if _, ok := memory.Grow(neededPages); !ok {
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
	ptr, err := callI32(runtime.ctx, runtime.malloc, wasmI32(int32(len(value)+1)))
	if err != nil {
		return 0, fmt.Errorf("allocating HiGHS wasm string: %w", err)
	}
	memory := runtime.memoryBytes()
	copy(memory[ptr:], value)
	memory[int(ptr)+len(value)] = 0
	return ptr, nil
}

func (runtime *highsWasmRuntime) setDoubleOption(highs int32, name string, value float64) error {
	namePtr, err := runtime.writeCString(name)
	if err != nil {
		return err
	}
	status, err := callI32(runtime.ctx, runtime.highsSetDoubleOption, wasmI32(highs), wasmI32(namePtr), api.EncodeF64(value))
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
	status, err := callI32(runtime.ctx, runtime.highsSetStringOption, wasmI32(highs), wasmI32(namePtr), wasmI32(valuePtr))
	if err != nil {
		return fmt.Errorf("setting HiGHS wasm option %q: %w", name, err)
	}
	if !isHighsSuccess(status) {
		return fmt.Errorf("failed setting HiGHS wasm option %q: %d", name, status)
	}
	return nil
}

func callI32(ctx context.Context, fn api.Function, args ...uint64) (int32, error) {
	results, err := fn.Call(ctx, args...)
	if err != nil {
		return 0, err
	}
	if len(results) == 0 {
		return 0, fmt.Errorf("expected i32 result, got no results")
	}
	return int32(uint32(results[0])), nil
}

func wasmI32(value int32) uint64 {
	return uint64(uint32(value))
}

func mustWasmFunc(instance api.Module, name string) api.Function {
	fn := instance.ExportedFunction(name)
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
