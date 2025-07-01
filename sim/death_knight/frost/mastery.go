package frost

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/death_knight"
)

// Increases all Frost damage done by (16 + (<Mastery Rating>/600)*2)%.
func (fdk *FrostDeathKnight) registerMastery() {
	// Beta changes 2025-06-21: https://eu.forums.blizzard.com/en/wow/t/feedback-mists-of-pandaria-class-changes/576939/51
	// - Soul Reaper now scales with your Mastery. [New]
	// - Obliterate now scales with your Mastery. [New]
	// Undocummented: only 20% effective when using a Two-handed weapon.
	physicalMod := fdk.AddDynamicMod(core.SpellModConfig{
		Kind:      core.SpellMod_DamageDone_Pct,
		ClassMask: death_knight.DeathKnightSpellObliterate | death_knight.DeathKnightSpellSoulReaper,
	})

	frostMod := fdk.AddDynamicMod(core.SpellModConfig{
		Kind:   core.SpellMod_DamageDone_Pct,
		School: core.SpellSchoolFrost,
	})

	extraMultiplier := 1.0

	fdk.AddOnMasteryStatChanged(func(sim *core.Simulation, oldMastery float64, newMastery float64) {
		newMasteryMultiplier := fdk.getMasteryPercent(newMastery)
		physicalMod.UpdateFloatValue(newMasteryMultiplier * extraMultiplier)
		frostMod.UpdateFloatValue(newMasteryMultiplier)
	})

	core.MakePermanent(fdk.RegisterAura(core.Aura{
		Label:    "Frozen Heart" + fdk.Label,
		ActionID: core.ActionID{SpellID: 77514},

		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			if mh := fdk.GetMHWeapon(); mh != nil && mh.HandType == proto.HandType_HandTypeTwoHand {
				extraMultiplier = 0.1
			} else {
				extraMultiplier = 0.5
			}
		},
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			masteryMultiplier := fdk.getMasteryPercent(fdk.GetStat(stats.MasteryRating))
			physicalMod.UpdateFloatValue(masteryMultiplier * extraMultiplier)
			physicalMod.Activate()
			frostMod.UpdateFloatValue(masteryMultiplier)
			frostMod.Activate()
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			physicalMod.Deactivate()
			frostMod.Deactivate()
		},
	}))

	fdk.RegisterItemSwapCallback(core.AllWeaponSlots(), func(sim *core.Simulation, slot proto.ItemSlot) {
		if mh := fdk.GetMHWeapon(); mh != nil && mh.HandType == proto.HandType_HandTypeTwoHand {
			extraMultiplier = 0.1
		} else {
			extraMultiplier = 0.5
		}
	})
}

func (fdk *FrostDeathKnight) getMasteryPercent(masteryRating float64) float64 {
	return 0.16 + 0.02*core.MasteryRatingToMasteryPoints(masteryRating)
}
