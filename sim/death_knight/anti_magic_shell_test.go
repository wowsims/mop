package death_knight

import (
	"testing"

	"github.com/wowsims/mop/sim/core"
)

// Anti-Magic Shell generates Runic Power based on the magic damage it is exposed to,
// before its own % reduction. Derived from MoP-Classic WCL logs: a flat 0.0007 RP per
// point of presented damage, independent of max health and of the absorb % (75%/100%).
func TestAntiMagicShellRunicPower(t *testing.T) {
	const tolerance = 0.0001

	cases := []struct {
		name           string
		absorbedDamage float64
		leftoverDamage float64
		expectedRP     float64
	}{
		{
			// Glyph of AMS (100% absorb): a 40k magic hit is fully absorbed, nothing leftover.
			name:           "fully absorbed",
			absorbedDamage: 40000,
			leftoverDamage: 0,
			expectedRP:     28, // 40000 * 0.0007
		},
		{
			// No glyph (75% absorb): the same 40k hit -> 30k absorbed, 10k leftover. RP must
			// match the fully-absorbed case because it is based on the damage AMS was exposed
			// to (40k), not the amount it actually absorbed.
			name:           "partial reduction, same presented damage gives same RP",
			absorbedDamage: 30000,
			leftoverDamage: 10000,
			expectedRP:     28,
		},
		{
			// Shield caps mid-hit: AMS absorbs only part and the rest lands as damage, yet RP
			// still reflects the full exposure (WCL: 146807 presented -> 105 RP whether fully
			// absorbed or shield-capped).
			name:           "shield capped mid hit",
			absorbedDamage: 73538,
			leftoverDamage: 73269,
			expectedRP:     102.7649, // 146807 * 0.0007
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := antiMagicShellRunicPower(tc.absorbedDamage, tc.leftoverDamage)
			if !core.WithinToleranceFloat64(tc.expectedRP, got, tolerance) {
				t.Fatalf("expected %.4f RP, got %.4f", tc.expectedRP, got)
			}
		})
	}
}
