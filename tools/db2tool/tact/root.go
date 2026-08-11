// Go translation of TACTSharp's RootInstance (https://github.com/wowdev/TACTSharp,
// v0.0.13-alpha, commit d0ab516eb98b5db35682467b6e4977d88955046d) — Normal
// load mode, enUS locale, FDID→CKey only.
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.

package tact

import (
	"encoding/binary"
	"fmt"
)

const (
	localeEnUS         = 0x2
	localeAllWoW       = 0x2 | 0x4 | 0x10 | 0x20 | 0x40 | 0x80 | 0x100 | 0x200 | 0x1000 | 0x2000 | 0x4000 | 0x8000 | 0x10000
	contentLowViolence = 0x80
	contentNoNames     = 0x10000000
	tsfmMagic          = 1296454484 // "TSFM"
)

// rootTable maps FDID → CKey (first entry wins, like entriesFDID.TryAdd).
type rootTable struct {
	byFDID map[uint32][16]byte
}

func parseRoot(data []byte) (*rootTable, error) {
	r := &rootTable{byFDID: map[uint32][16]byte{}}
	if len(data) < 12 {
		return nil, fmt.Errorf("root file too small")
	}

	newRoot := false
	dfVersion := uint32(0)
	offset := 0

	if binary.LittleEndian.Uint32(data) == tsfmMagic {
		newRoot = true
		offset = 12
		totalFiles := binary.LittleEndian.Uint32(data[4:])
		namedFiles := binary.LittleEndian.Uint32(data[8:])
		if namedFiles == 1 || namedFiles == 2 {
			// Post-10.1.7 header: [magic, headerSize, dfVersion, ...]
			dfHeaderSize := totalFiles
			dfVersion = namedFiles
			offset = int(dfHeaderSize)
		}
		_ = totalFiles
	}

	for offset < len(data) {
		if offset+4 > len(data) {
			return nil, fmt.Errorf("truncated root block header at %d", offset)
		}
		count := int(binary.LittleEndian.Uint32(data[offset:]))
		offset += 4

		var contentFlags, localeFlags uint32
		if dfVersion == 2 {
			localeFlags = binary.LittleEndian.Uint32(data[offset:])
			unkFlags := binary.LittleEndian.Uint32(data[offset+4:])
			unkFlags2 := binary.LittleEndian.Uint32(data[offset+8:])
			unkByte := uint32(data[offset+12])
			offset += 13
			contentFlags = unkFlags | unkFlags2 | unkByte<<17
		} else {
			contentFlags = binary.LittleEndian.Uint32(data[offset:])
			localeFlags = binary.LittleEndian.Uint32(data[offset+4:])
			offset += 8
		}

		localeSkip := localeFlags&localeAllWoW != localeAllWoW && localeFlags&localeEnUS == 0
		contentSkip := contentFlags&contentLowViolence != 0
		skipChunk := localeSkip || contentSkip

		separateLookup := newRoot
		doLookup := !newRoot || contentFlags&contentNoNames == 0
		const sizeFdid, sizeCHash, sizeLookup = 4, 16, 8
		strideCHash := sizeCHash + sizeLookup
		if separateLookup {
			strideCHash = sizeCHash
		}
		offsetFdid := offset
		offsetCHash := offsetFdid + count*sizeFdid
		blockSize := count * (sizeFdid + sizeCHash)
		if doLookup {
			blockSize += count * sizeLookup
		}
		if offset+blockSize > len(data) {
			return nil, fmt.Errorf("truncated root block at %d (need %d bytes)", offset, blockSize)
		}

		if !skipChunk {
			fileDataIndex := uint32(0)
			for range count {
				fdidOffset := binary.LittleEndian.Uint32(data[offsetFdid:])
				offsetFdid += sizeFdid
				fdid := fileDataIndex + fdidOffset
				fileDataIndex = fdid + 1

				var md5 [16]byte
				copy(md5[:], data[offsetCHash:offsetCHash+sizeCHash])
				offsetCHash += strideCHash

				if _, exists := r.byFDID[fdid]; !exists {
					r.byFDID[fdid] = md5
				}
			}
		}

		offset += blockSize
	}
	return r, nil
}
