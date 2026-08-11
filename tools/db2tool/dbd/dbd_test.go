package dbd

import (
	"strings"
	"testing"
)

// A .dbd covering every construct the 72 configured tables actually use:
// plain/foreign-key/unverified columns, all five types, $id$ / $noninline,id$ /
// $relation$ annotations, signed and unsigned <size> suffixes, [n] arrays,
// LAYOUT + single builds + a build range, and a COMMENT.
const sampleDBD = `COLUMNS
int ID
int<Item::ID> ItemID
uint Flags
float Coefficient
string Path
locstring Name
int Unverified?
int Legacy

LAYOUT 0A1B2C3D
BUILD 5.5.0.60000
COMMENT older layout
$id$ID<32>
Legacy<16>
Coefficient
Name

LAYOUT 4E5F6071, 8899AABB
BUILD 5.5.4.68571, 5.5.4.68806
BUILD 5.4.0.10000-5.4.9.19999
$noninline,id$ID<32>
$relation$ItemID<32>
Flags<u8>[3]
Coefficient
Path
Name
Unverified<32>
`

func parseSample(t *testing.T) DBDefinition {
	t.Helper()
	def, err := Read(strings.NewReader(sampleDBD), true)
	if err != nil {
		t.Fatal(err)
	}
	return def
}

func TestReadColumnDefinitions(t *testing.T) {
	def := parseSample(t)

	if got := def.ColumnDefinitions["ID"].Type; got != "int" {
		t.Errorf("ID type = %q, want int", got)
	}
	if got := def.ColumnDefinitions["Flags"].Type; got != "uint" {
		t.Errorf("Flags type = %q, want uint", got)
	}
	if got := def.ColumnDefinitions["Name"].Type; got != "locstring" {
		t.Errorf("Name type = %q, want locstring", got)
	}

	// Foreign keys drive both the NULL-ability and the IX_ index in the schema.
	item := def.ColumnDefinitions["ItemID"]
	if item.ForeignTable != "Item" || item.ForeignColumn != "ID" {
		t.Errorf("ItemID foreign key = %q::%q, want Item::ID", item.ForeignTable, item.ForeignColumn)
	}
	if def.ColumnDefinitions["ID"].ForeignTable != "" {
		t.Error("ID must not have a foreign key")
	}

	// A trailing ? marks the column unverified and must not survive in the name.
	if !def.ColumnDefinitions["ID"].Verified {
		t.Error("ID should be verified")
	}
	if u, ok := def.ColumnDefinitions["Unverified"]; !ok || u.Verified {
		t.Errorf("Unverified column = %+v, ok=%v; want present and unverified", u, ok)
	}
}

func TestReadVersionDefinitions(t *testing.T) {
	def := parseSample(t)

	if len(def.VersionDefinitions) != 2 {
		t.Fatalf("parsed %d version blocks, want 2", len(def.VersionDefinitions))
	}
	old, cur := def.VersionDefinitions[0], def.VersionDefinitions[1]

	if len(old.Builds) != 1 || old.Builds[0].Build != 60000 {
		t.Errorf("first block builds = %v, want one 60000", old.Builds)
	}
	if old.Comment != "older layout" {
		t.Errorf("first block comment = %q", old.Comment)
	}
	if len(old.LayoutHashes) != 1 || old.LayoutHashes[0] != "0A1B2C3D" {
		t.Errorf("first block layout hashes = %v", old.LayoutHashes)
	}

	if len(cur.Builds) != 2 || cur.Builds[0].Build != 68571 || cur.Builds[1].Build != 68806 {
		t.Errorf("second block builds = %v, want 68571 and 68806", cur.Builds)
	}
	if len(cur.BuildRanges) != 1 {
		t.Fatalf("second block build ranges = %v, want 1", cur.BuildRanges)
	}
	if got := cur.BuildRanges[0].String(); got != "5.4.0.10000-5.4.9.19999" {
		t.Errorf("build range = %q", got)
	}
	if len(cur.LayoutHashes) != 2 {
		t.Errorf("second block layout hashes = %v, want 2", cur.LayoutHashes)
	}
}

func TestReadDefinitionAnnotations(t *testing.T) {
	def := parseSample(t)
	byName := map[string]Definition{}
	for _, d := range def.VersionDefinitions[1].Definitions {
		byName[d.Name] = d
	}

	// $noninline,id$ — the id lives in the index block, not the record.
	id := byName["ID"]
	if !id.IsID || !id.IsNonInline || id.Size != 32 || !id.IsSigned {
		t.Errorf("ID = %+v, want id + noninline + signed size 32", id)
	}
	// An inline $id$ must NOT be flagged non-inline.
	oldID := def.VersionDefinitions[0].Definitions[0]
	if !oldID.IsID || oldID.IsNonInline {
		t.Errorf("first-block ID = %+v, want id and inline", oldID)
	}

	rel := byName["ItemID"]
	if !rel.IsRelation || rel.IsNonInline {
		t.Errorf("ItemID = %+v, want relation and inline", rel)
	}

	// <u8>[3]: unsigned, 8-bit, three elements.
	flags := byName["Flags"]
	if flags.Size != 8 || flags.IsSigned || flags.ArrLength != 3 {
		t.Errorf("Flags = %+v, want unsigned size 8 arrLength 3", flags)
	}

	// float/string/locstring carry no size, and non-arrays report 0.
	for _, name := range []string{"Coefficient", "Path", "Name"} {
		if d := byName[name]; d.Size != 0 || d.ArrLength != 0 {
			t.Errorf("%s = %+v, want size 0 arrLength 0", name, d)
		}
	}
}

func TestSelectVersionExactBuildOnly(t *testing.T) {
	def := parseSample(t)

	for _, build := range []uint32{68571, 68806} {
		v, err := SelectVersion(def, build)
		if err != nil {
			t.Fatalf("build %d: %v", build, err)
		}
		if len(v.Definitions) != 7 {
			t.Errorf("build %d selected %d definitions, want the 7-column block", build, len(v.Definitions))
		}
	}

	v, err := SelectVersion(def, 60000)
	if err != nil {
		t.Fatal(err)
	}
	if len(v.Definitions) != 4 {
		t.Errorf("build 60000 selected %d definitions, want the 4-column block", len(v.Definitions))
	}

	// A build covered only by a buildRange is deliberately NOT matched: an
	// unlisted live build must fail loud rather than decode with a near-miss
	// layout.
	if _, err := SelectVersion(def, 15000); err == nil {
		t.Error("a build inside a buildRange must not be selected")
	}
	if _, err := SelectVersion(def, 99999); err == nil {
		t.Error("an unknown build must be rejected")
	}
}

func TestReadRejectsMalformed(t *testing.T) {
	tests := map[string]string{
		"no COLUMNS header": "BUILD 1.2.3.4\nID\n",
		"unknown type":      "COLUMNS\nblob Data\n\nBUILD 1.2.3.4\nData\n",
		"missing space":     "COLUMNS\nintID\n\nBUILD 1.2.3.4\nintID\n",
		"undeclared column": "COLUMNS\nint ID\n\nBUILD 1.2.3.4\nMissing<32>\n",
		"int without size":  "COLUMNS\nint ID\n\nBUILD 1.2.3.4\nID\n",
		"size on a string":  "COLUMNS\nstring S\n\nBUILD 1.2.3.4\nS<32>\n",
		"bad build string":  "COLUMNS\nint ID\n\nBUILD notabuild\nID<32>\n",
		"empty file":        "",
	}
	for name, src := range tests {
		if _, err := Read(strings.NewReader(src), true); err == nil {
			t.Errorf("%s: expected an error, got nil", name)
		}
	}
}

func TestParseBuild(t *testing.T) {
	b, err := ParseBuild("5.5.4.68571")
	if err != nil {
		t.Fatal(err)
	}
	if b.Expansion != 5 || b.Major != 5 || b.Minor != 4 || b.Build != 68571 {
		t.Errorf("ParseBuild = %+v", b)
	}
	if got := b.String(); got != "5.5.4.68571" {
		t.Errorf("String() = %q", got)
	}
	for _, bad := range []string{"5.5.4", "5.5.4.68571.1", "", "a.b.c.d", "5.5.4.x"} {
		if _, err := ParseBuild(bad); err == nil {
			t.Errorf("ParseBuild(%q) should have failed", bad)
		}
	}
}

func TestBuildCompareAndRange(t *testing.T) {
	mustParse := func(s string) Build {
		t.Helper()
		b, err := ParseBuild(s)
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	lo, hi := mustParse("5.4.0.10000"), mustParse("5.4.9.19999")
	r := BuildRange{MinBuild: lo, MaxBuild: hi}

	for _, in := range []string{"5.4.0.10000", "5.4.5.15000", "5.4.9.19999"} {
		if !r.Contains(mustParse(in)) {
			t.Errorf("%s should be inside %s", in, r)
		}
	}
	for _, out := range []string{"5.3.9.9999", "5.5.0.10001", "5.4.0.9999"} {
		if r.Contains(mustParse(out)) {
			t.Errorf("%s should be outside %s", out, r)
		}
	}
	if mustParse("5.5.4.68571").Compare(mustParse("5.5.4.68806")) >= 0 {
		t.Error("68571 should compare less than 68806")
	}
	if mustParse("5.5.4.68571").Compare(mustParse("5.5.4.68571")) != 0 {
		t.Error("identical builds should compare equal")
	}
}
