package mage

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (mage *Mage) registerFrostMastery() {
	if mage.Spec != proto.Spec_SpecFrostMage {
		return
	}

	mage.Icicle = mage.RegisterSpell(core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 148022},
		SpellSchool:      core.SpellSchoolFrost,
		ProcMask:         core.ProcMaskSpellDamageProc, // Use SpellDamageProc to prevent triggering StormLash
		Flags:            core.SpellFlagPassiveSpell | core.SpellFlagNoOnCastComplete | core.SpellFlagNoSpellMods | core.SpellFlagIgnoreModifiers,
		ClassSpellMask:   MageSpellIcicle,
		MissileSpeed:     20,
		DamageMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcDamage(sim, target, 1, spell.OutcomeMagicHit)
			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},
	})

	mage.IciclesAura = core.BlockPrepull(mage.RegisterAura(core.Aura{
		Label:     "Mastery: Icicles",
		ActionID:  core.ActionID{SpellID: 148022},
		Duration:  time.Hour * 1,
		MaxStacks: 5,
	}))
}

func (mage *Mage) SpendIcicle(sim *core.Simulation, target *core.Unit, damage float64) {
	if !mage.IciclesAura.IsActive() || mage.IciclesAura.GetStacks() == 0 {
		return
	}
	mage.IciclesAura.RemoveStack(sim)

	mage.Icicle.DamageMultiplier *= damage
	mage.Icicle.Cast(sim, target)
	mage.Icicle.DamageMultiplier /= damage

	if mage.HasGlyphOfSplittingIce && mage.Env.ActiveTargetCount() > 1 {
		splitDamage := damage * 0.5
		mage.Icicle.DamageMultiplier *= splitDamage
		mage.Icicle.Cast(sim, mage.Env.NextActiveTargetUnit(target))
		mage.Icicle.DamageMultiplier /= splitDamage
	}
}

func (mage *Mage) GainIcicle(sim *core.Simulation, target *core.Unit, baseDamage float64) {
	numIcicles := int32(len(mage.Icicles))

	if numIcicles == mage.IciclesAura.MaxStacks {
		mage.SpendIcicle(sim, target, mage.Icicles[0])
		mage.Icicles = mage.Icicles[1:]
	}
	mage.Icicles = append(mage.Icicles, baseDamage*mage.GetFrostMasteryBonus())
	mage.IciclesAura.Activate(sim)
	mage.IciclesAura.AddStack(sim)
}
