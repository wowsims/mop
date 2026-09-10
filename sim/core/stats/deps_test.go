package stats

import (
	"testing"
)

func TestStatDependencies(t *testing.T) {
	baseStat := Stats{
		Stamina:   1,
		Intellect: 1,
		Agility:   2,
		Spirit:    1,
	}

	sdm := NewStatDependencyManager()

	sdm.MultiplyStat(Intellect, 2)
	sdm.AddStatDependency(Stamina, Intellect, 1)
	sdm.MultiplyStat(Stamina, 2)
	sdm.AddStatDependency(Agility, Stamina, 1)

	dep1 := sdm.NewDynamicMultiplyStat(Agility, 2)
	dep2 := sdm.NewDynamicMultiplyStat(Spirit, 3)
	dep3 := sdm.NewDynamicStatDependency(Agility, Spirit, 0.75)

	sdm.FinalizeStatDeps()

	result := sdm.ApplyStatDependencies(baseStat)
	expectedResult := Stats{
		Stamina:   6,
		Intellect: 14,
		Agility:   2,
		Spirit:    1,
	}
	if !result.Equals(expectedResult) {
		t.Fatalf("Stats do not match:\nActual: %s\nExpected: %s", result, expectedResult)
	}

	sdm.EnableDynamicStatDep(dep1)
	result2 := sdm.ApplyStatDependencies(baseStat)
	expectedResult2 := Stats{
		Stamina:   10,
		Intellect: 22,
		Agility:   4,
		Spirit:    1,
	}
	if !result2.Equals(expectedResult2) {
		t.Fatalf("Updated stats do not match:\nActual: %s\nExpected: %s", result2, expectedResult2)
	}

	sdm.EnableDynamicStatDep(dep2)
	result3 := sdm.ApplyStatDependencies(baseStat)
	expectedResult3 := Stats{
		Stamina:   10,
		Intellect: 22,
		Agility:   4,
		Spirit:    3,
	}
	if !result3.Equals(expectedResult3) {
		t.Fatalf("Updated stats do not match:\nActual: %s\nExpected: %s", result3, expectedResult3)
	}

	sdm.DisableDynamicStatDep(dep2)
	result4 := sdm.ApplyStatDependencies(baseStat)
	if !result4.Equals(expectedResult2) {
		t.Fatalf("Updated stats do not match:\nActual: %s\nExpected: %s", result4, expectedResult2)
	}

	sdm.EnableDynamicStatDep(dep3)
	result5 := sdm.ApplyStatDependencies(baseStat)
	expectedResult5 := Stats{
		Stamina:   10,
		Intellect: 22,
		Agility:   4,
		Spirit:    4,
	}
	if !result5.Equals(expectedResult5) {
		t.Fatalf("Updated stats do not match:\nActual: %s\nExpected: %s", result5, expectedResult5)
	}

	sdm.DisableDynamicStatDep(dep3)
	result6 := sdm.ApplyStatDependencies(baseStat)
	if !result6.Equals(expectedResult2) {
		t.Fatalf("Updated stats do not match:\nActual: %s\nExpected: %s", result6, expectedResult2)
	}
}

func TestMultipleStatDep(t *testing.T) {
	sdm := NewStatDependencyManager()

	baseStat := Stats{
		Intellect:  100,
		SpellPower: 100,
	}

	sdm.AddStatDependency(Intellect, SpellPower, 0.2)
	sdm.AddStatDependency(Intellect, SpellPower, 0.2)
	sdm.MultiplyStat(Intellect, 1.2)
	sdm.FinalizeStatDeps()
	result := sdm.ApplyStatDependencies(baseStat)

	expectedResult := Stats{
		Intellect:  100 * 1.2,
		SpellPower: 100 + (100*1.2)*(0.2+0.2),
	}

	if !result.Equals(expectedResult) {
		t.Fatalf("Stats do not match:\nActual: %s\nExpected: %s", result, expectedResult)
	}
}

// A rating granted as a share of an attribute above the class base is
// truncated, never rounded up: a logged Blood Elf Holy Paladin with 10334
// Spirit (base 121) has 5106 hit.
func TestRatingFromStatDependencyTruncates(t *testing.T) {
	sdm := NewStatDependencyManager()
	dep := sdm.NewDynamicRatingFromStatDependency(Spirit, HitRating, 0.5, 121)
	sdm.FinalizeStatDeps()
	sdm.EnableDynamicStatDep(dep)

	for spirit, expected := range map[float64]float64{10334: 5106, 8865: 4372, 16552.9: 8215} {
		if got := sdm.ApplyStatDependencies(Stats{Spirit: spirit})[HitRating]; got != expected {
			t.Errorf("Spirit %v: hit %v, expected %v", spirit, got, expected)
		}
	}

	// Deltas stay linear: no offset, no truncation.
	if got := sdm.ApplyStatDependenciesToDelta(Stats{Spirit: 3})[HitRating]; got != 1.5 {
		t.Errorf("delta hit %v, expected 1.5", got)
	}
}

// Ratings are converted to integers after every multiplier, half to even,
// and equipment multipliers apply before class multipliers regardless of
// registration order. The values are logged Mistweaver haste: 4279 and 7357
// raw with Stance of the Wise Serpent alone, 8404 with a 6.32055%
// Amplification trinket, 8510 with a 9.00854% one.
func TestRatingMultipliersRoundInOrder(t *testing.T) {
	sdm := NewStatDependencyManager()
	classDep := sdm.NewDynamicMultiplyStat(HasteRating, 1.5)
	ampDep := sdm.NewDynamicMultiplyStat(HasteRating, 1.0632055)
	ampDep.fromEquipment = true
	sdm.FinalizeStatDeps()

	sdm.EnableDynamicStatDep(classDep)
	for haste, expected := range map[float64]float64{4279: 6418, 7357: 11036} {
		if got := sdm.ApplyStatDependencies(Stats{HasteRating: haste})[HasteRating]; got != expected {
			t.Errorf("haste %v x1.5: %v, expected %v", haste, got, expected)
		}
	}

	sdm.EnableDynamicStatDep(ampDep)
	if got := sdm.ApplyStatDependencies(Stats{HasteRating: 8404})[HasteRating]; got != 13402 {
		t.Errorf("haste 8404 amplified then x1.5: %v, expected 13402", got)
	}
	if got := sdm.ApplyStatDependenciesToDelta(Stats{HasteRating: 8404})[HasteRating]; got != 8404*1.0632055*1.5 {
		t.Errorf("delta haste %v, expected the unrounded product", got)
	}

	sdm2 := NewStatDependencyManager()
	classDep2 := sdm2.NewDynamicMultiplyStat(HasteRating, 1.5)
	ampDep2 := sdm2.NewDynamicMultiplyStatFromEquipment(HasteRating, 1.0900854)
	sdm2.FinalizeStatDeps()
	sdm2.EnableDynamicStatDep(classDep2)
	sdm2.EnableDynamicStatDep(ampDep2)
	if got := sdm2.ApplyStatDependencies(Stats{HasteRating: 8510})[HasteRating]; got != 13916 {
		t.Errorf("haste 8510 amplified then x1.5: %v, expected 13916", got)
	}
}
