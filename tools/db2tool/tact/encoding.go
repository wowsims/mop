// Go translation of TACTSharp's EncodingInstance (https://github.com/wowdev/TACTSharp,
// v0.0.13-alpha, commit d0ab516eb98b5db35682467b6e4977d88955046d).
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.

package tact

import (
	"bytes"
	"fmt"
)

// encodingTable supports CKey→EKey resolution over the decoded encoding file
// (the "EN" table: paged, big-endian, 40-bit decoded sizes).
type encodingTable struct {
	data      []byte
	ckeySize  int
	ekeySize  int
	pageSize  int
	pageCount int
	headerOff int // ckey page-header block offset
	pagesOff  int // ckey pages block offset
}

func parseEncoding(data []byte) (*encodingTable, error) {
	if len(data) < 22 || data[0] != 'E' || data[1] != 'N' {
		return nil, fmt.Errorf("invalid encoding file magic")
	}
	if data[2] != 1 {
		return nil, fmt.Errorf("unsupported encoding version %d", data[2])
	}
	e := &encodingTable{data: data}
	e.ckeySize = int(data[3])
	e.ekeySize = int(data[4])
	ckeyPageSize := int(uint16(data[5])<<8|uint16(data[6])) * 1024
	ckeyPageCount := int(be32(data[9:]))
	especBlockSize := int(be32(data[0x12:]))

	e.pageSize = ckeyPageSize
	e.pageCount = ckeyPageCount
	e.headerOff = 22 + especBlockSize
	e.pagesOff = e.headerOff + ckeyPageCount*(e.ckeySize+0x10)
	if e.pagesOff+ckeyPageCount*ckeyPageSize > len(data) {
		return nil, fmt.Errorf("encoding ckey pages exceed file size")
	}
	return e, nil
}

// findContentKey returns the first eKey and decoded file size for a cKey, or
// ok=false when absent. Page selection: last page header whose first key <=
// target; then a linear record scan within the page.
func (e *encodingTable) findContentKey(cKey []byte) (eKey []byte, decodedSize uint64, ok bool) {
	entrySize := e.ckeySize + 0x10
	n := e.pageCount
	// upper_bound on page first-keys, then step back one.
	lo, hi := 0, n
	for lo < hi {
		mid := (lo + hi) / 2
		key := e.data[e.headerOff+mid*entrySize : e.headerOff+mid*entrySize+e.ckeySize]
		if bytes.Compare(key, cKey) <= 0 {
			lo = mid + 1
		} else {
			hi = mid
		}
	}
	pageIndex := lo - 1
	if pageIndex < 0 {
		return nil, 0, false
	}

	page := e.data[e.pagesOff+pageIndex*e.pageSize : e.pagesOff+(pageIndex+1)*e.pageSize]
	for len(page) >= 1+5+e.ckeySize {
		keyCount := int(page[0])
		recLen := 5 + e.ckeySize + e.ekeySize*keyCount
		if 1+recLen > len(page) {
			break
		}
		rec := page[1 : 1+recLen]
		if keyCount == 0 {
			page = page[1+recLen:]
			continue
		}
		recCKey := rec[5 : 5+e.ckeySize]
		if bytes.Equal(recCKey, cKey) {
			size := uint64(rec[0])<<32 | uint64(rec[1])<<24 | uint64(rec[2])<<16 | uint64(rec[3])<<8 | uint64(rec[4])
			return rec[5+e.ckeySize : 5+e.ckeySize+e.ekeySize], size, true
		}
		page = page[1+recLen:]
	}
	return nil, 0, false
}
