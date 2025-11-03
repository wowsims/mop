package mage

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (mage *Mage) registerEvocation() {
	if mage.Talents.RuneOfPower {
		return
	}
	hasInvocation := mage.Talents.Invocation

	actionID := core.ActionID{SpellID: 12051}
	manaMetrics := mage.NewManaMetrics(actionID)
	manaPerTick := 0.0
	manaPercent := core.Ternary(mage.Spec == proto.Spec_SpecArcaneMage, .10, .15)
	manaRegenMulti := 1.0

	evocation := mage.GetOrRegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		Flags:          core.SpellFlagHelpful | core.SpellFlagChanneled | core.SpellFlagAPL,
		ClassSpellMask: MageSpellEvocation,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    mage.NewTimer(),
				Duration: time.Minute * 2,
			},
		},

		Hot: core.DotConfig{
			SelfOnly: true,
			Aura: core.Aura{
				Label: "Evocation",
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					if hasInvocation {
						mage.InvocationAura.Activate(sim)
					}
					if mage.ArcaneChargesAura != nil && mage.ArcaneChargesAura.IsActive() {
						mage.ArcaneChargesAura.Deactivate(sim)
					}
				},
			},
			NumberOfTicks:        3,
			TickLength:           time.Second * 2,
			AffectedByCastSpeed:  true,
			HasteReducesDuration: true,

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				mage.AddMana(sim, manaPerTick*manaRegenMulti, manaMetrics)
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			manaPerTick = mage.MaxMana() * manaPercent
			manaRegenMulti = mage.TotalSpellHasteMultiplier()
			if mage.RuneOfPowerAura.IsActive() {
				manaRegenMulti *= 1.75
			}
			if mage.ArcaneChargesAura != nil && mage.ArcaneChargesAura.IsActive() {
				stacks := float64(mage.ArcaneChargesAura.GetStacks())
				// Base: 25% mana regen per charge
				baseManaRegenTotal := 0.25 * stacks

				// T15 4PC increases the effect by 5% per charge
				// At 1 charge: +5%, at 2 charges: +10%, at 3 charges: +15%, at 4 charges: +20%
				if mage.T15_4PC_ArcaneChargesAura != nil && mage.T15_4PC_ArcaneChargesAura.IsActive() && stacks > 0 {
					t15BonusPercent := 0.05 * stacks
					baseManaRegenTotal *= (1.0 + t15BonusPercent)
				}

				manaRegenMulti *= 1 + baseManaRegenTotal
			}
			spell.SelfHot().Apply(sim)
			spell.SelfHot().TickOnce(sim)
		},
	})

	mage.AddMajorCooldown(core.MajorCooldown{
		Spell: evocation,
		Type:  core.CooldownTypeDPS,
		ShouldActivate: func(sim *core.Simulation, character *core.Character) bool {
			if mage.InvocationAura.TimeActive(sim) >= time.Duration(time.Second*55) {
				return true
			}
			return !mage.InvocationAura.IsActive()
		},
	})
}
