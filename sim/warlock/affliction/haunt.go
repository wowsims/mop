package affliction

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/warlock"
)

// Damage Done By Caster setup
const (
	DDBC_Haunt int = iota
	DDBC_Total
)

const HauntSpellID = 48181

const hauntScale = 2.625
const hauntCoeff = 2.625

func (affliction *AfflictionWarlock) registerHaunt() {
	actionID := core.ActionID{SpellID: HauntSpellID}

	affliction.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolShadow,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: warlock.WarlockSpellHaunt,
		MissileSpeed:   20,

		ManaCost: core.ManaCostOptions{BaseCostPercent: 12},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: 1500 * time.Millisecond,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   affliction.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: hauntCoeff,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return affliction.SoulShards.CanSpend(1)
		},

		// Despite not being a DoT, Haunt maintains a hidden 2s tick
		// timer with a Pandemic effect that grants additional time to
		// debuff refreshes. In order to enable the pandemic refresh, we
		// will register the Haunt debuff as a non-warlock DoT.
		Dot: core.DotConfig{
			Aura: core.Aura{
				Label:    "Haunt-" + affliction.Label,
				ActionID: actionID,

				OnGain: func(aura *core.Aura, sim *core.Simulation) {
					core.EnableDamageDoneByCaster(DDBC_Haunt, DDBC_Total, affliction.AttackTables[aura.Unit.UnitIndex], hauntDamageDoneByCasterHandler)
				},

				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					core.DisableDamageDoneByCaster(DDBC_Haunt, affliction.AttackTables[aura.Unit.UnitIndex])
				},
			},

			NumberOfTicks:       4,
			TickLength:          2 * time.Second,
			AffectedByCastSpeed: false,
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := affliction.CalcScalingSpellDmg(hauntScale)
			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			affliction.SoulShards.Spend(sim, 1, spell.ActionID)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
				if result.Landed() {
					spell.Dot(target).Apply(sim)
				}
			})
		},
	})
}

func hauntDamageDoneByCasterHandler(sim *core.Simulation, spell *core.Spell, attackTable *core.AttackTable) float64 {
	if spell.Matches(warlock.WarlockSpellSeedOfCorruption |
		warlock.WarlockSpellCorruption |
		warlock.WarlockSpellDrainLife |
		warlock.WarlockSpellDrainSoul |
		warlock.WarlockSpellMaleficGrasp |
		warlock.WarlockSpellAgony |
		warlock.WarlockSpellUnstableAffliction) {
		return 1.35
	}

	return 1
}
