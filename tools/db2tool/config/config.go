// Settings JSON binding for tools/db2tool (generator-settings.json /
// ptr-generator-settings.json).
package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// Settings is the settings file's "Settings" section. Only the fields the
// tool actually consumes are used today; the rest are bound so existing
// settings files parse cleanly (CacheDir and Locale are bound-but-unused).
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
	// TargetDirectory does double duty (listfile-key prefix AND output dir);
	// the FDID/listfile use must always see the raw value, never a
	// filesystem-resolved path.
	TargetDirectory        string   `json:"TargetDirectory"`
	DatabaseFile           string   `json:"DatabaseFile"` // bound, never read — the --output flag decides the path
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
