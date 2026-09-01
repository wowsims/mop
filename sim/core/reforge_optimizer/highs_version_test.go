package reforgeoptimizer

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	worker "github.com/wowsims/mop/ui/worker"
)

// repoRoot is this package's path back to the repository root, where package.json lives.
const repoRoot = "../../.."

const updateHiGHSHint = "run `make update-highs` and commit the result"

// TestHiGHSArtifactsMatchPinnedVersion guards the one thing that cannot be checked at compile
// time: that ui/worker/highs.wasm and ui/worker/highs_names_gen.go were generated from the `highs`
// version package.json pins. Bumping the pin without regenerating leaves the Go host looking up
// minified names from the wrong build, which fails in confusing ways at solve time (or, worse,
// leaves the backend solving on a different HiGHS than the browser).
func TestHiGHSArtifactsMatchPinnedVersion(t *testing.T) {
	pinned := pinnedHiGHSVersion(t)

	if worker.HighsVersion != pinned {
		t.Errorf("package.json pins highs %s but ui/worker/highs_names_gen.go was generated from %s; %s",
			pinned, worker.HighsVersion, updateHiGHSHint)
	}
}

// TestHiGHSArtifactsMatchInstalledPackage checks the committed wasm against the one in
// node_modules, so a stale artifact is caught even when the version number happens to line up.
// It skips when the package is not installed: `go build` and `go test` must keep working on a
// fresh clone with no npm.
func TestHiGHSArtifactsMatchInstalledPackage(t *testing.T) {
	npmDir := filepath.Join(repoRoot, "node_modules", "highs")
	if _, err := os.Stat(npmDir); os.IsNotExist(err) {
		t.Skip("node_modules/highs is not installed")
	}

	installed := npmPackageVersion(t, filepath.Join(npmDir, "package.json"))
	if pinned := pinnedHiGHSVersion(t); installed != pinned {
		t.Fatalf("package.json pins highs %s but node_modules has %s; run `npm install`", pinned, installed)
	}

	installedWASM, err := os.ReadFile(filepath.Join(npmDir, "build", "highs.wasm"))
	if err != nil {
		t.Fatalf("reading node_modules/highs/build/highs.wasm: %v", err)
	}
	if !bytes.Equal(installedWASM, worker.HighsWASM) {
		t.Errorf("ui/worker/highs.wasm (%d bytes) does not match node_modules/highs/build/highs.wasm (%d bytes); %s",
			len(worker.HighsWASM), len(installedWASM), updateHiGHSHint)
	}
}

// pinnedHiGHSVersion returns the `highs` version from package.json, which must be an exact
// version rather than a range: the generated name map only describes one upstream build, so
// allowing npm to resolve a newer one would silently invalidate it.
func pinnedHiGHSVersion(t *testing.T) string {
	t.Helper()

	path := filepath.Join(repoRoot, "package.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	var manifest struct {
		Dependencies map[string]string `json:"dependencies"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("parsing %s: %v", path, err)
	}

	pinned, ok := manifest.Dependencies["highs"]
	if !ok {
		t.Fatalf("%s has no highs dependency", path)
	}
	if strings.ContainsAny(pinned, "^~*<>= |x") {
		t.Fatalf("package.json must pin highs to an exact version, got %q", pinned)
	}
	return pinned
}

func npmPackageVersion(t *testing.T, path string) string {
	t.Helper()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	var manifest struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("parsing %s: %v", path, err)
	}
	return manifest.Version
}
