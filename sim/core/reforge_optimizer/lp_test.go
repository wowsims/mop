package reforgeoptimizer

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"testing"
)

// TestModelToLPFormatReference is a reference-output regression test for the LP serializer:
// the fixed model in test-fixtures/lp_parity_model.json must serialize byte-for-byte to the stored
// test-fixtures/lp_parity_reference.lp. If this fails after touching lp.go, the emitted LP text has
// changed, which would alter HiGHS tie-breaking among equal-objective solutions.
func TestModelToLPFormatReference(t *testing.T) {
	type jsonKV struct {
		K string  `json:"k"`
		V float64 `json:"v"`
	}
	type jsonVar struct {
		Name   string   `json:"name"`
		Coeffs []jsonKV `json:"coeffs"`
	}
	type jsonCons struct {
		Name string            `json:"name"`
		C    map[string]string `json:"c"`
	}
	type jsonModel struct {
		Direction   string     `json:"direction"`
		Objective   string     `json:"objective"`
		Binaries    bool       `json:"binaries"`
		Variables   []jsonVar  `json:"variables"`
		Constraints []jsonCons `json:"constraints"`
	}

	raw, err := os.ReadFile("test-fixtures/lp_parity_model.json")
	if err != nil {
		t.Fatalf("read model.json: %v", err)
	}
	var jm jsonModel
	if err := json.Unmarshal(raw, &jm); err != nil {
		t.Fatalf("unmarshal model.json: %v", err)
	}

	parseBound := func(s string) float64 {
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			t.Fatalf("bad bound %q: %v", s, err)
		}
		return f
	}

	variables := newLPVariables()
	for _, v := range jm.Variables {
		coeffs := make(map[string]float64, len(v.Coeffs))
		for _, kv := range v.Coeffs {
			coeffs[kv.K] = kv.V
		}
		variables.set(v.Name, coeffs)
	}
	constraints := newLPConstraints()
	for _, c := range jm.Constraints {
		var con lpConstraint
		if s, ok := c.C["equal"]; ok {
			con.equal, con.hasEqual = parseBound(s), true
		}
		if s, ok := c.C["min"]; ok {
			con.min, con.hasMin = parseBound(s), true
		}
		if s, ok := c.C["max"]; ok {
			con.max, con.hasMax = parseBound(s), true
		}
		constraints.set(c.Name, con)
	}

	model := &lpModel{
		direction:   jm.Direction,
		objective:   jm.Objective,
		variables:   variables,
		constraints: constraints,
		binaries:    jm.Binaries,
	}

	got, _ := modelToLPFormat(model)

	wantBytes, err := os.ReadFile("test-fixtures/lp_parity_reference.lp")
	if err != nil {
		t.Fatalf("read reference.lp: %v", err)
	}
	want := string(wantBytes)
	if got == want {
		return
	}

	gotLines := strings.Split(got, "\n")
	wantLines := strings.Split(want, "\n")
	n := min(len(gotLines), len(wantLines))
	for i := 0; i < n; i++ {
		if gotLines[i] != wantLines[i] {
			t.Fatalf("LP text differs at line %d:\n  got:  %q\n  want: %q", i, gotLines[i], wantLines[i])
		}
	}
	t.Fatalf("LP text differs in length: got %d lines, want %d lines", len(gotLines), len(wantLines))
}
