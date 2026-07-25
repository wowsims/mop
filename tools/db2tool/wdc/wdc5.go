// Go translation of DBCD.IO's WDC5Reader (https://github.com/wowdev/DBCD,
// v2.1.2, commit 2180edb4d08b3822b3cfa964293ba8ccd4236ac0), including its
// encrypted-section skip path (no TACT keys).
// Copyright (c) 2020 wowdev. MIT License — see tools/db2tool/NOTICES.md.

// Package wdc decodes WDC5 .db2 client tables into rows shaped by a .dbd
// definition, and overlays the client's XFTH DBCache hotfix records onto them.
package wdc

import (
	"encoding/binary"
	"fmt"
	"os"
	"strings"
)

const wdc5Magic = "WDC5"
const headerSize = 200

type db2Flags uint16

const (
	flagSparse       db2Flags = 0x1
	flagSecondaryKey db2Flags = 0x2
	flagIndex        db2Flags = 0x4
)

const (
	compressionNone            = 0
	compressionImmediate       = 1
	compressionCommon          = 2
	compressionPallet          = 3
	compressionPalletArray     = 4
	compressionSignedImmediate = 5
)

type fieldMeta struct {
	Bits   int16
	Offset int16
}

// columnMeta's A/B/C are the 12-byte union interpreted per CompressionType:
// Immediate{BitOffset,BitWidth,Flags} / Pallet{BitOffset,BitWidth,Cardinality} /
// Common{DefaultValue,B,C}.
type columnMeta struct {
	RecordOffset       uint16
	Size               uint16
	AdditionalDataSize uint32
	CompressionType    uint32
	A, B, C            int32
}

type sectionHeader struct {
	TactKeyLookup          uint64
	FileOffset             int32
	NumRecords             int32
	StringTableSize        int32
	OffsetRecordsEndOffset int32
	IndexDataSize          int32
	ParentLookupDataSize   int32
	OffsetMapIDCount       int32
	CopyTableCount         int32
}

type sparseEntry struct {
	Offset uint32
	Size   uint16
}

// rawRow is a not-yet-decoded record: a bit reader positioned at its data,
// plus the row's identity captured at construction.
type rawRow struct {
	data        *bitReader
	dataOffset  int
	dataPos     int
	id          int32 // -1 when the id is inline in record data
	refID       int32
	recordIndex int32
}

type copyEntry struct {
	Dest int32
	Src  int32
}

// Table is the parsed (but not field-decoded) WDC5 file. Header fields the
// decoder does not consume (schema version/string, layout hash, max index,
// locale) are read past rather than kept.
type Table struct {
	RecordsCount    int32
	FieldsCount     int32
	RecordSize      int32
	StringTableSize int32
	TableHash       uint32
	MinIndex        int32
	Flags           db2Flags
	IdFieldIndex    uint16

	Sections   []sectionHeader
	Meta       []fieldMeta
	ColumnMeta []columnMeta
	PalletData [][]value32
	CommonData []map[int32]value32

	StringTable map[int64]string

	rows     []rawRow
	copyData []copyEntry // file order; dest==src entries already dropped

	// SkippedSections counts encrypted sections whose data was zero-filled and
	// therefore skipped, which is why the header record count exceeds the number
	// of emitted rows.
	SkippedSections int
}

type cursor struct {
	buf []byte
	pos int
}

func (c *cursor) need(n int) ([]byte, error) {
	if c.pos+n > len(c.buf) {
		return nil, fmt.Errorf("unexpected EOF: need %d bytes at offset %d, file is %d bytes", n, c.pos, len(c.buf))
	}
	b := c.buf[c.pos : c.pos+n]
	c.pos += n
	return b, nil
}

func (c *cursor) u16() (uint16, error) {
	b, err := c.need(2)
	if err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint16(b), nil
}

func (c *cursor) i32() (int32, error) {
	b, err := c.need(4)
	if err != nil {
		return 0, err
	}
	return int32(binary.LittleEndian.Uint32(b)), nil
}

func (c *cursor) u32() (uint32, error) {
	b, err := c.need(4)
	if err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint32(b), nil
}

func (c *cursor) u64() (uint64, error) {
	b, err := c.need(8)
	if err != nil {
		return 0, err
	}
	return binary.LittleEndian.Uint64(b), nil
}

// ReadFile parses a WDC5 .db2 file. Only WDC5 is supported; anything else
// (including WDC6+) fails loud.
func ReadFile(path string) (*Table, error) {
	buf, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	t, err := read(buf)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return t, nil
}

func read(buf []byte) (*Table, error) {
	if len(buf) < headerSize {
		return nil, fmt.Errorf("WDC5 file is corrupted (shorter than %d-byte header)", headerSize)
	}
	if string(buf[:4]) != wdc5Magic {
		return nil, fmt.Errorf("unsupported DB2 format %q (only WDC5 is supported)", string(buf[:4]))
	}

	c := &cursor{buf: buf, pos: 4}
	t := &Table{}

	var err error
	// schema version (u32) + schema string (128 bytes): unused.
	if _, err = c.u32(); err != nil {
		return nil, err
	}
	if _, err = c.need(128); err != nil {
		return nil, err
	}

	// record_count, field_count, record_size, string_table_size, table_hash,
	// layout_hash, min_id, max_id, locale
	ints := make([]int32, 9)
	for i := range ints {
		if ints[i], err = c.i32(); err != nil {
			return nil, err
		}
	}
	t.RecordsCount, t.FieldsCount, t.RecordSize, t.StringTableSize = ints[0], ints[1], ints[2], ints[3]
	t.TableHash = uint32(ints[4])
	t.MinIndex = ints[6]

	flags, err := c.u16()
	if err != nil {
		return nil, err
	}
	t.Flags = db2Flags(flags)
	if t.IdFieldIndex, err = c.u16(); err != nil {
		return nil, err
	}

	// totalFieldsCount, PackedDataOffset, lookupColumnCount, columnMetaDataSize,
	// commonDataSize, palletDataSize, sectionsCount
	tail := make([]int32, 7)
	for i := range tail {
		if tail[i], err = c.i32(); err != nil {
			return nil, err
		}
	}
	sectionsCount := int(tail[6])

	t.Sections = make([]sectionHeader, sectionsCount)
	for i := range t.Sections {
		s := &t.Sections[i]
		if s.TactKeyLookup, err = c.u64(); err != nil {
			return nil, err
		}
		for _, dst := range []*int32{&s.FileOffset, &s.NumRecords, &s.StringTableSize, &s.OffsetRecordsEndOffset,
			&s.IndexDataSize, &s.ParentLookupDataSize, &s.OffsetMapIDCount, &s.CopyTableCount} {
			if *dst, err = c.i32(); err != nil {
				return nil, err
			}
		}
	}

	// The empty ItemBonus.db2 ends mid-way through the meta blocks, and the
	// early return below never consumes them. Tolerate short reads only when
	// the early return will be taken; otherwise a truncated file is corrupt
	// and must fail loud.
	emptyTable := sectionsCount == 0 || t.RecordsCount == 0

	t.Meta = make([]fieldMeta, t.FieldsCount)
	for i := range t.Meta {
		b, err := c.need(4)
		if err != nil {
			if emptyTable {
				t.Meta = t.Meta[:i]
				break
			}
			return nil, err
		}
		t.Meta[i].Bits = int16(binary.LittleEndian.Uint16(b[0:2]))
		t.Meta[i].Offset = int16(binary.LittleEndian.Uint16(b[2:4]))
	}

	t.ColumnMeta = make([]columnMeta, t.FieldsCount)
	for i := range t.ColumnMeta {
		if emptyTable && c.pos+24 > len(c.buf) {
			t.ColumnMeta = t.ColumnMeta[:i]
			break
		}
		m := &t.ColumnMeta[i]
		if m.RecordOffset, err = c.u16(); err != nil {
			return nil, err
		}
		if m.Size, err = c.u16(); err != nil {
			return nil, err
		}
		if m.AdditionalDataSize, err = c.u32(); err != nil {
			return nil, err
		}
		if m.CompressionType, err = c.u32(); err != nil {
			return nil, err
		}
		if m.A, err = c.i32(); err != nil {
			return nil, err
		}
		if m.B, err = c.i32(); err != nil {
			return nil, err
		}
		if m.C, err = c.i32(); err != nil {
			return nil, err
		}
	}

	// ItemBonus.db2 is empty: 0 sections / 0 records is valid.
	if emptyTable {
		return t, nil
	}

	// pallet data
	t.PalletData = make([][]value32, len(t.ColumnMeta))
	for i := range t.ColumnMeta {
		ct := t.ColumnMeta[i].CompressionType
		if ct == compressionPallet || ct == compressionPalletArray {
			n := int(t.ColumnMeta[i].AdditionalDataSize / 4)
			t.PalletData[i] = make([]value32, n)
			for j := range n {
				v, err := c.u32()
				if err != nil {
					return nil, err
				}
				t.PalletData[i][j] = value32(v)
			}
		}
	}

	// common data
	t.CommonData = make([]map[int32]value32, len(t.ColumnMeta))
	for i := range t.ColumnMeta {
		if t.ColumnMeta[i].CompressionType == compressionCommon {
			n := int(t.ColumnMeta[i].AdditionalDataSize / 8)
			m := make(map[int32]value32, n)
			t.CommonData[i] = m
			for range n {
				k, err := c.i32()
				if err != nil {
					return nil, err
				}
				v, err := c.u32()
				if err != nil {
					return nil, err
				}
				m[k] = value32(v)
			}
		}
	}

	// encrypted ID lists (read sequentially; content unused — this tool
	// never consults them)
	for i := range sectionsCount {
		if t.Sections[i].TactKeyLookup == 0 {
			continue
		}
		n, err := c.i32()
		if err != nil {
			return nil, err
		}
		if _, err := c.need(int(n) * 4); err != nil {
			return nil, err
		}
	}

	t.StringTable = make(map[int64]string)

	previousStringTableSize := int32(0)
	previousRecordCount := int32(0)
	for si := range t.Sections {
		section := t.Sections[si]
		c.pos = int(section.FileOffset)

		var recordsData []byte
		if t.Flags&flagSparse == 0 {
			raw, err := c.need(int(section.NumRecords) * int(t.RecordSize))
			if err != nil {
				return nil, err
			}
			recordsData = padRecordData(raw)

			stringData, err := c.need(int(section.StringTableSize))
			if err != nil {
				return nil, err
			}
			readStringTable(t.StringTable, stringData, int64(previousStringTableSize))
			previousStringTableSize += section.StringTableSize
		} else {
			raw, err := c.need(int(section.OffsetRecordsEndOffset - section.FileOffset))
			if err != nil {
				return nil, err
			}
			recordsData = padRecordData(raw)
			if c.pos != int(section.OffsetRecordsEndOffset) {
				return nil, fmt.Errorf("stream position != OffsetRecordsEndOffset")
			}
		}

		// Skip encrypted sections: TACT key lookup set + record data
		// zero-filled, unless the trailing guards below find live id data.
		if section.TactKeyLookup != 0 && allZero(recordsData) {
			completelyZero := false
			if section.IndexDataSize > 0 || section.CopyTableCount > 0 {
				// Peek the first id from IndexData/CopyData without consuming.
				if c.pos+4 > len(c.buf) {
					return nil, fmt.Errorf("unexpected EOF peeking encrypted-section id data")
				}
				completelyZero = binary.LittleEndian.Uint32(c.buf[c.pos:c.pos+4]) == 0
			} else if section.OffsetMapIDCount > 0 {
				// Peek the first SparseEntry's Size without consuming.
				if c.pos+6 > len(c.buf) {
					return nil, fmt.Errorf("unexpected EOF peeking encrypted-section sparse data")
				}
				completelyZero = binary.LittleEndian.Uint16(c.buf[c.pos+4:c.pos+6]) == 0
			} else {
				completelyZero = true
			}
			if completelyZero {
				previousRecordCount += section.NumRecords
				t.SkippedSections++
				continue
			}
		}

		// index data
		indexData := make([]int32, section.IndexDataSize/4)
		for i := range indexData {
			if indexData[i], err = c.i32(); err != nil {
				return nil, err
			}
		}
		if len(indexData) > 0 && allZeroInts(indexData) {
			for i := range indexData {
				indexData[i] = t.MinIndex + previousRecordCount + int32(i)
			}
		}

		// duplicate rows data
		for i := int32(0); i < section.CopyTableCount; i++ {
			dest, err := c.i32()
			if err != nil {
				return nil, err
			}
			src, err := c.i32()
			if err != nil {
				return nil, err
			}
			if dest != src {
				t.copyData = append(t.copyData, copyEntry{Dest: dest, Src: src})
			}
		}

		var sparseEntries []sparseEntry
		if section.OffsetMapIDCount > 0 {
			// HACK: upstream skips a malformed unit-test table (hash 145293629).
			if t.TableHash == 145293629 {
				if _, err := c.need(4 * int(section.OffsetMapIDCount)); err != nil {
					return nil, err
				}
			}
			sparseEntries = make([]sparseEntry, section.OffsetMapIDCount)
			for i := range sparseEntries {
				b, err := c.need(6)
				if err != nil {
					return nil, err
				}
				sparseEntries[i].Offset = binary.LittleEndian.Uint32(b[0:4])
				sparseEntries[i].Size = binary.LittleEndian.Uint16(b[4:6])
			}
		}

		if section.OffsetMapIDCount > 0 && t.Flags&flagSecondaryKey != 0 {
			var err error
			indexData, err = readSparseIndexData(c, section, indexData)
			if err != nil {
				return nil, err
			}
		}

		// reference (parent lookup) data
		refEntries := make(map[int32]int32)
		if section.ParentLookupDataSize > 0 {
			numRecords, err := c.i32()
			if err != nil {
				return nil, err
			}
			if _, err := c.need(8); err != nil { // minId, maxId
				return nil, err
			}
			for range numRecords {
				id, err := c.i32()
				if err != nil {
					return nil, err
				}
				index, err := c.i32()
				if err != nil {
					return nil, err
				}
				refEntries[index] = id
			}
		}

		if section.OffsetMapIDCount > 0 && t.Flags&flagSecondaryKey == 0 {
			var err error
			indexData, err = readSparseIndexData(c, section, indexData)
			if err != nil {
				return nil, err
			}
		}

		position := 0
		for i := int32(0); i < section.NumRecords; i++ {
			br := newBitReader(recordsData)
			if t.Flags&flagSparse != 0 {
				br.Position = position
				position += int(sparseEntries[i].Size) * 8
			} else {
				br.Offset = int(i) * int(t.RecordSize)
			}

			var refID int32
			if t.Flags&flagSecondaryKey != 0 {
				refID = refEntries[indexData[i]]
			} else {
				refID = refEntries[i]
			}

			id := int32(-1)
			if section.IndexDataSize != 0 {
				id = indexData[i]
			}

			t.rows = append(t.rows, rawRow{
				data:        br,
				dataOffset:  br.Offset,
				dataPos:     br.Position,
				id:          id,
				refID:       refID,
				recordIndex: i + previousRecordCount,
			})
		}

		previousRecordCount += section.NumRecords
	}

	return t, nil
}

func readSparseIndexData(c *cursor, section sectionHeader, indexData []int32) ([]int32, error) {
	sparseIndexData := make([]int32, section.OffsetMapIDCount)
	for i := range sparseIndexData {
		var err error
		if sparseIndexData[i], err = c.i32(); err != nil {
			return nil, err
		}
	}
	if section.IndexDataSize > 0 && len(indexData) != len(sparseIndexData) {
		return nil, fmt.Errorf("IndexData length != sparseIndexData length")
	}
	return sparseIndexData, nil
}

// readStringTable reads NUL-separated UTF-8 strings keyed by byte offset
// (baseOffset + running offset).
func readStringTable(dst map[int64]string, data []byte, baseOffset int64) {
	if len(data) == 0 {
		return
	}
	curOfs := 0
	for str := range strings.SplitSeq(string(data), "\x00") {
		if curOfs == len(data) {
			break
		}
		dst[baseOffset+int64(curOfs)] = str
		curOfs += len(str) + 1
	}
}

func allZero(b []byte) bool {
	for _, v := range b {
		if v != 0 {
			return false
		}
	}
	return true
}

func allZeroInts(v []int32) bool {
	for _, x := range v {
		if x != 0 {
			return false
		}
	}
	return true
}
