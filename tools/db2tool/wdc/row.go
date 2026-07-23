// Go translation of DBCD.IO's row decoding, DBD-to-field-type mapping and
// copy-row semantics (https://github.com/wowdev/DBCD, v2.1.2, commit
// 2180edb4d08b3822b3cfa964293ba8ccd4236ac0).
// Copyright (c) 2020 wowdev. MIT License — see tools/db2tool/NOTICES.md.
package wdc

import (
	"fmt"
	"math"
	"sort"

	"github.com/wowsims/mop/tools/db2tool/dbd"
)

type colKind int

const (
	kindInt colKind = iota
	kindFloat
	kindString // string, or locstring when locStringSize == 1 (always true for MoP builds)
)

// fieldPlan is the precomputed per-definition decode plan.
type fieldPlan struct {
	name           string
	kind           colKind
	size           int // int bit width from the DBD (8/16/32/64); 0 for float/string
	signed         bool
	arrLength      int
	isNonInlineRel bool
	isNonInlineID  bool
	isID           bool

	// The DBD-declared view, used only by the hotfix decoder: a non-inline
	// relation is read from a hotfix blob at its DBD-declared type (then
	// converted to int), while kind/size/signed above carry the int32
	// override. Identical to kind/size/signed for every other field.
	hfKind   colKind
	hfSize   int
	hfSigned bool
}

// Row is one decoded record; Values align 1:1 with Decoded.ColumnNames.
// Value dynamic types are limited to int64/uint64 scalars, float32, string,
// []int64, []uint64, []float32 and []string — never []byte, so encoding/json
// writes every array element-by-element as numbers (no base64), the
// wowsims.db array-text format.
type Row struct {
	ID     int32
	Values []any
}

type Decoded struct {
	ColumnNames []string
	Rows        []Row // ascending ID
}

func buildFieldPlans(def dbd.DBDefinition, version dbd.VersionDefinitions, buildNumber uint32) ([]fieldPlan, error) {
	// The locstring size is 1 for post-wotlk builds (build > 12340) — always
	// the case for the builds this tool targets. A locstring therefore maps
	// to a single string field with no _mask column.
	if buildNumber <= 12340 {
		return nil, fmt.Errorf("build %d predates single-locale locstrings; this port only supports locStringSize == 1", buildNumber)
	}

	plans := make([]fieldPlan, len(version.Definitions))
	for i, d := range version.Definitions {
		col, ok := def.ColumnDefinitions[d.Name]
		if !ok {
			return nil, fmt.Errorf("column definition for %q not found", d.Name)
		}
		p := fieldPlan{
			name:           d.Name,
			arrLength:      d.ArrLength,
			isNonInlineRel: d.IsRelation && d.IsNonInline,
			isNonInlineID:  d.IsID && d.IsNonInline,
			isID:           d.IsID,
		}
		switch col.Type {
		case "int", "uint":
			p.kind = kindInt
			p.size = d.Size
			p.signed = d.IsSigned
			switch d.Size {
			case 8, 16, 32, 64:
			default:
				return nil, fmt.Errorf("column %q: unsupported int size %d", d.Name, d.Size)
			}
		case "float":
			p.kind = kindFloat
		case "string", "locstring":
			p.kind = kindString
		default:
			return nil, fmt.Errorf("column %q: unable to construct field type from %q", d.Name, col.Type)
		}
		// Capture the DBD-declared mapping before the non-inline-relation
		// override — the hotfix decoder reads that type.
		p.hfKind, p.hfSize, p.hfSigned = p.kind, p.size, p.signed
		// A non-inline relation always decodes as a signed 32-bit int,
		// regardless of the DBD-declared type.
		if p.isNonInlineRel {
			p.kind = kindInt
			p.size = 32
			p.signed = true
		}
		plans[i] = p
	}
	return plans, nil
}

// DecodeRows decodes every record (including copy-table duplicates) into
// values aligned with version.Definitions, returned in ascending-ID order.
func (t *Table) DecodeRows(def dbd.DBDefinition, version dbd.VersionDefinitions, buildNumber uint32) (*Decoded, error) {
	plans, err := buildFieldPlans(def, version, buildNumber)
	if err != nil {
		return nil, err
	}

	columnNames := make([]string, len(plans))
	for i, p := range plans {
		columnNames[i] = p.name
	}

	byID := make(map[int32][]any, len(t.rows))

	hadInlineID := false
	for _, row := range t.rows {
		id, values, err := t.decodeRow(row, plans)
		if err != nil {
			return nil, fmt.Errorf("record %d: %w", row.recordIndex, err)
		}
		if row.id == -1 {
			hadInlineID = true
		}
		if _, dup := byID[id]; dup {
			return nil, fmt.Errorf("duplicate row id %d", id)
		}
		byID[id] = values
	}

	// Copy-table rows: clone the source row's decoded values and rewrite the
	// id field.
	if len(t.copyData) > 0 {
		if hadInlineID {
			// Never occurs on real data, and the id-field mapping would be
			// ambiguous; refuse rather than guess.
			return nil, fmt.Errorf("copy table present on a table with inline ids — unsupported")
		}
		idFieldIndex := int(t.IdFieldIndex)
		if idFieldIndex >= len(plans) {
			return nil, fmt.Errorf("IdFieldIndex %d out of range for %d definitions", idFieldIndex, len(plans))
		}
		for _, ce := range t.copyData {
			src, ok := byID[ce.Src]
			if !ok {
				return nil, fmt.Errorf("copy-table source row %d not found (dest %d)", ce.Src, ce.Dest)
			}
			if _, dup := byID[ce.Dest]; dup {
				return nil, fmt.Errorf("duplicate row id %d from copy table", ce.Dest)
			}
			values := make([]any, len(src))
			copy(values, src)
			values[idFieldIndex] = int64(ce.Dest)
			byID[ce.Dest] = values
		}
	}

	ids := make([]int32, 0, len(byID))
	for id := range byID {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	decoded := &Decoded{ColumnNames: columnNames, Rows: make([]Row, len(ids))}
	for i, id := range ids {
		decoded.Rows[i] = Row{ID: id, Values: byID[id]}
	}
	return decoded, nil
}

// decodeRow decodes one raw record into values aligned with plans.
func (t *Table) decodeRow(row rawRow, plans []fieldPlan) (int32, []any, error) {
	r := row.data
	r.Position = row.dataPos
	r.Offset = row.dataOffset

	id := row.id
	values := make([]any, len(plans))
	indexFieldOffset := 0

	for i, p := range plans {
		if i == int(t.IdFieldIndex) {
			if id != -1 {
				indexFieldOffset++
			} else {
				raw, err := t.getFieldRaw(0, r, i)
				if err != nil {
					return 0, nil, fmt.Errorf("field %s: %w", p.name, err)
				}
				id = int32(uint32(raw))
			}
			values[i] = int64(id)
			continue
		}

		fieldIndex := i - indexFieldOffset

		if fieldIndex >= len(t.Meta) {
			// Trailing non-inline relation: the parent-lookup refID.
			values[i] = int64(row.refID)
			continue
		}

		var err error
		if p.arrLength != 0 {
			values[i], err = t.readArrayField(r, fieldIndex, p, row)
		} else {
			values[i], err = t.readScalarField(id, r, fieldIndex, p, row)
		}
		if err != nil {
			return 0, nil, fmt.Errorf("field %s: %w", p.name, err)
		}
	}

	return id, values, nil
}

func (t *Table) readScalarField(id int32, r *bitReader, fieldIndex int, p fieldPlan, row rawRow) (any, error) {
	if p.kind == kindString {
		if t.Flags&flagSparse != 0 {
			return r.ReadCString(), nil
		}
		// The byte position is captured BEFORE the relative offset is read —
		// the offset is relative to the field's own position.
		recordOffset := (int(row.recordIndex) * int(t.RecordSize)) - (int(t.RecordsCount) * int(t.RecordSize))
		bytePos := r.Position >> 3
		raw, err := t.getFieldRaw(id, r, fieldIndex)
		if err != nil {
			return nil, err
		}
		index := recordOffset + bytePos + int(int32(uint32(raw)))
		if index < 0 {
			index = 0
		}
		s, ok := t.StringTable[int64(index)]
		if !ok {
			return nil, fmt.Errorf("string table miss at offset %d", index)
		}
		return s, nil
	}

	raw, err := t.getFieldRaw(id, r, fieldIndex)
	if err != nil {
		return nil, err
	}
	if p.kind == kindFloat {
		return math.Float32frombits(uint32(raw)), nil
	}
	return rawToInt(raw, p.size, p.signed), nil
}

// rawToInt reinterprets the low bits of the 64-bit read per the DBD-declared
// width and signedness. Unsigned 64-bit stays uint64; every other case fits
// int64.
func rawToInt(raw uint64, size int, signed bool) any {
	switch size {
	case 8:
		if signed {
			return int64(int8(raw))
		}
		return int64(uint8(raw))
	case 16:
		if signed {
			return int64(int16(raw))
		}
		return int64(uint16(raw))
	case 32:
		if signed {
			return int64(int32(raw))
		}
		return int64(uint32(raw))
	case 64:
		if signed {
			return int64(raw)
		}
		return raw
	}
	panic(fmt.Sprintf("unsupported int size %d", size)) // guarded in buildFieldPlans
}

func (t *Table) readArrayField(r *bitReader, fieldIndex int, p fieldPlan, row rawRow) (any, error) {
	fm := t.Meta[fieldIndex]
	cm := t.ColumnMeta[fieldIndex]

	if p.kind == kindString {
		if t.Flags&flagSparse != 0 {
			// No configured table has string arrays in a sparse table.
			return nil, fmt.Errorf("string arrays in sparse tables are not supported")
		}
		if cm.CompressionType != compressionNone {
			return nil, fmt.Errorf("unexpected compression type %d for string array", cm.CompressionType)
		}
		bitSize := 32 - int(fm.Bits)
		if bitSize <= 0 {
			bitSize = int(cm.B)
		}
		count := int(cm.Size) / 32
		recordOffset := (int(row.recordIndex) * int(t.RecordSize)) - (int(t.RecordsCount) * int(t.RecordSize))
		out := make([]string, count)
		for i := range out {
			bytePos := r.Position >> 3
			raw := r.ReadValue64(bitSize)
			index := bytePos + recordOffset + int(int32(uint32(raw)))
			if index < 0 {
				index = 0
			}
			s, ok := t.StringTable[int64(index)]
			if !ok {
				return nil, fmt.Errorf("string table miss at offset %d", index)
			}
			out[i] = s
		}
		return out, nil
	}

	elemBits := 32
	if p.kind == kindInt {
		elemBits = p.size
	}

	var raws []uint64
	switch cm.CompressionType {
	case compressionNone:
		bitSize := 32 - int(fm.Bits)
		if bitSize <= 0 {
			bitSize = int(cm.B)
		}
		count := int(cm.Size) / elemBits
		raws = make([]uint64, count)
		for i := range raws {
			raws[i] = r.ReadValue64(bitSize)
		}
	case compressionPalletArray:
		cardinality := int(cm.C)
		idx := int(r.ReadUInt32(int(cm.B)))
		pallet := t.PalletData[fieldIndex]
		raws = make([]uint64, cardinality)
		for i := range raws {
			pi := i + cardinality*idx
			if pi < 0 || pi >= len(pallet) {
				return nil, fmt.Errorf("pallet-array index %d out of range (%d entries)", pi, len(pallet))
			}
			raws[i] = uint64(uint32(t.PalletData[fieldIndex][pi]))
		}
	default:
		return nil, fmt.Errorf("unexpected compression type %d for array field", cm.CompressionType)
	}

	if p.kind == kindFloat {
		out := make([]float32, len(raws))
		for i, raw := range raws {
			out[i] = math.Float32frombits(uint32(raw))
		}
		return out, nil
	}

	// Byte-sized arrays must stay plain numeric slices (never []byte): the
	// wowsims.db array-text format is element-by-element numbers, e.g.
	// [0,0,0], NOT base64. Width/sign truncation still follows the
	// DBD-declared element type.
	if p.size == 64 && !p.signed {
		out := make([]uint64, len(raws))
		copy(out, raws)
		return out, nil
	}
	out := make([]int64, len(raws))
	for i, raw := range raws {
		out[i] = rawToInt(raw, p.size, p.signed).(int64)
	}
	return out, nil
}

// getFieldRaw dispatches on the column's compression type, returning the
// raw 64-bit value before type reinterpretation.
func (t *Table) getFieldRaw(id int32, r *bitReader, fieldIndex int) (uint64, error) {
	fm := t.Meta[fieldIndex]
	cm := t.ColumnMeta[fieldIndex]

	switch cm.CompressionType {
	case compressionNone:
		bitSize := 32 - int(fm.Bits)
		if bitSize <= 0 {
			bitSize = int(cm.B) // Immediate.BitWidth
		}
		return r.ReadValue64(bitSize), nil
	case compressionSignedImmediate:
		return r.ReadValue64Signed(int(cm.B)), nil
	case compressionImmediate:
		return r.ReadValue64(int(cm.B)), nil
	case compressionCommon:
		if v, ok := t.CommonData[fieldIndex][id]; ok {
			return uint64(uint32(v)), nil
		}
		return uint64(uint32(cm.A)), nil // Common.DefaultValue raw bytes
	case compressionPallet:
		idx := int(r.ReadUInt32(int(cm.B)))
		pallet := t.PalletData[fieldIndex]
		if idx < 0 || idx >= len(pallet) {
			return 0, fmt.Errorf("pallet index %d out of range (%d entries)", idx, len(pallet))
		}
		return uint64(uint32(pallet[idx])), nil
	case compressionPalletArray:
		if cm.C != 1 { // Pallet.Cardinality
			return 0, fmt.Errorf("unexpected compression type %d (pallet-array cardinality %d on scalar field)", cm.CompressionType, cm.C)
		}
		idx := int(r.ReadUInt32(int(cm.B)))
		pallet := t.PalletData[fieldIndex]
		if idx < 0 || idx >= len(pallet) {
			return 0, fmt.Errorf("pallet-array index %d out of range (%d entries)", idx, len(pallet))
		}
		return uint64(uint32(pallet[idx])), nil
	}
	return 0, fmt.Errorf("unexpected compression type %d", cm.CompressionType)
}
