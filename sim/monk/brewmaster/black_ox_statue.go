package brewmaster

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
)

/*
Summon Black Ox Statue (115315)
Summons a Black Ox Statue for the fight, applying Sanctuary of the Ox (126119) to the Monk.
Modelled as a permanent aura since the statue is kept up for the whole encounter.

Sanctuary of the Ox (126119):
Every time you deal (Attack Power * 16) damage, the Black Ox Statue casts Guard on a nearby
injured ally, absorbing [(Attack Power * 1.971) + base] damage for 30 sec.

The statue's Guard lands on allies, so it has no effect in a single-player sim. It is still
tracked because the T16 Brewmaster 2P bonus grants the Monk a self-Guard (Protection of Niuzao,
145051) equal to 8% of each statue Guard.
*/
func (bm *BrewmasterMonk) registerBlackOxStatue() {
	// Statue Guard uses the same absorb formula as the Monk's own Guard, without the
	// player-only modifiers (glyph, Power Guard, T14 4P).
	statueGuardAmount := func() float64 {
		return bm.GetStat(stats.AttackPower)*1.971 + bm.CalcScalingSpellDmg(13)
	}

	// T16 Brewmaster 2P: self-Guard equal to 8% of each statue Guard.
	var protectionOfNiuzao *core.DamageAbsorptionAura
	if bm.T16Brewmaster2P != nil {
		spellSchool := core.SpellSchoolPhysical | core.SpellSchoolArcane | core.SpellSchoolFire |
			core.SpellSchoolFrost | core.SpellSchoolHoly | core.SpellSchoolNature | core.SpellSchoolShadow

		protectionOfNiuzao = bm.NewDamageAbsorptionAura(core.AbsorptionAuraConfig{
			Aura: core.Aura{
				Label:    "Protection of Niuzao" + bm.Label,
				ActionID: core.ActionID{SpellID: 145051},
				Duration: 30 * time.Second,
			},
			ShouldApplyToResult: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult, isPeriodic bool) bool {
				return spell.SpellSchool.Matches(spellSchool)
			},
			ShieldStrengthCalculator: func(_ *core.Unit) float64 {
				return 0.08 * statueGuardAmount()
			},
		})
	}

	sanctuary := core.MakePermanent(bm.RegisterAura(core.Aura{
		Label:    "Sanctuary of the Ox" + bm.Label,
		ActionID: core.ActionID{SpellID: 126119},
	}))

	accumulatedDamage := 0.0
	sanctuary.AttachProcTrigger(core.ProcTrigger{
		Name:               "Sanctuary of the Ox" + bm.Label,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		RequireDamageDealt: true,
		TriggerImmediately: true,
		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			accumulatedDamage += result.Damage
			threshold := spell.MeleeAttackPower() * 16
			if threshold <= 0 {
				return
			}

			for accumulatedDamage >= threshold {
				accumulatedDamage -= threshold
				// The statue casts Guard on an injured ally (no self effect); the T16 2P
				// bonus mirrors 8% of it onto the Monk.
				if protectionOfNiuzao != nil {
					protectionOfNiuzao.Activate(sim)
				}
			}
		},
	})

	bm.RegisterResetEffect(func(_ *core.Simulation) {
		accumulatedDamage = 0
	})
}
