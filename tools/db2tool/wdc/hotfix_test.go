package wdc

import (
	"encoding/binary"
	"testing"
)

// The two table hashes ApplyHotfixes special-cases are known constants, so they
// pin the SStrHash port without needing any client data. A DBCache record is
// matched to a table by comparing this hash against the WDC5 header's
// TableHash, so a wrong hash silently drops every hotfix for a table.
func TestSStrHashKnownTableHashes(t *testing.T) {
	cases := map[string]uint32{
		"TACTKEY":       0xDF2F53CF,
		"BROADCASTTEXT": 0x021826BB,
	}
	for name, want := range cases {
		if got := SStrHash(name); got != want {
			t.Errorf("SStrHash(%q) = 0x%08X, want 0x%08X", name, got, want)
		}
	}
	// Callers must uppercase; the hash is case-sensitive and the lowercase form
	// is a different value.
	if SStrHash("tactkey") == SStrHash("TACTKEY") {
		t.Error("SStrHash is unexpectedly case-insensitive")
	}
	if SStrHash("") != 0x7fed7fed {
		t.Errorf("SStrHash(\"\") = 0x%08X, want the 0x7fed7fed seed", SStrHash(""))
	}
}

// xfthEntry builds one DBCache record: per-entry magic, the 28-byte header, then
// the payload.
func xfthEntry(pushID int32, tableHash uint32, recordID int32, status byte, data []byte) []byte {
	b := make([]byte, 0, 32+len(data))
	b = append(b, []byte(hotfixMagic)...)
	var hdr [28]byte
	binary.LittleEndian.PutUint32(hdr[0:], 1) // RegionID
	binary.LittleEndian.PutUint32(hdr[4:], uint32(pushID))
	binary.LittleEndian.PutUint32(hdr[8:], 42) // UniqueID
	binary.LittleEndian.PutUint32(hdr[12:], tableHash)
	binary.LittleEndian.PutUint32(hdr[16:], uint32(recordID))
	binary.LittleEndian.PutUint32(hdr[20:], uint32(len(data)))
	hdr[24] = status
	b = append(b, hdr[:]...)
	return append(b, data...)
}

func xfthFile(version, build int32, entries ...[]byte) []byte {
	buf := make([]byte, 44)
	copy(buf, hotfixMagic)
	binary.LittleEndian.PutUint32(buf[4:], uint32(version))
	binary.LittleEndian.PutUint32(buf[8:], uint32(build))
	// buf[12:44] is the v>=5 32-byte hash, skipped by the parser.
	for _, e := range entries {
		buf = append(buf, e...)
	}
	return buf
}

func TestParseHotfixV9(t *testing.T) {
	const build = 68571
	raw := xfthFile(9, build,
		xfthEntry(100, 0xAABBCCDD, 7, 1, []byte{1, 2, 3, 4}),
		xfthEntry(101, 0xAABBCCDD, 8, 0, nil), // delete: status 0, no payload
	)

	h, err := parseHotfix(raw)
	if err != nil {
		t.Fatal(err)
	}
	if h.Version != 9 || h.BuildID != build {
		t.Fatalf("header = version %d build %d, want 9 / %d", h.Version, h.BuildID, build)
	}
	if len(h.records) != 2 {
		t.Fatalf("parsed %d records, want 2", len(h.records))
	}

	first := h.records[0]
	if first.PushID != 100 || first.TableHash != 0xAABBCCDD || first.RecordID != 7 {
		t.Errorf("first record = %+v", first)
	}
	if !first.IsValid {
		t.Error("status byte 1 must parse as valid")
	}
	if first.DataSize != 4 || string(first.Data) != "\x01\x02\x03\x04" {
		t.Errorf("first payload = %v (size %d), want 4 bytes 1..4", first.Data, first.DataSize)
	}
	if h.records[1].IsValid {
		t.Error("status byte 0 must parse as invalid")
	}
	if h.records[1].DataSize != 0 {
		t.Errorf("second DataSize = %d, want 0", h.records[1].DataSize)
	}
}

// The payload must be capped so a later append cannot reach into the following
// record's bytes.
func TestParseHotfixPayloadIsCapped(t *testing.T) {
	raw := xfthFile(9, 1,
		xfthEntry(1, 0x1, 1, 1, []byte{9, 9}),
		xfthEntry(2, 0x1, 2, 1, []byte{7, 7}),
	)
	h, err := parseHotfix(raw)
	if err != nil {
		t.Fatal(err)
	}
	_ = append(h.records[0].Data, 0xff)
	if h.records[1].Data[0] != 7 {
		t.Errorf("appending to record 0's payload corrupted record 1: %v", h.records[1].Data)
	}
}

func TestParseHotfixRejectsBadInput(t *testing.T) {
	badMagic := xfthFile(9, 1)
	copy(badMagic, "ZZZZ")

	tests := map[string][]byte{
		"short header":     []byte("XFT"),
		"bad magic":        badMagic,
		"truncated ext":    append([]byte(hotfixMagic), 0x09, 0, 0, 0, 0x01, 0, 0, 0),
		"bad entry magic":  append(xfthFile(9, 1), []byte("NOPE????")...),
		"truncated data":   append(xfthFile(9, 1), xfthEntry(1, 0x1, 1, 1, []byte{1, 2, 3, 4})[:34]...),
		"unsupported ver8": xfthFile(8, 1),
	}

	for name, raw := range tests {
		if _, err := parseHotfix(raw); err == nil {
			t.Errorf("%s: expected an error, got nil", name)
		}
	}
}

// Records with an unsupported DataSize must not be silently accepted: a
// negative size would otherwise index backwards.
func TestParseHotfixRejectsNegativeDataSize(t *testing.T) {
	e := xfthEntry(1, 0x1, 1, 1, nil)
	binary.LittleEndian.PutUint32(e[4+20:], 0xFFFFFFFF) // DataSize = -1
	if _, err := parseHotfix(xfthFile(9, 1, e)); err == nil {
		t.Error("expected an error for a negative DataSize")
	}
}

func TestCombineDedupsOnFullRecordIdentity(t *testing.T) {
	rec := func(push int32, data []byte) []byte { return xfthEntry(push, 0x1, 5, 1, data) }

	base, err := parseHotfix(xfthFile(9, 1, rec(1, []byte{1})))
	if err != nil {
		t.Fatal(err)
	}
	// Identical record: dropped.
	same, _ := parseHotfix(xfthFile(9, 1, rec(1, []byte{1})))
	base.Combine(same)
	if len(base.records) != 1 {
		t.Fatalf("identical record was not deduped: %d records", len(base.records))
	}
	// Same 5-tuple but different payload bytes: kept, because identity includes
	// the data.
	other, _ := parseHotfix(xfthFile(9, 1, rec(1, []byte{2})))
	base.Combine(other)
	if len(base.records) != 2 {
		t.Fatalf("record differing only in payload was dropped: %d records", len(base.records))
	}
	// A different build is ignored entirely.
	otherBuild, _ := parseHotfix(xfthFile(9, 2, rec(9, []byte{3})))
	base.Combine(otherBuild)
	if len(base.records) != 2 {
		t.Fatalf("record from another build was merged in: %d records", len(base.records))
	}
}
