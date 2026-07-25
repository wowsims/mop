// Package config binds the db2tool settings files, tools/database/
// generator-settings.json and ptr-generator-settings.json.
package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// Settings is the settings file's "Settings" section: which product to extract
// and the install to read it from.
type Settings struct {
	Product string `json:"Product"`
	BaseDir string `json:"BaseDir"`
}

type File struct {
	Settings Settings `json:"Settings"`
	// TargetDirectory does double duty (listfile-key prefix AND output dir);
	// the FDID/listfile use must always see the raw value, never a
	// filesystem-resolved path.
	TargetDirectory        string   `json:"TargetDirectory"`
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
