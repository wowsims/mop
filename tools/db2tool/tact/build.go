// Local-CASC build orchestration — the pure-local equivalent of TACTSharp's
// BuildInstance (https://github.com/wowdev/TACTSharp, v0.0.13-alpha, commit
// d0ab516eb98b5db35682467b6e4977d88955046d): FDID → root CKey → encoding EKey
// → local .idx → data.NNN → BLTE. No CDN, no group/file indices (upstream
// consults them but the local .idx always wins for resident files).
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.
package tact

import (
	"encoding/hex"
	"fmt"
	"path/filepath"
)

type Build struct {
	Entry       AvailableBuild
	BuildNumber uint32
	BuildConfig map[string][]string
	CDNConfig   map[string][]string

	store    *cascStore
	encoding *encodingTable
	root     *rootTable
}

// Open loads everything needed to serve OpenFileByFDID from a local install.
func Open(baseDir, product string) (*Build, error) {
	entries, err := ParseBuildInfo(filepath.Join(baseDir, ".build.info"))
	if err != nil {
		return nil, err
	}
	entry, err := SelectBuild(entries, product)
	if err != nil {
		return nil, err
	}
	buildNumber, err := BuildNumber(entry.Version)
	if err != nil {
		return nil, err
	}

	buildConfig, err := LoadConfig(baseDir, entry.BuildConfig)
	if err != nil {
		return nil, fmt.Errorf("loading build config: %w", err)
	}
	cdnConfig, err := LoadConfig(baseDir, entry.CDNConfig)
	if err != nil {
		return nil, fmt.Errorf("loading cdn config: %w", err)
	}

	store, err := openCascStore(baseDir)
	if err != nil {
		return nil, fmt.Errorf("opening local CASC store: %w", err)
	}

	b := &Build{
		Entry:       entry,
		BuildNumber: buildNumber,
		BuildConfig: buildConfig,
		CDNConfig:   cdnConfig,
		store:       store,
	}

	// Encoding: the build config's `encoding` line is `ckey ekey`; open by the
	// EKey directly (BuildInstance.Load uses encoding[1]).
	encodingKeys, ok := buildConfig["encoding"]
	if !ok || len(encodingKeys) < 2 {
		return nil, fmt.Errorf("no encoding key pair in build config")
	}
	encodingRaw, err := b.openEKeyHex(encodingKeys[1], 0)
	if err != nil {
		return nil, fmt.Errorf("opening encoding file: %w", err)
	}
	if b.encoding, err = parseEncoding(encodingRaw); err != nil {
		return nil, err
	}

	// Root: config gives the CKey; resolve via encoding.
	rootKey, ok := buildConfig["root"]
	if !ok || len(rootKey) < 1 {
		return nil, fmt.Errorf("no root key in build config")
	}
	rootCKey, err := hex.DecodeString(rootKey[0])
	if err != nil {
		return nil, fmt.Errorf("invalid root ckey: %w", err)
	}
	rootRaw, err := b.OpenFileByCKey(rootCKey)
	if err != nil {
		return nil, fmt.Errorf("opening root file: %w", err)
	}
	if b.root, err = parseRoot(rootRaw); err != nil {
		return nil, err
	}

	return b, nil
}

func (b *Build) openEKeyHex(eKeyHex string, decodedSize uint64) ([]byte, error) {
	eKey, err := hex.DecodeString(eKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid ekey %q: %w", eKeyHex, err)
	}
	return b.openEKey(eKey, decodedSize)
}

func (b *Build) openEKey(eKey []byte, decodedSize uint64) ([]byte, error) {
	raw, err := b.store.readEKey(eKey)
	if err != nil {
		return nil, err
	}
	return blteDecode(raw, decodedSize)
}

// OpenFileByCKey resolves a content key through encoding and opens the first
// encoding key locally.
func (b *Build) OpenFileByCKey(cKey []byte) ([]byte, error) {
	eKey, decodedSize, ok := b.encoding.findContentKey(cKey)
	if !ok {
		return nil, fmt.Errorf("ckey %x not found in encoding", cKey)
	}
	return b.openEKey(eKey, decodedSize)
}

// OpenFileByFDID opens a file by its file data id via the WoW root.
func (b *Build) OpenFileByFDID(fdid uint32) ([]byte, error) {
	cKey, ok := b.root.byFDID[fdid]
	if !ok {
		return nil, fmt.Errorf("fdid %d not found in root", fdid)
	}
	data, err := b.OpenFileByCKey(cKey[:])
	if err != nil {
		return nil, fmt.Errorf("fdid %d: %w", fdid, err)
	}
	return data, nil
}
