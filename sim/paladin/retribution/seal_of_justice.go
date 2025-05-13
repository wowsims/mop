package retribution

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/paladin"
)

func (ret *RetributionPaladin) registerSealOfJustice() {
	// Seal of Justice on-hit proc
	onSpecialOrSwingProc := ret.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 20170},
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskMeleeProc,
		Flags:          core.SpellFlagMeleeMetrics,
		ClassSpellMask: paladin.SpellMaskSealOfJustice,

		DamageMultiplier: 1,
		CritMultiplier:   ret.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := ret.GetMHWeapon().SwingSpeed *
				(0.01*spell.SpellPower() + 0.005*spell.MeleeAttackPower())

			// can't miss if melee swing landed, but can crit
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialCritOnly)
		},
	})

	ret.SealOfJusticeAura = ret.RegisterAura(core.Aura{
		Label:    "Seal of Justice" + ret.Label,
		Tag:      "Seal",
		ActionID: core.ActionID{SpellID: 20164},
		Duration: core.NeverExpires,

		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			// Don't proc on misses
			if !result.Landed() {
				return
			}

			// SoJ only procs on white hits, CS, TV and HoW
			if spell.ProcMask&core.ProcMaskMeleeWhiteHit == 0 &&
				spell.ClassSpellMask&paladin.SpellMaskCanTriggerSealOfJustice == 0 {
				return
			}

			onSpecialOrSwingProc.Cast(sim, result.Target)
		},
	})

	// Seal of Justice self-buff.
	ret.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 20164},
		SpellSchool: core.SpellSchoolHoly,
		ProcMask:    core.ProcMaskEmpty,
		Flags:       core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 16.4,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDMin,
			},
			IgnoreHaste: true,
		},

		ThreatMultiplier: 0,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			if ret.CurrentSeal != nil {
				ret.CurrentSeal.Deactivate(sim)
			}
			ret.CurrentSeal = ret.SealOfJusticeAura
			ret.CurrentSeal.Activate(sim)
		},
	})
}
