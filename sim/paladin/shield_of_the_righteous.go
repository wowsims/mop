package paladin

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (paladin *Paladin) registerShieldOfTheRighteous() {
	actionID := core.ActionID{SpellID: 53600}
	baseDamage := paladin.CalcScalingSpellDmg(0.73199999332)
	apCoef := 0.61699998379

	shieldOfTheRighteousAura := paladin.RegisterAura(core.Aura{
		ActionID: core.ActionID{SpellID: 132403},
		Label:    "Shield of the Righteous" + paladin.Label,
		Duration: time.Second * 3,
	}).AttachMultiplicativePseudoStatBuff(&paladin.PseudoStats.SchoolDamageTakenMultiplier[core.SpellSchoolPhysical], 0.75)

	paladin.ShieldOfTheRighteous = paladin.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolHoly,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskShieldOfTheRighteous,

		MaxRange: core.MaxMeleeRange,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    paladin.NewTimer(),
				Duration: time.Millisecond * 1500,
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return paladin.OffHand().WeaponType == proto.WeaponType_WeaponTypeShield && paladin.HolyPower.CanSpend(3)
		},

		DamageMultiplier: 1,
		CritMultiplier:   paladin.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			damage := baseDamage + apCoef*spell.MeleeAttackPower()

			result := spell.CalcDamage(sim, target, damage, spell.OutcomeMeleeSpecialHitAndCrit)

			if result.Landed() {
				paladin.HolyPower.Spend(3, actionID, sim)
			}

			// Buff should apply even if the spell misses/dodges/parries
			// It also extends on refresh
			if spell.RelatedSelfBuff.IsActive() {
				spell.RelatedSelfBuff.UpdateExpires(spell.RelatedSelfBuff.ExpiresAt() + spell.RelatedSelfBuff.Duration)
			} else {
				spell.RelatedSelfBuff.Activate(sim)
			}

			spell.DealOutcome(sim, result)
		},

		RelatedSelfBuff: shieldOfTheRighteousAura,
	})
}
