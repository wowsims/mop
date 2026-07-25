package wdc

import (
	"math"
	"testing"
)

// bitAt returns bit k of the little-endian bit stream: byte i supplies bits
// [8i, 8i+8), least-significant first. This is the definition the WDC5 record
// layout uses and is deliberately independent of bitReader's shift arithmetic.
func bitAt(data []byte, k int) uint64 {
	return uint64(data[k/8]>>(k%8)) & 1
}

// refRead is the reference extraction: numBits starting at bit position pos.
func refRead(data []byte, pos, numBits int) uint64 {
	var v uint64
	for j := range numBits {
		v |= bitAt(data, pos+j) << j
	}
	return v
}

func testData() []byte {
	// Fixed pseudo-random bytes; no Math/rand so failures are reproducible.
	data := make([]byte, 32)
	x := byte(0x9d)
	for i := range data {
		data[i] = x
		x = x*31 + 17
	}
	return padRecordData(data)
}

// ReadUInt32's shift math requires 32-numBits-(pos&7) >= 0, i.e. numBits <= 25
// for an arbitrary bit offset. The decoder only ever calls it with small widths
// (pallet indices of cm.B bits, and 8 for ReadCString), so that is the range
// worth pinning.
func TestReadUInt32AllOffsetsAndWidths(t *testing.T) {
	data := testData()
	for pos := range 64 {
		for numBits := 1; numBits <= 25; numBits++ {
			r := &bitReader{data: data, Position: pos}
			got := uint64(r.ReadUInt32(numBits))
			want := refRead(data, pos, numBits)
			if got != want {
				t.Fatalf("ReadUInt32(pos=%d, bits=%d) = %#x, want %#x", pos, numBits, got, want)
			}
			if r.Position != pos+numBits {
				t.Fatalf("ReadUInt32(pos=%d, bits=%d) left Position=%d, want %d", pos, numBits, r.Position, pos+numBits)
			}
		}
	}
}

// ReadUInt64 backs every field read (ReadValue64); its constraint is
// numBits <= 57 for an arbitrary bit offset.
func TestReadUInt64AllOffsetsAndWidths(t *testing.T) {
	data := testData()
	for pos := range 64 {
		for numBits := 1; numBits <= 57; numBits++ {
			r := &bitReader{data: data, Position: pos}
			got := r.ReadValue64(numBits)
			want := refRead(data, pos, numBits)
			if got != want {
				t.Fatalf("ReadValue64(pos=%d, bits=%d) = %#x, want %#x", pos, numBits, got, want)
			}
		}
	}
}

// Offset is a byte-granular base that must compose with the bit Position.
func TestReadHonoursByteOffset(t *testing.T) {
	data := testData()
	for _, offset := range []int{0, 1, 7, 16} {
		for _, numBits := range []int{1, 8, 13, 32} {
			r := &bitReader{data: data, Offset: offset, Position: 3}
			got := r.ReadValue64(numBits)
			want := refRead(data, offset*8+3, numBits)
			if got != want {
				t.Fatalf("Offset=%d bits=%d: got %#x, want %#x", offset, numBits, got, want)
			}
		}
	}
}

func TestReadValue64Signed(t *testing.T) {
	cases := []struct {
		bits int
		raw  uint64
		want int64
	}{
		{8, 0x7f, 127},
		{8, 0x80, -128},
		{8, 0xff, -1},
		{16, 0x7fff, 32767},
		{16, 0x8000, -32768},
		{4, 0x7, 7},
		{4, 0x8, -8},
		{32, 0xffffffff, -1},
		{32, 0x80000000, math.MinInt32},
	}
	for _, c := range cases {
		// Lay the raw value down at bit 0 of a fresh buffer.
		data := make([]byte, 16)
		for j := range c.bits {
			if c.raw>>j&1 == 1 {
				data[j/8] |= 1 << (j % 8)
			}
		}
		r := newBitReader(padRecordData(data))
		if got := int64(r.ReadValue64Signed(c.bits)); got != c.want {
			t.Errorf("ReadValue64Signed(%d bits, raw %#x) = %d, want %d", c.bits, c.raw, got, c.want)
		}
	}
}

func TestReadCString(t *testing.T) {
	data := append([]byte("abc\x00de\x00"), 0)
	r := newBitReader(padRecordData(data))
	if got := r.ReadCString(); got != "abc" {
		t.Errorf("first ReadCString = %q, want \"abc\"", got)
	}
	if got := r.ReadCString(); got != "de" {
		t.Errorf("second ReadCString = %q, want \"de\"", got)
	}
	// An immediately-terminated string is empty, not a read past the end.
	if got := r.ReadCString(); got != "" {
		t.Errorf("third ReadCString = %q, want \"\"", got)
	}
}

// padRecordData must COPY: the records block aliases the mapped file buffer, so
// appending in place would overwrite the bytes that follow it.
func TestPadRecordDataCopies(t *testing.T) {
	file := []byte{1, 2, 3, 4, 5, 6, 7, 8}
	records := file[:4]
	padded := padRecordData(records)

	if len(padded) != len(records)+8 {
		t.Fatalf("padded length = %d, want %d", len(padded), len(records)+8)
	}
	for i, b := range padded[len(records):] {
		if b != 0 {
			t.Errorf("pad byte %d = %d, want 0", i, b)
		}
	}
	padded[5] = 0xff
	if file[5] != 6 {
		t.Errorf("padRecordData wrote through to the backing buffer: file[5] = %d, want 6", file[5])
	}
}

// A read at the very last meaningful byte still loads 8 bytes, which is exactly
// what the padding exists for.
func TestReadAtTailIsInBounds(t *testing.T) {
	data := padRecordData([]byte{0xaa})
	r := newBitReader(data)
	if got := r.ReadValue64(8); got != 0xaa {
		t.Errorf("tail ReadValue64(8) = %#x, want 0xaa", got)
	}
	r2 := &bitReader{data: data, Offset: 1}
	if got := r2.ReadValue64(32); got != 0 {
		t.Errorf("read into padding = %#x, want 0", got)
	}
}
