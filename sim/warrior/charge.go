package warrior

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (war *Warrior) registerCharge() {
	isProtection := war.Spec == proto.Spec_SpecProtectionWarrior
	spellID := core.TernaryInt32(isProtection, 100, 1250619) // 2025-07-01 - Charge now grants 1 Rage per yard traveled up to 10 yards.
	actionID := core.ActionID{SpellID: spellID}
	metrics := war.NewRageMetrics(actionID)
	var chargeRageGenCD time.Duration

	hasRageGlyph := war.HasMajorGlyph(proto.WarriorMajorGlyph_GlyphOfBullRush)
	hasRangeGlyph := war.HasMajorGlyph(proto.WarriorMajorGlyph_GlyphOfLongCharge)

	chargeRageGain := core.TernaryFloat64(isProtection, 20, 10) + core.TernaryFloat64(hasRageGlyph, 15, 0) // 2025-07-01 - Charge now grants 10 Rage (was 20)
	chargeMinRange := core.MaxMeleeRange - 3.5
	chargeRange := 25 + core.TernaryFloat64(hasRangeGlyph, 5, 0)
	chargeDistanceRageGain := 0.0 // 2025-07-01 - Charge now grants 1 Rage per yard traveled up to 10 yards.

	aura := war.RegisterAura(core.Aura{
		Label:    "Charge",
		ActionID: actionID,
		Duration: 5 * time.Second,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			war.MultiplyMovementSpeed(sim, 3.0)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			war.MultiplyMovementSpeed(sim, 1.0/3.0)
		},
	})

	war.RegisterMovementCallback(func(sim *core.Simulation, position float64, kind core.MovementUpdateType) {
		if kind == core.MovementEnd && aura.IsActive() {
			aura.Deactivate(sim)
		}
	})

	war.RegisterResetEffect(func(sim *core.Simulation) {
		chargeRageGenCD = 0
		chargeDistanceRageGain = 0
	})

	war.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: SpellMaskCharge,
		MinRange:       core.TernaryFloat64(isProtection, 8, 0), // 2025-07-01 - Charge no longer has a minimum Range (was 8 yard minimum)
		MaxRange:       chargeRange,
		Charges:        core.TernaryInt(war.Talents.DoubleTime, 2, 0),
		RechargeTime:   core.TernaryDuration(war.Talents.DoubleTime, time.Second*20, 0),

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    war.NewTimer(),
				Duration: 20 * time.Second,
			},
			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			chargeDistanceRageGain = core.TernaryFloat64(isProtection, 0, core.Clamp(war.DistanceFromTarget-chargeMinRange, 0, 10)) // 2025-07-01 - Charge now grants 1 Rage per yard traveled up to 10 yards.
			aura.Activate(sim)
			if !war.Talents.DoubleTime || chargeRageGenCD == 0 || sim.CurrentTime-chargeRageGenCD >= 12*time.Second {
				chargeRageGenCD = sim.CurrentTime
				totalChargeRageGain := (chargeRageGain + chargeDistanceRageGain) * war.GetRageMultiplier(target)
				war.AddRage(sim, totalChargeRageGain, metrics)
				if sim.CurrentTime < 0 {
					war.PrePullChargeGain = totalChargeRageGain
				}
			}
			war.MoveTo(chargeMinRange, sim) // movement aura is discretized in 1 yard intervals, so need to overshoot to guarantee melee range
		},
	})
}
