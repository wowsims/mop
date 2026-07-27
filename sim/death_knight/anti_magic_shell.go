package death_knight

import (
	"time"

	"github.com/wowsims/mop/sim/core/proto"

	"github.com/wowsims/mop/sim/core"
)

/*
Surrounds the Death Knight in an Anti-Magic Shell, absorbing 75% of damage dealt by harmful spells (up to a maximum of 50% of the Death Knight's health) and preventing application of harmful magical effects.
Damage absorbed generates Runic Power.
Lasts 5 sec.
*/
func (dk *DeathKnight) registerAntiMagicShell() {
	actionID := core.ActionID{SpellID: 48707}

	runicPowerMetrics := dk.NewRunicPowerMetrics(core.ActionID{SpellID: 49088})
	currentShield := 0.0
	damageReductionMultiplier := 0.75
	hasRegenerativeMagic := dk.HasMajorGlyph(proto.DeathKnightMajorGlyph_GlyphOfRegenerativeMagic)

	if dk.HasMajorGlyph(proto.DeathKnightMajorGlyph_GlyphOfAntiMagicShell) {
		damageReductionMultiplier += 0.25
	}

	// Simulated incoming magic damage, used to model the Runic Power gained from
	// absorbing spells while the shell is up. targetDummySpell is a metrics-free
	// vehicle (registered lazily on the current target on first use) whose damage
	// flows through the normal absorption -> OnDamageAbsorbed -> AddRunicPower path,
	// so RP generation reuses the already-correct formula.
	var targetDummySpell *core.Spell

	var antiMagicShellSpell *core.Spell
	var antiMagicShellAura *core.DamageAbsorptionAura
	antiMagicShellAura = dk.NewDamageAbsorptionAura(core.AbsorptionAuraConfig{
		Aura: core.Aura{
			Label:    "Anti-Magic Shell" + dk.Label,
			ActionID: actionID,
			Duration: time.Second * 5,
			OnGain: func(aura *core.Aura, sim *core.Simulation) {
				// Only model incoming damage when the user has configured an average
				// AMS hit. The option exists for Frost/Unholy only, so this also keeps
				// the simulated self-damage out of the Blood (tank) sim.
				if dk.Inputs.AvgAMSHit <= 0 {
					return
				}

				if targetDummySpell == nil && dk.CurrentTarget != nil {
					targetDummySpell = dk.CurrentTarget.RegisterSpell(core.SpellConfig{
						ActionID:         core.ActionID{SpellID: 49375},
						SpellSchool:      core.SpellSchoolChaos,
						ProcMask:         core.ProcMaskSpellDamage,
						Flags:            core.SpellFlagNoOnCastComplete | core.SpellFlagNoMetrics,
						DamageMultiplier: 1,

						ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
							baseDamage := dk.Inputs.AvgAMSHit * sim.Roll(0.9, 1.1)
							spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeAlwaysHit)
						},
					})
				}

				if targetDummySpell == nil {
					return
				}

				numTicks := max(dk.Inputs.AMSNumTicks, 1)
				scheduleTick := func(at time.Duration) {
					pa := sim.GetConsumedPendingActionFromPool()
					pa.Priority = core.ActionPriorityAuto
					pa.NextActionAt = at
					pa.OnAction = func(sim *core.Simulation) {
						if !aura.IsActive() {
							return
						}

						if sim.RandomFloat("AMS Trigger Chance") < min(dk.Inputs.AvgAMSSuccessRate, 1.0) {
							targetDummySpell.Cast(sim, aura.Unit)
						}
					}
					sim.AddPendingAction(pa)
				}

				if numTicks == 1 {
					scheduleTick(sim.CurrentTime + time.Duration(sim.RandomFloat("AMS Induced Damage")*float64(aura.Duration)))
				} else {
					for i := range numTicks {
						scheduleTick(sim.CurrentTime + antiMagicShellTickOffset(aura.Duration, i, numTicks))
					}
				}
			},
			OnExpire: func(aura *core.Aura, sim *core.Simulation) {
				// Glyph of Regenerative Magic: a depleted shield Deactivate()s early with
				// ShieldStrength <= 0, so ShieldStrength > 0 here means AMS reached its full
				// duration with shield left. Reduce the *remaining* cooldown by up to 50%,
				// scaled by the fraction of shield remaining. Reducing the remaining cooldown
				// (rather than a flat number of seconds) makes it compose with cooldown-recovery
				// trinkets. Verified vs WCL KXBHYQLWj6hDr8mb.
				if hasRegenerativeMagic && antiMagicShellAura.ShieldStrength > 0 {
					remainingFraction := antiMagicShellAura.ShieldStrength / currentShield
					antiMagicShellSpell.CD.Reduce(time.Duration(0.5 * remainingFraction * float64(antiMagicShellSpell.CD.TimeToReady(sim))))
				}
			},
		},

		DamageMultiplier: damageReductionMultiplier,

		OnDamageAbsorbed: func(sim *core.Simulation, aura *core.DamageAbsorptionAura, result *core.SpellResult, absorbedDamage float64) {
			// result.Damage has already had absorbedDamage subtracted, so it holds the
			// leftover AMS did not absorb. RP is based on the total damage AMS was exposed
			// to (absorbed + leftover).
			dk.AddRunicPower(sim, antiMagicShellRunicPower(absorbedDamage, result.Damage), runicPowerMetrics)
		},
		ShouldApplyToResult: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult, isPeriodic bool) bool {
			return !spell.SpellSchool.Matches(core.SpellSchoolPhysical)
		},
		ShieldStrengthCalculator: func(unit *core.Unit) float64 {
			return currentShield
		},
	})

	antiMagicShellSpell = dk.RegisterSpell(core.SpellConfig{
		ActionID:    actionID,
		ProcMask:    core.ProcMaskSpellHealing,
		SpellSchool: core.SpellSchoolShadow,
		Flags:       core.SpellFlagAPL | core.SpellFlagHelpful | core.SpellFlagReadinessTrinket,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    dk.NewTimer(),
				Duration: time.Second * 45,
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			currentShield = dk.MaxHealth() * 0.5
			antiMagicShellAura.Activate(sim)
		},
	})

	// Autocast the shell as a low-priority DPS cooldown, cast through the
	// autocastOtherCooldowns action present in every DPS preset. Registered whenever the user
	// has configured damage-intake modeling (AvgAMSHit > 0, the pre-existing opt-in), OR
	// whenever the encounter has a real-boss-AI target (see antiMagicShellReactiveSignal) --
	// the latter needs AMS to autocast reactively even when the user has correctly left
	// AvgAMSHit at 0 for those encounters (real damage happens instead of simulated damage, so
	// the stat is otherwise meaningless there). core.AddMajorCooldown has real side effects
	// beyond just enabling ShouldActivate: it unconditionally ORs SpellFlagMCD onto the spell
	// (sim/core/major_cooldown.go), which measurably changed Blood's golden-output tests even
	// with ShouldActivate always returning false -- so this must stay a real conditional
	// registration, not "always register but never activate."
	if dk.Inputs.AvgAMSHit > 0 || dk.encounterHasRealBossAI() {
		dk.AddMajorCooldown(core.MajorCooldown{
			Spell:    antiMagicShellSpell,
			Type:     core.CooldownTypeDPS,
			Priority: core.CooldownPriorityLow,

			// ShouldActivate is ONLY consulted by getFirstReadyMCD, which only the
			// "Autocast Other Cooldowns" APL action calls (see
			// APLActionAutocastOtherCooldowns.IsReady in apl_actions_casting.go). A
			// manual "Cast Spell" action targeting this spell elsewhere in the APL
			// goes through APLActionCastSpell.IsReady instead, which never looks at
			// ShouldActivate — so a user-authored restriction on Anti-Magic Shell
			// always takes priority over this.
			ShouldActivate: func(sim *core.Simulation, character *core.Character) bool {
				if imminent, handled := antiMagicShellReactiveSignal(sim); handled {
					return imminent
				}
				return dk.Inputs.AvgAMSHit > 0
			},
		})
	}
}

// encounterHasRealBossAI reports whether any target in the current encounter implements
// core.ImminentMagicAbilityProvider (see sim/core/imminent_ability.go and the real-boss-AI
// files in sim/encounters/soo/*_ai.go). Safe to call from Character.Initialize(): target
// construction (which sets each Target's AI field) and target.initialize() both run before the
// player-initialize loop in Environment.initialize(), so every target's AI is already a
// concrete, type-assertable value by this point.
func (dk *DeathKnight) encounterHasRealBossAI() bool {
	for _, target := range dk.Env.Encounter.AllTargets {
		if _, ok := target.AI.(core.ImminentMagicAbilityProvider); ok {
			return true
		}
	}
	return false
}

// antiMagicShellReactionWindow is how far ahead of a boss's own next likely cast (or how far
// into an already-started real telegraph) AMS should be proactively cast, giving the shell's own
// activation plus normal reaction latency room to land before the incoming hit actually resolves.
const antiMagicShellReactionWindow = 2 * time.Second

// antiMagicShellReactiveSignal checks every active encounter target for
// core.ImminentMagicAbilityProvider (implemented by the real WCL-data-driven boss AI files in
// sim/encounters/soo/*_ai.go) and reports whether AMS should be cast right now because at least
// one target has a harmful magic ability imminent. handled reports whether ANY target in the
// encounter implements the interface at all: if none do (i.e. this isn't one of the real-boss-AI
// encounters), the caller should fall back to the old heuristic instead of treating "no reactive
// signal" as "never cast."
func antiMagicShellReactiveSignal(sim *core.Simulation) (imminent bool, handled bool) {
	for _, target := range sim.Encounter.ActiveTargets {
		provider, ok := target.AI.(core.ImminentMagicAbilityProvider)
		if !ok {
			continue
		}
		handled = true
		if provider.HasImminentMagicAbility(sim, antiMagicShellReactionWindow) {
			return true, true
		}
	}
	return false, handled
}

// antiMagicShellTickOffset returns how far into the shell's window tick i (0-indexed) of
// numTicks lands when the simulated hits are spread evenly across it: tick i fires at
// (i+0.5) * window/numTicks. This centres the hits in equal sub-intervals, so e.g. 5 ticks
// over a 5s window land at 0.5/1.5/2.5/3.5/4.5s and the last always falls before expiry.
// Only used for numTicks >= 2; a single tick is placed at a random time by the caller.
func antiMagicShellTickOffset(window time.Duration, i, numTicks int32) time.Duration {
	return time.Duration((float64(i) + 0.5) * float64(window) / float64(numTicks))
}

// antiMagicShellRunicPowerCoefficient is the base Runic Power generated per point of
// magic damage Anti-Magic Shell is exposed to. Derived empirically from MoP-Classic WCL
// logs (flat, independent of max health and of the absorb percentage).
const antiMagicShellRunicPowerCoefficient = 0.0007

// antiMagicShellRunicPower returns the base Runic Power Anti-Magic Shell generates from a
// single absorbed hit. RP is based on the magic damage AMS was exposed to before its own
// reduction, i.e. the amount it absorbed plus any leftover it could not absorb when the
// shield caps mid-hit. Frost Presence's +20% is applied by AddRunicPower (runic-regen
// multiplier), not here.
func antiMagicShellRunicPower(absorbedDamage, leftoverDamage float64) float64 {
	return (absorbedDamage + leftoverDamage) * antiMagicShellRunicPowerCoefficient
}
