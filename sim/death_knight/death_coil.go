package death_knight

import (
	"github.com/wowsims/mop/sim/core"
)

var DeathCoilActionID = core.ActionID{SpellID: 47541}

/*
Fire a blast of unholy energy, causing (929 + <AP> * 0.514) Shadow damage to an enemy target or healing ((929 + <AP> * 0.514) * 3.5) damage on a friendly Undead target.

-- Glyph of Death's Embrace --

# Refunds 20 Runic Power when used to heal

-- /Glyph of Death's Embrace --
*/
func (dk *DeathKnight) registerDeathCoil() {
	dk.RegisterSpell(core.SpellConfig{
		ActionID:       DeathCoilActionID,
		SpellSchool:    core.SpellSchoolShadow,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL | core.SpellFlagEncounterOnly,
		ClassSpellMask: DeathKnightSpellDeathCoil,

		MaxRange: 30,

		RuneCost: core.RuneCostOptions{
			RunicPowerCost: 40,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDMin,
			},
		},

		DamageMultiplier: 1,
		CritMultiplier:   dk.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := dk.CalcScalingSpellDmg(0.74544) + spell.MeleeAttackPower()*0.514
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
		},
	})
}

func (dk *DeathKnight) registerDrwDeathCoil() *core.Spell {
	return dk.RuneWeapon.RegisterSpell(core.SpellConfig{
		ActionID:    DeathCoilActionID,
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellDamage,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := dk.CalcScalingSpellDmg(0.74544) + spell.MeleeAttackPower()*0.514
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
		},
	})
}
