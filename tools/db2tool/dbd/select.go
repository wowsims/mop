// Go translation of the version-selection rule used by this repo's
// SQLiteDbCreator.cs / SqliteDataInserter.cs (see docs/db2tool-migration-plan.md §5.1).
// Derived from DBDefsLib types (https://github.com/wowdev/WoWDBDefs).
// Copyright 2022 WoWDBDefs Contributors. BSD-3-Clause — see tools/db2tool/NOTICES.md.
package dbd

import "fmt"

// SelectVersion returns the LAST versionDefinition (in file order) whose
// Builds list contains an entry with trailing build number == buildNumber.
//
// This is deliberately the SQLite helpers' rule replicated bug-for-bug:
// exact equality on the trailing build number only — buildRanges and
// layoutHashes are NOT consulted (plan §5.1). The C# row-decode half uses a
// different rule (first match on the full 4-part version, with range and
// layout-hash fallbacks); at the time of the port both rules resolve to the
// same block for every configured table, and this single selector fails loud
// exactly where the two C# halves would diverge.
func SelectVersion(def DBDefinition, buildNumber uint32) (VersionDefinitions, error) {
	for i := len(def.VersionDefinitions) - 1; i >= 0; i-- {
		for _, b := range def.VersionDefinitions[i].Builds {
			if b.Build == buildNumber {
				return def.VersionDefinitions[i], nil
			}
		}
	}
	return VersionDefinitions{}, fmt.Errorf(
		"build %d not found in the .dbd definition — WoWDBDefs may not contain this build yet; wait for upstream or refresh DBDCache", buildNumber)
}
