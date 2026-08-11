// Go translation of TACTSharp's CASCIndexInstance + the local-archive read
// from CDN.TryGetLocalFile (https://github.com/wowdev/TACTSharp,
// v0.0.13-alpha, commit d0ab516eb98b5db35682467b6e4977d88955046d).
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.

package tact

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// cascIndex is one parsed .idx bucket file (v7: 9-byte key prefixes, 5-byte
// packed archive/offset, 4-byte size).
type cascIndex struct {
	entrySizeBytes   int
	entryOffsetBytes int
	entryKeyBytes    int
	entries          []byte // raw entry block
	entrySize        int
}

const cascIdxHeaderSize = 40

func loadCascIndex(path string) (*cascIndex, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if len(raw) < cascIdxHeaderSize {
		return nil, fmt.Errorf("%s: too small for .idx header", path)
	}
	// IndexHeader layout:
	// u32 headerHashSize, u32 headerHash, u16 version, u8 bucketIndex,
	// u8 extraBytes, u8 entrySizeBytes, u8 entryOffsetBytes, u8 entryKeyBytes,
	// u8 entryOffsetBits, u64 maxArchiveSize @16, 8 pad, u32 entriesSize @32.
	version := binary.LittleEndian.Uint16(raw[8:10])
	if version != 7 {
		return nil, fmt.Errorf("%s: unsupported .idx version %d (want 7)", path, version)
	}
	idx := &cascIndex{
		entrySizeBytes:   int(raw[12]),
		entryOffsetBytes: int(raw[13]),
		entryKeyBytes:    int(raw[14]),
	}
	idx.entrySize = idx.entrySizeBytes + idx.entryOffsetBytes + idx.entryKeyBytes
	entriesSize := int(binary.LittleEndian.Uint32(raw[32:36]))
	if cascIdxHeaderSize+entriesSize > len(raw) {
		return nil, fmt.Errorf("%s: entries block exceeds file size", path)
	}
	idx.entries = raw[cascIdxHeaderSize : cascIdxHeaderSize+entriesSize]
	return idx, nil
}

// getIndexInfo returns (archiveOffset, size, archiveIndex) for an eKey, with
// the 30-byte per-entry storage frame already skipped (offset+30, size-30),
// or (-1,-1,-1) when absent.
//
// Deviation from upstream, in the safe direction: TACTSharp reports a miss
// whenever lower_bound lands on entry 0 even if it matches; this port accepts
// a genuine entry-0 match (upstream silently falls back to the CDN there —
// this pure-local port has no fallback to hide behind).
func (idx *cascIndex) getIndexInfo(eKey []byte) (int64, int, int) {
	needle := eKey[:idx.entryKeyBytes]
	n := len(idx.entries) / idx.entrySize
	lo, hi := 0, n
	for lo < hi {
		mid := (lo + hi) / 2
		key := idx.entries[mid*idx.entrySize : mid*idx.entrySize+idx.entryKeyBytes]
		if bytes.Compare(key, needle) < 0 {
			lo = mid + 1
		} else {
			hi = mid
		}
	}
	if lo >= n {
		return -1, -1, -1
	}
	entry := idx.entries[lo*idx.entrySize : (lo+1)*idx.entrySize]
	if !bytes.Equal(entry[:idx.entryKeyBytes], needle) {
		return -1, -1, -1
	}
	k := idx.entryKeyBytes
	indexHigh := int(entry[k])
	indexLow := int(binary.BigEndian.Uint32(entry[k+1 : k+5]))
	size := int(binary.LittleEndian.Uint32(entry[k+5:k+5+idx.entrySizeBytes])) - 30
	archiveIndex := indexHigh<<2 | (indexLow&0xC0000000)>>30
	archiveOffset := int64(indexLow&0x3FFFFFFF) + 30
	return archiveOffset, size, archiveIndex
}

// cascStore is the set of .idx buckets plus the data.NNN archive directory.
type cascStore struct {
	dataDir string
	buckets map[byte]*cascIndex
}

// openCascStore loads the highest-version .idx per bucket from
// <BaseDir>/Data/data (CDN.LoadCASCIndices).
func openCascStore(baseDir string) (*cascStore, error) {
	dataDir := filepath.Join(baseDir, "Data", "data")
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, err
	}
	highest := map[byte]int64{}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".idx") || strings.Contains(name, "tempfile") {
			continue
		}
		stem := strings.TrimSuffix(name, ".idx")
		if len(stem) != 10 {
			continue
		}
		var bucket byte
		if _, err := fmt.Sscanf(stem[0:2], "%02x", &bucket); err != nil {
			continue
		}
		var version int64
		if _, err := fmt.Sscanf(stem[2:], "%08x", &version); err != nil {
			continue
		}
		if v, ok := highest[bucket]; !ok || version > v {
			highest[bucket] = version
		}
	}
	if len(highest) == 0 {
		return nil, fmt.Errorf("no .idx files found in %s", dataDir)
	}
	store := &cascStore{dataDir: dataDir, buckets: map[byte]*cascIndex{}}
	for bucket, version := range highest {
		path := filepath.Join(dataDir, fmt.Sprintf("%02x%08x.idx", bucket, version))
		idx, err := loadCascIndex(path)
		if err != nil {
			return nil, err
		}
		store.buckets[bucket] = idx
	}
	return store, nil
}

// bucketForEKey ports CDN.TryGetLocalFile's bucket selection: XOR of the
// first 9 eKey bytes, then fold nibbles.
func bucketForEKey(eKey []byte) byte {
	i := eKey[0] ^ eKey[1] ^ eKey[2] ^ eKey[3] ^ eKey[4] ^ eKey[5] ^ eKey[6] ^ eKey[7] ^ eKey[8]
	return (i & 0xf) ^ (i >> 4)
}

// readEKey returns the raw (BLTE-encoded) bytes for an eKey from the local
// archives, or an error when the key is not locally resident.
func (s *cascStore) readEKey(eKey []byte) ([]byte, error) {
	idx, ok := s.buckets[bucketForEKey(eKey)]
	if !ok {
		return nil, fmt.Errorf("no .idx bucket %02x", bucketForEKey(eKey))
	}
	offset, size, archiveIndex := idx.getIndexInfo(eKey)
	if offset == -1 {
		return nil, fmt.Errorf("eKey %x not found in local CASC indices", eKey)
	}
	archivePath := filepath.Join(s.dataDir, fmt.Sprintf("data.%03d", archiveIndex))
	f, err := os.Open(archivePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	buf := make([]byte, size)
	if _, err := f.ReadAt(buf, offset); err != nil {
		return nil, fmt.Errorf("reading %s @%d+%d: %w", archivePath, offset, size, err)
	}
	return buf, nil
}
