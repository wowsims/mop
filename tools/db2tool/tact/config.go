// Go translation of TACTSharp's Config (https://github.com/wowdev/TACTSharp,
// v0.0.13-alpha, commit d0ab516eb98b5db35682467b6e4977d88955046d).
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.

package tact

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// LoadConfig reads a build/CDN config from the local install's
// Data/config/<xx>/<yy>/<hash> layout. Values are space-separated (typically
// `ckey [ekey]`). All keys are kept, including the ~318 unused `vfs-*` TVFS
// lines — they parse fine and are simply never consulted.
func LoadConfig(baseDir, hash string) (map[string][]string, error) {
	if len(hash) != 32 {
		return nil, fmt.Errorf("invalid config hash %q", hash)
	}
	path := filepath.Join(baseDir, "Data", "config", hash[0:2], hash[2:4], hash)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || raw[0] != '#' {
		return nil, fmt.Errorf("%s: config file is unreadable", path)
	}
	values := map[string][]string{}
	for line := range strings.SplitSeq(string(raw), "\n") {
		splitLine := strings.SplitN(line, "=", 2)
		if len(splitLine) > 1 {
			values[strings.TrimSpace(splitLine[0])] = strings.Split(strings.TrimSpace(splitLine[1]), " ")
		}
	}
	return values, nil
}
