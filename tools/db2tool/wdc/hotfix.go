// Go translation of DBCD.IO's hotfix support — HotfixReader, HTFXReader and
// HotfixEntryV9 (https://github.com/wowdev/DBCD, v2.1.2, commit
// 2180edb4d08b3822b3cfa964293ba8ccd4236ac0) — plus the DBCache scanning and
// SStrHash table-name hash ported from wow.tools.local's HotfixManager /
// DBCacheParser (https://github.com/Marlamin/wow.tools.local, via this repo's
// tools/DB2ToSqlite/Helpers copies).
// Copyright (c) 2020 wowdev; Copyright (c) 2022 Martin Benjamins.
// MIT License — see tools/db2tool/NOTICES.md.
package wdc

import (
	"encoding/binary"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wowsims/mop/tools/db2tool/dbd"
)

const hotfixMagic = "XFTH"

// HotfixEntry is one XFTH v9 record: the HotfixEntryV9 header plus its data
// blob. DataSize always equals len(Data) after parsing; it is kept explicit
// because it is part of the Combine dedup identity.
type HotfixEntry struct {
	RegionID  int32
	PushID    int32
	UniqueID  int32
	TableHash uint32
	RecordID  int32
	DataSize  int32
	IsValid   bool // status/op byte == 1
	Data      []byte
}

// hotfixIdentity is the effective HashSet<HTFXRow> identity Combine dedups
// on. HTFXRow.Equals compares the 5-tuple, but GetHashCode also hashes the
// record's data bytes (BitReader.GetHashCode), so records that differ only
// in data land in different buckets and are both kept — full-record identity,
// not the 5-tuple alone (plan §6 Phase D). RegionID/UniqueID never
// participate.
type hotfixIdentity struct {
	pushID    int32
	tableHash uint32
	recordID  int32
	isValid   bool
	dataSize  int32
	data      string
}

func (e *HotfixEntry) identity() hotfixIdentity {
	return hotfixIdentity{
		pushID:    e.PushID,
		tableHash: e.TableHash,
		recordID:  e.RecordID,
		isValid:   e.IsValid,
		dataSize:  e.DataSize,
		data:      string(e.Data),
	}
}

// HotfixReader holds every hotfix record of one DBCache build, in
// file/combine insertion order.
type HotfixReader struct {
	Version int32
	BuildID int32
	records []HotfixEntry
}

// ReadHotfixFile parses one DBCache-format file. Only XFTH version 9 (the
// current live-client format) is supported; older versions fail loud (the C#
// HTFXReader also handles v1–v8 for long-obsolete clients — deliberately not
// ported, plan's minimal-surface rule).
func ReadHotfixFile(path string) (*HotfixReader, error) {
	buf, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	h, err := parseHotfix(buf)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return h, nil
}

func parseHotfix(buf []byte) (*HotfixReader, error) {
	if len(buf) < 12 {
		return nil, fmt.Errorf("hotfix file is corrupted (shorter than the 12-byte header)")
	}
	if string(buf[0:4]) != hotfixMagic {
		return nil, fmt.Errorf("hotfix file is corrupted (bad magic %q)", string(buf[0:4]))
	}
	h := &HotfixReader{
		Version: int32(binary.LittleEndian.Uint32(buf[4:8])),
		BuildID: int32(binary.LittleEndian.Uint32(buf[8:12])),
	}
	if h.Version != 9 {
		return nil, fmt.Errorf("unsupported DBCache version %d (only XFTH v9 is supported)", h.Version)
	}
	// Version >= 5 extended header: a 32-byte SHA hash, skipped.
	if len(buf) < 44 {
		return nil, fmt.Errorf("hotfix file is corrupted (shorter than the 44-byte extended header)")
	}
	pos := 44

	for pos < len(buf) {
		if pos+4 > len(buf) || string(buf[pos:pos+4]) != hotfixMagic {
			return nil, fmt.Errorf("hotfix file is corrupted (bad entry magic at offset %d)", pos)
		}
		pos += 4
		if pos+28 > len(buf) {
			return nil, fmt.Errorf("hotfix file is corrupted (truncated entry header at offset %d)", pos)
		}
		e := HotfixEntry{
			RegionID:  int32(binary.LittleEndian.Uint32(buf[pos:])),
			PushID:    int32(binary.LittleEndian.Uint32(buf[pos+4:])),
			UniqueID:  int32(binary.LittleEndian.Uint32(buf[pos+8:])),
			TableHash: binary.LittleEndian.Uint32(buf[pos+12:]),
			RecordID:  int32(binary.LittleEndian.Uint32(buf[pos+16:])),
			DataSize:  int32(binary.LittleEndian.Uint32(buf[pos+20:])),
			IsValid:   buf[pos+24] == 1,
			// buf[pos+25:pos+28] is padding.
		}
		pos += 28
		if e.DataSize < 0 || pos+int(e.DataSize) > len(buf) {
			return nil, fmt.Errorf("hotfix file is corrupted (truncated entry data at offset %d, size %d)", pos, e.DataSize)
		}
		e.Data = buf[pos : pos+int(e.DataSize) : pos+int(e.DataSize)]
		pos += int(e.DataSize)
		h.records = append(h.records, e)
	}
	return h, nil
}

// Combine ports HTFXReader.Combine (+ HotfixReader.CombineCache's build
// check): other's records are appended in order unless an identical record
// is already present. Readers for a different build are ignored.
func (h *HotfixReader) Combine(other *HotfixReader) {
	if other.BuildID != h.BuildID {
		return
	}
	lookup := make(map[hotfixIdentity]struct{}, len(h.records))
	for i := range h.records {
		lookup[h.records[i].identity()] = struct{}{}
	}
	for i := range other.records {
		id := other.records[i].identity()
		if _, ok := lookup[id]; !ok {
			h.records = append(h.records, other.records[i])
			lookup[id] = struct{}{}
		}
	}
}

// CombineHotfixFiles parses each file in order into readers keyed by BuildId:
// the first file seen for a build becomes its base reader and later files
// Combine into it — HotfixManager.LoadCaches's per-file loop. (C# also
// re-Combines the base file into itself, a no-op under the dedup.)
func CombineHotfixFiles(files []string) (map[uint32]*HotfixReader, error) {
	readers := make(map[uint32]*HotfixReader)
	for _, f := range files {
		r, err := ReadHotfixFile(f)
		if err != nil {
			return nil, err
		}
		if base, ok := readers[uint32(r.BuildID)]; ok {
			base.Combine(r)
		} else {
			readers[uint32(r.BuildID)] = r
		}
		fmt.Printf("Loaded hotfixes from %s for build %d\n", f, r.BuildID)
	}
	return readers, nil
}

// LoadHotfixCaches ports HotfixManager.LoadCaches's scan: if cachesDir
// exists, every *.bin under it (recursively) loads first, then every file
// named DBCache.bin anywhere under baseDir. Finding no cache file is not an
// error (the no-hotfix throw in Program.cs:102 is commented out); a malformed
// or unsupported-version file fails loud. Files are visited in WalkDir's
// deterministic lexical order (.NET's enumeration order is unspecified).
func LoadHotfixCaches(cachesDir, baseDir string) (map[uint32]*HotfixReader, error) {
	var files []string
	if st, err := os.Stat(cachesDir); err == nil && st.IsDir() {
		err := filepath.WalkDir(cachesDir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !d.IsDir() && strings.HasSuffix(d.Name(), ".bin") {
				files = append(files, path)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	err := filepath.WalkDir(baseDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && d.Name() == "DBCache.bin" {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return CombineHotfixFiles(files)
}

// SStrHash ports HotfixManager.Hash — the Blizzard SStrHash variant DBCache
// table hashes use. Callers hash the UPPERCASED table name; the result equals
// the table's WDC5 header TableHash (which ApplyHotfixes actually keys on,
// like C# parser.TableHash).
func SStrHash(s string) uint32 {
	sHashtable := [16]uint32{
		0x486E26EE, 0xDCAA16B3, 0xE1918EEF, 0x202DAFDB,
		0x341C7DC7, 0x1C365303, 0x40EF2D37, 0x65FD5E49,
		0xD6057177, 0x904ECE93, 0x1C38024F, 0x98FD323B,
		0xE3061AE7, 0xA39B0FA1, 0x9797F25F, 0xE4444563,
	}
	v := uint32(0x7fed7fed)
	x := uint32(0xeeeeeeee)
	for i := 0; i < len(s); i++ {
		c := uint32(s[i])
		v += x
		v ^= sHashtable[(c>>4)&0xf] - sHashtable[c&0xf]
		x = x*33 + v + c + 3
	}
	return v
}

// ApplyHotfixes ports HotfixReader.ReadHotfixes (with DefaultProcessor) +
// DBCDStorage.ApplyingHotfixes: this reader's records for table t overlay
// decoded in place. Records apply in a stable ascending-PushId sort
// (file/combine insertion order preserved within a PushId). An Add
// (IsValid && DataSize > 0) replaces or inserts the whole row decoded from
// the blob; otherwise the row is deleted when shouldDelete. Rows come back
// out in ascending-ID order, keeping the Phase A/B insertion contract.
func (h *HotfixReader) ApplyHotfixes(t *Table, def dbd.DBDefinition, version dbd.VersionDefinitions, buildNumber uint32, decoded *Decoded) error {
	var recs []*HotfixEntry
	for i := range h.records {
		if h.records[i].TableHash == t.TableHash {
			recs = append(recs, &h.records[i])
		}
	}
	if len(recs) == 0 {
		return nil
	}

	plans, err := buildFieldPlans(def, version, buildNumber)
	if err != nil {
		return err
	}

	sort.SliceStable(recs, func(i, j int) bool { return recs[i].PushID < recs[j].PushID })

	// The shouldDelete carve-out only affects TactKey (0xDF2F53CF) and
	// BroadcastText (0x021826BB), neither of which is in Tables[] — ported
	// faithfully anyway (plan §6 Phase D).
	anyValidCached := false
	for _, r := range recs {
		if r.IsValid && r.PushID == -1 && r.DataSize > 0 {
			anyValidCached = true
			break
		}
	}
	shouldDelete := (t.TableHash != 0xDF2F53CF && t.TableHash != 0x021826BB) || !anyValidCached

	byID := make(map[int32][]any, len(decoded.Rows))
	for _, row := range decoded.Rows {
		byID[row.ID] = row.Values
	}

	for _, rec := range recs {
		switch {
		case rec.IsValid && rec.DataSize > 0: // RowOp.Add
			values, err := decodeHotfixRow(t, plans, rec)
			if err != nil {
				return fmt.Errorf("hotfix record %d (push %d): %w", rec.RecordID, rec.PushID, err)
			}
			byID[rec.RecordID] = values
		case shouldDelete: // RowOp.Delete
			delete(byID, rec.RecordID)
		}
		// else RowOp.Ignore
	}

	ids := make([]int32, 0, len(byID))
	for id := range byID {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	rows := make([]Row, len(ids))
	for i, id := range ids {
		rows[i] = Row{ID: id, Values: byID[id]}
	}
	decoded.Rows = rows
	return nil
}

// decodeHotfixRow ports HTFXRow.GetFields. Hotfix blobs are NOT bitpacked:
// fields are byte-aligned little-endian values in definition order, at their
// DBD-declared widths, with strings inline null-terminated. The non-inline ID
// is absent from the blob (IndexMapField) and comes from RecordId; a
// non-inline relation IS in the blob at its DBD-declared type
// (MetaDataFieldType), then Convert.ChangeType'd to int.
func decodeHotfixRow(t *Table, plans []fieldPlan, rec *HotfixEntry) ([]any, error) {
	r := newBitReader(padRecordData(rec.Data))
	values := make([]any, len(plans))

	for i := range plans {
		p := &plans[i]

		// FieldCache.IndexMapField: set at construction for a non-inline DBD
		// id, and forced by ReadHotfixes on parser.IdFieldIndex when the
		// Index flag is set.
		if p.isNonInlineID || (t.Flags&flagIndex != 0 && i == int(t.IdFieldIndex)) {
			values[i] = int64(rec.RecordID)
			continue
		}

		if p.isNonInlineRel {
			if p.arrLength != 0 {
				// C# Convert.ChangeType to int[] would throw InvalidCastException.
				return nil, fmt.Errorf("field %s: non-inline relation arrays are not supported", p.name)
			}
			if p.hfKind != kindInt {
				return nil, fmt.Errorf("field %s: non-integer non-inline relation is not supported", p.name)
			}
			v, err := toInt32Checked(rawToInt(r.ReadValue64(p.hfSize), p.hfSize, p.hfSigned))
			if err != nil {
				return nil, fmt.Errorf("field %s: %w", p.name, err)
			}
			values[i] = v
			continue
		}

		if p.arrLength != 0 {
			// FieldCache.Cardinality: the CardinalityAttribute arrLength when
			// > 1, else the default 1 — arrLength elements either way.
			switch p.kind {
			case kindString:
				out := make([]string, p.arrLength)
				for j := range out {
					out[j] = r.ReadCString()
				}
				values[i] = out
			case kindFloat:
				out := make([]float32, p.arrLength)
				for j := range out {
					out[j] = math.Float32frombits(uint32(r.ReadValue64(32)))
				}
				values[i] = out
			default:
				if p.size == 64 && !p.signed {
					out := make([]uint64, p.arrLength)
					for j := range out {
						out[j] = r.ReadValue64(64)
					}
					values[i] = out
				} else {
					out := make([]int64, p.arrLength)
					for j := range out {
						out[j] = rawToInt(r.ReadValue64(p.size), p.size, p.signed).(int64)
					}
					values[i] = out
				}
			}
			continue
		}

		switch p.kind {
		case kindString:
			values[i] = r.ReadCString()
		case kindFloat:
			values[i] = math.Float32frombits(uint32(r.ReadValue64(32)))
		default:
			values[i] = rawToInt(r.ReadValue64(p.size), p.size, p.signed)
		}
	}
	// C# never validates that the blob is fully consumed; neither do we.
	return values, nil
}

// toInt32Checked mirrors Convert.ChangeType(value, typeof(int)): value-
// preserving, overflow-checked.
func toInt32Checked(v any) (int64, error) {
	switch x := v.(type) {
	case int64:
		if x < math.MinInt32 || x > math.MaxInt32 {
			return 0, fmt.Errorf("relation value %d overflows int32", x)
		}
		return x, nil
	case uint64:
		if x > math.MaxInt32 {
			return 0, fmt.Errorf("relation value %d overflows int32", x)
		}
		return int64(x), nil
	}
	return 0, fmt.Errorf("relation value has unexpected type %T", v)
}
