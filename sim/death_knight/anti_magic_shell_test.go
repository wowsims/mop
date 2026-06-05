package death_knight

import (
	"testing"
	"time"

	"github.com/wowsims/mop/sim/core"
)

// When the user configures multiple AMS damage ticks, they are spread evenly across the
// shell's 5s window, each landing in the centre of its own equal sub-interval.
func TestAntiMagicShellTickOffset(t *testing.T) {
	const window = 5 * time.Second

	cases := []struct {
		numTicks int32
		expected []time.Duration // offset of each tick within the window
	}{
		{numTicks: 2, expected: []time.Duration{1250 * time.Millisecond, 3750 * time.Millisecond}},
		{numTicks: 3, expected: []time.Duration{time.Second * 5 / 6, time.Second * 5 / 2, time.Second * 25 / 6}},
		{
			numTicks: 5,
			expected: []time.Duration{
				500 * time.Millisecond,
				1500 * time.Millisecond,
				2500 * time.Millisecond,
				3500 * time.Millisecond,
				4500 * time.Millisecond,
			},
		},
	}

	for _, tc := range cases {
		for i := int32(0); i < tc.numTicks; i++ {
			got := antiMagicShellTickOffset(window, i, tc.numTicks)
			if got != tc.expected[i] {
				t.Errorf("numTicks=%d tick %d: expected %s, got %s", tc.numTicks, i, tc.expected[i], got)
			}
			// Every tick must land strictly within the window so it fires before the shell expires.
			if got <= 0 || got >= window {
				t.Errorf("numTicks=%d tick %d: offset %s is outside the (0, %s) window", tc.numTicks, i, got, window)
			}
		}
	}
}

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
