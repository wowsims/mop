// Go translation of DBDefsLib's DBDReader
// (https://github.com/wowdev/WoWDBDefs, code/C#/DBDefsLib).
// Copyright 2022 WoWDBDefs Contributors. Licensed under BSD-3-Clause; this
// file remains BSD-3-Clause (full text, including the non-endorsement clause,
// in tools/db2tool/NOTICES.md). Upstream commit 9002c532853a96d631c76dda50cb20189c27a173.

// Package dbd parses WoWDBDefs .dbd definition files and selects the version
// block matching an exact build number.
package dbd

import (
	"fmt"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
)

type ColumnDefinition struct {
	Type          string
	ForeignTable  string
	ForeignColumn string
	Verified      bool
	Comment       string
}

type Definition struct {
	Size        int
	ArrLength   int
	Name        string
	IsID        bool
	IsRelation  bool
	IsNonInline bool
	IsSigned    bool
	Comment     string
}

type Build struct {
	Expansion int16
	Major     int16
	Minor     int16
	Build     uint32
}

func ParseBuild(s string) (Build, error) {
	split := strings.Split(s, ".")
	if len(split) != 4 {
		return Build{}, fmt.Errorf("invalid build string %q", s)
	}
	expansion, err := strconv.ParseInt(split[0], 10, 16)
	if err != nil {
		return Build{}, fmt.Errorf("invalid build string %q: %w", s, err)
	}
	major, err := strconv.ParseInt(split[1], 10, 16)
	if err != nil {
		return Build{}, fmt.Errorf("invalid build string %q: %w", s, err)
	}
	minor, err := strconv.ParseInt(split[2], 10, 16)
	if err != nil {
		return Build{}, fmt.Errorf("invalid build string %q: %w", s, err)
	}
	build, err := strconv.ParseUint(split[3], 10, 32)
	if err != nil {
		return Build{}, fmt.Errorf("invalid build string %q: %w", s, err)
	}
	return Build{Expansion: int16(expansion), Major: int16(major), Minor: int16(minor), Build: uint32(build)}, nil
}

func (b Build) String() string {
	return fmt.Sprintf("%d.%d.%d.%d", b.Expansion, b.Major, b.Minor, b.Build)
}

func (b Build) Compare(o Build) int {
	if b.Expansion != o.Expansion {
		return int(b.Expansion) - int(o.Expansion)
	}
	if b.Major != o.Major {
		return int(b.Major) - int(o.Major)
	}
	if b.Minor != o.Minor {
		return int(b.Minor) - int(o.Minor)
	}
	if b.Build != o.Build {
		if b.Build < o.Build {
			return -1
		}
		return 1
	}
	return 0
}

type BuildRange struct {
	MinBuild Build
	MaxBuild Build
}

func (r BuildRange) Contains(b Build) bool {
	return b.Compare(r.MinBuild) >= 0 && b.Compare(r.MaxBuild) <= 0
}

func (r BuildRange) String() string {
	return r.MinBuild.String() + "-" + r.MaxBuild.String()
}

type VersionDefinitions struct {
	Builds       []Build
	BuildRanges  []BuildRange
	LayoutHashes []string
	Comment      string
	Definitions  []Definition
}

type DBDefinition struct {
	ColumnDefinitions  map[string]ColumnDefinition
	VersionDefinitions []VersionDefinitions
}

// ReadFile parses a .dbd definition file from disk.
func ReadFile(path string, validate bool) (DBDefinition, error) {
	f, err := os.Open(path)
	if err != nil {
		return DBDefinition{}, err
	}
	defer f.Close()
	def, err := Read(f, validate)
	if err != nil {
		return DBDefinition{}, fmt.Errorf("%s: %w", path, err)
	}
	return def, nil
}

// Read parses a .dbd definition stream. It is a line-for-line transcription
// of the upstream reader (deliberately faithful even where behavior is
// quirky).
func Read(r io.Reader, validate bool) (DBDefinition, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return DBDefinition{}, err
	}
	lines := readLines(raw)
	if len(lines) == 0 {
		return DBDefinition{}, fmt.Errorf("empty .dbd file")
	}

	columnDefinitions := make(map[string]ColumnDefinition)
	lineNumber := 0

	if !strings.HasPrefix(lines[0], "COLUMNS") {
		return DBDefinition{}, fmt.Errorf("file does not start with column definitions")
	}

	lineNumber++
	for lineNumber < len(lines) {
		line := lines[lineNumber]
		lineNumber++

		// Column definitions are done after encountering a blank line.
		if isBlank(line) {
			break
		}

		var colDef ColumnDefinition

		if !strings.Contains(line, " ") {
			return DBDefinition{}, fmt.Errorf("line %q does not contain a space between type and column name", line)
		}

		// Read line up to space (end of type) or < (foreign key).
		typeEnd := strings.IndexAny(line, " <")
		colType := line[:typeEnd]
		switch colType {
		case "uint", "int", "float", "string", "locstring":
			colDef.Type = colType
		default:
			return DBDefinition{}, fmt.Errorf("invalid type %q on line %d", colType, lineNumber)
		}

		// Only read foreign key if the identifier is right after the type.
		if strings.HasPrefix(line, colType+"<") {
			lt := strings.Index(line, "<")
			gt := strings.Index(line, ">")
			if gt < lt {
				return DBDefinition{}, fmt.Errorf("malformed foreign key on line %d", lineNumber)
			}
			foreignKey := strings.Split(line[lt+1:gt], "::")
			if len(foreignKey) != 2 {
				return DBDefinition{}, fmt.Errorf("invalid foreign key length: %d", len(foreignKey))
			}
			colDef.ForeignTable = foreignKey[0]
			colDef.ForeignColumn = foreignKey[1]
		}

		var name string
		if strings.LastIndex(line, " ") == strings.Index(line, " ") {
			// Simple line like "uint ID".
			name = line[strings.Index(line, " ")+1:]
		} else {
			start := strings.Index(line, " ")
			second := indexFrom(line, ' ', start+1)
			name = line[start+1 : second]
		}

		if strings.HasSuffix(name, "?") {
			colDef.Verified = false
			name = name[:len(name)-1]
		} else {
			colDef.Verified = true
		}

		if idx := strings.Index(line, "//"); idx >= 0 {
			colDef.Comment = strings.TrimSpace(line[idx+2:])
		}

		if _, exists := columnDefinitions[name]; exists {
			fmt.Fprintf(os.Stderr, "dbd: collision with existing column name %q, skipping\n", name)
		} else {
			columnDefinitions[name] = colDef
		}
	}

	var versionDefinitions []VersionDefinitions

	var definitions []Definition
	var layoutHashes []string
	comment := ""
	var builds []Build
	var buildRanges []BuildRange

	flush := func() error {
		if len(builds) != 0 || len(buildRanges) != 0 || len(layoutHashes) != 0 {
			versionDefinitions = append(versionDefinitions, VersionDefinitions{
				Builds:       append([]Build(nil), builds...),
				BuildRanges:  append([]BuildRange(nil), buildRanges...),
				LayoutHashes: append([]string(nil), layoutHashes...),
				Comment:      comment,
				Definitions:  append([]Definition(nil), definitions...),
			})
		} else if len(definitions) != 0 || !isBlank(comment) {
			return fmt.Errorf("no BUILD or LAYOUT, but non-empty lines/definitions")
		}
		return nil
	}

	for i := lineNumber; i < len(lines); i++ {
		line := lines[i]

		if isBlank(line) {
			if err := flush(); err != nil {
				return DBDefinition{}, err
			}
			definitions = nil
			layoutHashes = nil
			comment = ""
			builds = nil
			buildRanges = nil
		}

		if strings.HasPrefix(line, "LAYOUT") {
			layoutHashes = append(layoutHashes, strings.Split(line[7:], ", ")...)
		}

		if strings.HasPrefix(line, "BUILD") {
			for splitBuild := range strings.SplitSeq(line[6:], ", ") {
				if strings.Contains(splitBuild, "-") {
					splitRange := strings.Split(splitBuild, "-")
					minBuild, err := ParseBuild(splitRange[0])
					if err != nil {
						return DBDefinition{}, err
					}
					maxBuild, err := ParseBuild(splitRange[1])
					if err != nil {
						return DBDefinition{}, err
					}
					buildRanges = append(buildRanges, BuildRange{MinBuild: minBuild, MaxBuild: maxBuild})
				} else {
					build, err := ParseBuild(splitBuild)
					if err != nil {
						return DBDefinition{}, err
					}
					builds = append(builds, build)
				}
			}
		}

		if strings.HasPrefix(line, "COMMENT") {
			comment = strings.TrimSpace(line[7:])
		}

		if !strings.HasPrefix(line, "LAYOUT") && !strings.HasPrefix(line, "BUILD") &&
			!strings.HasPrefix(line, "COMMENT") && !isBlank(line) {
			definition := Definition{IsNonInline: false}

			if strings.Contains(line, "$") {
				annotationStart := strings.Index(line, "$")
				annotationEnd := indexFrom(line, '$', 1)
				if annotationEnd < 0 {
					return DBDefinition{}, fmt.Errorf("unterminated annotation on line %q", line)
				}
				for a := range strings.SplitSeq(line[annotationStart+1:annotationEnd], ",") {
					switch a {
					case "id":
						definition.IsID = true
					case "noninline":
						definition.IsNonInline = true
					case "relation":
						definition.IsRelation = true
					}
				}
				// Upstream removes annotationEnd+1 chars from annotationStart
				// (not the annotation's span); replicated faithfully.
				line = line[:annotationStart] + line[annotationStart+annotationEnd+1:]
			}

			if strings.Contains(line, "<") {
				lt := strings.Index(line, "<")
				gt := strings.Index(line, ">")
				if gt < lt {
					return DBDefinition{}, fmt.Errorf("malformed size on line %q", line)
				}
				size := line[lt+1 : gt]
				if size == "" {
					return DBDefinition{}, fmt.Errorf("empty size on line %q", line)
				}
				if size[0] == 'u' {
					definition.IsSigned = false
					n, err := strconv.Atoi(strings.ReplaceAll(size, "u", ""))
					if err != nil {
						return DBDefinition{}, fmt.Errorf("invalid size %q: %w", size, err)
					}
					definition.Size = n
				} else {
					definition.IsSigned = true
					n, err := strconv.Atoi(size)
					if err != nil {
						return DBDefinition{}, fmt.Errorf("invalid size %q: %w", size, err)
					}
					definition.Size = n
				}
				line = line[:lt] + line[gt+1:]
			}

			if strings.Contains(line, "[") {
				lb := strings.Index(line, "[")
				rb := strings.Index(line, "]")
				if rb < lb {
					return DBDefinition{}, fmt.Errorf("invalid array length format")
				}
				n, err := strconv.Atoi(line[lb+1 : rb])
				if err != nil {
					return DBDefinition{}, fmt.Errorf("invalid array length format")
				}
				definition.ArrLength = n
				line = line[:lb] + line[rb+1:]
			}

			if idx := strings.Index(line, "//"); idx >= 0 {
				definition.Comment = strings.TrimSpace(line[idx+2:])
				line = strings.TrimSpace(line[:idx])
			}

			definition.Name = line

			colDef, ok := columnDefinitions[definition.Name]
			if !ok {
				return DBDefinition{}, fmt.Errorf("unable to find %q in column definitions", definition.Name)
			}
			// Temporary unsigned format update conversion code (upstream).
			if colDef.Type == "uint" {
				definition.IsSigned = false
			}

			definitions = append(definitions, definition)
		}

		if len(lines) == i+1 {
			if err := flush(); err != nil {
				return DBDefinition{}, err
			}
		}
	}

	if validate {
		if err := runValidation(columnDefinitions, versionDefinitions); err != nil {
			return DBDefinition{}, err
		}
	}

	return DBDefinition{
		ColumnDefinitions:  columnDefinitions,
		VersionDefinitions: versionDefinitions,
	}, nil
}

// runValidation is the optional validation pass: warnings go to stderr, hard
// violations become errors. It also removes column definitions never used by
// any version block, as upstream does.
func runValidation(columnDefinitions map[string]ColumnDefinition, versionDefinitions []VersionDefinitions) error {
	for name := range columnDefinitions {
		found := false
		for _, version := range versionDefinitions {
			for _, definition := range version.Definitions {
				if name == definition.Name {
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if !found {
			fmt.Fprintf(os.Stderr, "dbd: column definition %q is never used in version definitions\n", name)
			delete(columnDefinitions, name)
		}
	}

	seenBuilds := make(map[Build]bool)
	seenLayoutHashes := make(map[string]bool)

	for _, version := range versionDefinitions {
		for _, build := range version.Builds {
			if seenBuilds[build] {
				return fmt.Errorf("build %s is already defined", build)
			}
			seenBuilds[build] = true
		}

		for _, layoutHash := range version.LayoutHashes {
			if seenLayoutHashes[layoutHash] {
				return fmt.Errorf("layout hash %s is already defined", layoutHash)
			}
			seenLayoutHashes[layoutHash] = true
			if len(layoutHash) != 8 {
				return fmt.Errorf("layout hash %q is wrong length", layoutHash)
			}
		}

		for _, definition := range version.Definitions {
			colType := columnDefinitions[definition.Name].Type
			if (colType == "int" || colType == "uint") && definition.Size == 0 {
				return fmt.Errorf("version definition %s is an int/uint but is missing size", definition.Name)
			}
			if colType != "int" && colType != "uint" && definition.Size != 0 {
				return fmt.Errorf("version definition %s is NOT an int/uint but has size", definition.Name)
			}
		}

		names := make(map[string]bool)
		for _, definition := range version.Definitions {
			if names[definition.Name] {
				return fmt.Errorf("version definitions contains multiple columns of the same name")
			}
			names[definition.Name] = true
		}
	}

	for i := range versionDefinitions {
		for j := range versionDefinitions {
			if i == j {
				continue
			}
			for _, r := range versionDefinitions[i].BuildRanges {
				for _, b := range versionDefinitions[j].Builds {
					if r.Contains(b) {
						return fmt.Errorf("build %s conflicts with %s", b, r)
					}
				}
				for _, or := range versionDefinitions[j].BuildRanges {
					if r.Contains(or.MinBuild) || r.Contains(or.MaxBuild) {
						return fmt.Errorf("build %s conflicts with %s", or, r)
					}
				}
			}

			if slices.Equal(versionDefinitions[i].Definitions, versionDefinitions[j].Definitions) {
				if len(versionDefinitions[i].LayoutHashes) > 0 && len(versionDefinitions[j].LayoutHashes) > 0 &&
					!slices.Equal(versionDefinitions[i].LayoutHashes, versionDefinitions[j].LayoutHashes) {
					// Upstream ignores this case (identical definitions, different layout hashes).
				} else {
					return fmt.Errorf("dbd file has 2 identical version definitions (%d and %d)", i+1, j+1)
				}
			}
		}
	}

	return nil
}

// readLines splits raw file bytes into lines: \r\n, \r, and \n all terminate
// a line, a terminator at EOF does not produce a trailing empty line, and a
// leading UTF-8 BOM is stripped.
func readLines(raw []byte) []string {
	s := string(raw)
	s = strings.TrimPrefix(s, "\ufeff")
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	lines := strings.Split(s, "\n")
	if len(lines) > 0 && lines[len(lines)-1] == "" && strings.HasSuffix(s, "\n") {
		lines = lines[:len(lines)-1]
	}
	if len(lines) == 1 && lines[0] == "" {
		return nil
	}
	return lines
}

func isBlank(s string) bool {
	return strings.TrimSpace(s) == ""
}

func indexFrom(s string, c byte, from int) int {
	if from >= len(s) {
		return -1
	}
	idx := strings.IndexByte(s[from:], c)
	if idx < 0 {
		return -1
	}
	return from + idx
}
