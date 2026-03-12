package balance

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/druid"
)

func (moonkin *BalanceDruid) registerCelestialAlignmentSpell() {
	actionID := core.ActionID{SpellID: 112071}

	celestialAlignmentAura := moonkin.RegisterAura(core.Aura{
		Label:    "Celestial Alignment",
		ActionID: actionID,
		Duration: time.Second * 15,
		OnGain: func(_ *core.Aura, sim *core.Simulation) {
			moonkin.SuspendEclipseBar(sim)

			moonkin.NaturesGrace.Deactivate(sim)
			moonkin.NaturesGrace.Activate(sim)
			moonkin.Starfall.CD.Reset()
			moonkin.AddMana(sim, moonkin.MaxMana()*0.5, moonkin.ManaMetric)

			eclipseMasteryBonus := calculateEclipseMasteryBonus(moonkin.GetMasteryPoints(), true)

			if moonkin.DreamOfCenarius.IsActive() {
				eclipseMasteryBonus += 0.25
				moonkin.DreamOfCenarius.Deactivate(sim)
			}

			moonkin.CelestialAlignmentSpellMod.UpdateFloatValue(eclipseMasteryBonus)
			moonkin.CelestialAlignmentSpellMod.Activate()

			if moonkin.ChosenOfElune != nil && moonkin.ChosenOfElune.RelatedSelfBuff.IsActive() {
				moonkin.IncarnationSpellMod.Activate()
			}
		},
		OnExpire: func(_ *core.Aura, sim *core.Simulation) {
			moonkin.CelestialAlignmentSpellMod.Deactivate()
			// Restore previous eclipse gain mask
			moonkin.RestoreEclipseBar()
		},
		OnSpellHitDealt: func(_ *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(druid.DruidSpellMoonfire) {
				moonkin.Sunfire.Dot(result.Target).Apply(sim)
			}

			if spell.Matches(druid.DruidSpellSunfire) {
				moonkin.Moonfire.Dot(result.Target).Apply(sim)
			}
		},
	})

	moonkin.CelestialAlignment = moonkin.RegisterSpell(druid.Humanoid|druid.Moonkin, core.SpellConfig{
		ActionID:        actionID,
		SpellSchool:     core.SpellSchoolArcane,
		Flags:           core.SpellFlagAPL,
		RelatedSelfBuff: celestialAlignmentAura,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: 0,
			},
			CD: core.Cooldown{
				Timer:    moonkin.NewTimer(),
				Duration: time.Minute * 3,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			spell.RelatedSelfBuff.Activate(sim)
		},
	})

	moonkin.AddMajorCooldown(core.MajorCooldown{
		Spell: moonkin.CelestialAlignment.Spell,
		Type:  core.CooldownTypeDPS,
	})
}
