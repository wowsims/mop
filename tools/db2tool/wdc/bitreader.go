// Go translation of DBCD.IO's BitReader (https://github.com/wowdev/DBCD,
// v2.1.2, commit 2180edb4d08b3822b3cfa964293ba8ccd4236ac0).
// Copyright (c) 2020 wowdev. MIT License — see tools/db2tool/NOTICES.md.

package wdc

import (
	"encoding/binary"
)

// bitReader reads unaligned little-endian bit windows: a raw 4/8-byte load
// at the current byte, shifted left then right to isolate numBits. Loads can
// extend past the last meaningful byte, so record buffers must carry 8 zero
// bytes of padding (see padRecordData) to keep slice bounds safe. Shift
// counts are masked (&31 / &63) so degenerate widths (0 or full-width)
// behave consistently rather than panicking.
type bitReader struct {
	data     []byte
	Position int // in bits, relative to Offset
	Offset   int // in bytes
}

// newBitReader wraps data that MUST already include 8 bytes of zero padding
// beyond the last meaningful byte (see padRecordData).
func newBitReader(data []byte) *bitReader {
	return &bitReader{data: data}
}

// padRecordData appends 8 zero bytes, making unaligned loads at the tail
// safe. The extra bytes are always masked out of results.
func padRecordData(data []byte) []byte {
	// Must copy: data may alias the file buffer, and appending in place would
	// overwrite the bytes that follow the record block.
	out := make([]byte, len(data)+8)
	copy(out, data)
	return out
}

func (r *bitReader) ReadUInt32(numBits int) uint32 {
	v := binary.LittleEndian.Uint32(r.data[r.Offset+(r.Position>>3):])
	result := v << ((32 - numBits - (r.Position & 7)) & 31) >> ((32 - numBits) & 31)
	r.Position += numBits
	return result
}

func (r *bitReader) ReadUInt64(numBits int) uint64 {
	v := binary.LittleEndian.Uint64(r.data[r.Offset+(r.Position>>3):])
	result := v << ((64 - numBits - (r.Position & 7)) & 63) >> ((64 - numBits) & 63)
	r.Position += numBits
	return result
}

// ReadValue64 returns the raw (zero-extended) bits; the caller reinterprets
// them per the DBD-declared field type.
func (r *bitReader) ReadValue64(numBits int) uint64 {
	return r.ReadUInt64(numBits)
}

// ReadValue64Signed sign-extends a numBits-wide value to 64 bits.
func (r *bitReader) ReadValue64Signed(numBits int) uint64 {
	result := r.ReadUInt64(numBits)
	signedShift := uint64(1) << ((numBits - 1) & 63)
	return (signedShift ^ result) - signedShift
}

func (r *bitReader) ReadCString() string {
	var bytes []byte
	for {
		num := r.ReadUInt32(8)
		if num == 0 {
			break
		}
		bytes = append(bytes, byte(num))
	}
	return string(bytes)
}

// value32 is 4 raw bytes from the pallet/common blocks, reinterpreted by the
// caller per the DBD-declared field type.
type value32 uint32
