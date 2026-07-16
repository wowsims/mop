// Settings JSON binding for tools/db2tool — mirrors the configuration shape
// consumed by tools/DB2ToSqlite/Program.cs (generator-settings.json /
// ptr-generator-settings.json). Original repo code (MIT).
package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// Settings mirrors the TACTSharp-bindable "Settings" section. Only the fields
// the tool actually consumes are used today; the rest are bound for
// compatibility (CacheDir is bound-but-unused in v1, plan §3.1).
type Settings struct {
	Region      string `json:"Region"`
	Product     string `json:"Product"`
	BaseDir     string `json:"BaseDir"`
	BuildConfig string `json:"BuildConfig"`
	CDNConfig   string `json:"CDNConfig"`
	CacheDir    string `json:"CacheDir"`
	Locale      string `json:"Locale"`
}

type File struct {
	Settings Settings `json:"Settings"`
	// TargetDirectory does double duty upstream (listfile-key prefix AND
	// output dir — plan §7 M4); the FDID/listfile use must always see the raw
	// value, never a filesystem-resolved path.
	TargetDirectory        string   `json:"TargetDirectory"`
	DatabaseFile           string   `json:"DatabaseFile"` // dead code upstream (plan §10 Q7); bound, never read
	GameTablesOutDirectory string   `json:"GameTablesOutDirectory"`
	GameTables             []string `json:"GameTables"`
	Tables                 []string `json:"Tables"`
}

func Load(path string) (*File, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var f File
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if f.TargetDirectory == "" {
		f.TargetDirectory = "dbfilesclient"
	}
	if f.GameTablesOutDirectory == "" {
		f.GameTablesOutDirectory = "GameTables"
	}
	return &f, nil
}
