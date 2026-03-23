package shaman

import (
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
)

type LightingElemental struct {
	core.Pet
	LightningBlast *core.Spell
	shamanOwner    *Shaman
}

var LightingElementalSpellPowerScaling = 1.0

func (shaman *Shaman) NewLightingElemental() *LightingElemental {
	lightningElemental := &LightingElemental{
		Pet: core.NewPet(core.PetConfig{
			Name:                            "Lightning Elemental",
			Owner:                           &shaman.Character,
			BaseStats:                       shaman.lightningElementalBaseStats(),
			NonHitExpStatInheritance:        shaman.lightningElementalStatInheritance(),
			EnabledOnStart:                  false,
			IsGuardian:                      true,
			HasDynamicCastSpeedInheritance:  true,
			HasDynamicMeleeSpeedInheritance: true,
			StartsAtOwnerDistance:           true,
		}),
		shamanOwner: shaman,
	}
	lightningElemental.OnPetEnable = lightningElemental.enable
	lightningElemental.OnPetDisable = lightningElemental.disable

	shaman.AddPet(lightningElemental)

	return lightningElemental
}

func (lightningElemental *LightingElemental) enable(_ *core.Simulation) {}

func (lightningElemental *LightingElemental) disable(sim *core.Simulation) {}

func (lightningElemental *LightingElemental) GetPet() *core.Pet {
	return &lightningElemental.Pet
}

func (lightningElemental *LightingElemental) Initialize() {
	lightningElemental.registerLightningBlast()
}

func (lightningElemental *LightingElemental) Reset(_ *core.Simulation) {
}

func (lightningElemental *LightingElemental) OnEncounterStart(_ *core.Simulation) {
}

func (lightningElemental *LightingElemental) ExecuteCustomRotation(sim *core.Simulation) {
	lightningElemental.LightningBlast.Cast(sim, lightningElemental.CurrentTarget)
}

func (shaman *Shaman) lightningElementalBaseStats() stats.Stats {
	return stats.Stats{
		stats.Stamina: 8000, // Placeholder value
	}
}

func (shaman *Shaman) lightningElementalStatInheritance() core.PetStatInheritance {
	return func(ownerStats stats.Stats) stats.Stats {
		ownerSpellCritPercent := ownerStats[stats.SpellCritPercent]
		ownerPhysicalCritPercent := ownerStats[stats.PhysicalCritPercent]
		ownerHasteRating := ownerStats[stats.HasteRating]
		critPercent := core.TernaryFloat64(math.Abs(ownerPhysicalCritPercent) > math.Abs(ownerSpellCritPercent), ownerPhysicalCritPercent, ownerSpellCritPercent)
		return stats.Stats{
			stats.Stamina:    ownerStats[stats.Stamina],
			stats.SpellPower: ownerStats[stats.SpellPower] * LightingElementalSpellPowerScaling,

			stats.SpellCritPercent:    critPercent,
			stats.PhysicalCritPercent: critPercent,
			stats.HasteRating:         ownerHasteRating,
		}
	}
}

func (lightningElemental *LightingElemental) registerLightningBlast() {
	lightningElemental.LightningBlast = lightningElemental.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 145002},
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       SpellFlagShamanSpell,
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      500 * time.Millisecond,
				GCDMin:   500 * time.Millisecond,
				CastTime: 1500 * time.Millisecond,
			},
		},
		MissileSpeed:     35,
		DamageMultiplier: 1,
		CritMultiplier:   lightningElemental.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: 0.80000001192,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := lightningElemental.CalcAndRollDamageRange(sim, 2.5, 0.15000000596)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},
	})
}
