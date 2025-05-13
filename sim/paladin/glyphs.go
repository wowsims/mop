package paladin

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (paladin *Paladin) applyGlyphs() {
	// Major glyphs
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfAvengingWrath) {
		registerGlyphOfAvengingWrath(paladin)
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfDivineProtection) {
		// Handled in divine_protection.go
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfDivineStorm) {
		registerGlyphOfDivineStorm(paladin)
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfDoubleJeopardy) {
		registerGlyphOfDoubleJeopardy(paladin)
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfFinalWrath) {
		// Handled in protection/holy_wrath.go
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfFocusedShield) {
		// TODO: Handle in protection/avengers_shield.go
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfHammerOfTheRighteous) {
		// TODO: Handle in protection/hammer_of_the_righteous.go
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfHarshWords) {
		// TODO: Handle in word_of_glory.go
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfImmediateTruth) {
		registerGlyphOfImmediateTruth(paladin)
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfMassExorcism) {
		// Handled in retribution/exorcism.go
	}
	if paladin.HasMajorGlyph(proto.PaladinMajorGlyph_GlyphOfTheAlabasterShield) {
		registerGlyphOfTheAlabasterShield(paladin)
	}

	// Minor glyphs
	if paladin.HasMinorGlyph(proto.PaladinMinorGlyph_GlyphOfFocusedWrath) {
		// Handled in protection/holy_wrath.go
	}
}

// While Avenging Wrath is active, you are healed for 1% of your maximum health every 2 sec.
func registerGlyphOfAvengingWrath(paladin *Paladin) {
	actionID := core.ActionID{SpellID: 115547}
	healthMetrics := paladin.NewHealthMetrics(actionID)
	glyphAura := paladin.RegisterAura(core.Aura{
		ActionID: actionID,
		Label:    "Glyph of Avenging Wrath" + paladin.Label,
		Duration: 20 * time.Second,

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			core.StartPeriodicAction(sim, core.PeriodicActionOptions{
				Period: time.Second * 2,
				OnAction: func(sim *core.Simulation) {
					paladin.GainHealth(sim, paladin.MaxHealth()*0.01, healthMetrics)
				},
			})
		},
	})

	paladin.AvengingWrathAura.ApplyOnInit(func(aura *core.Aura, sim *core.Simulation) {
		glyphAura.Duration = aura.Duration
	}).AttachDependentAura(glyphAura)
}

// Your Divine Storm also heals you for 5% of your maximum health.
func registerGlyphOfDivineStorm(paladin *Paladin) {
	healthMetrics := paladin.NewHealthMetrics(core.ActionID{SpellID: 115515})
	core.MakeProcTriggerAura(&paladin.Unit, core.ProcTrigger{
		Name:           "Glyph of Divine Storm" + paladin.Label,
		ActionID:       core.ActionID{SpellID: 63220},
		Callback:       core.CallbackOnCastComplete, // DS doesn't have to hit anything, it still heals
		ClassSpellMask: SpellMaskDivineStorm,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			paladin.GainHealth(sim, paladin.MaxHealth()*0.05, healthMetrics)
		},
	})
}

// Judging a target increases the damage of your next Judgment by 20%, but only if used on a second target.
func registerGlyphOfDoubleJeopardy(paladin *Paladin) {
	spellMod := paladin.AddDynamicMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  SpellMaskJudgment,
		FloatValue: 0.2,
	})

	var triggeredTarget *core.Unit
	doubleJeopardyAura := paladin.RegisterAura(core.Aura{
		Label:    "Glyph of Double Jeopardy" + paladin.Label,
		ActionID: core.ActionID{SpellID: 121027},
		Duration: time.Second * 10,

		OnApplyEffects: func(aura *core.Aura, sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if spell.Matches(SpellMaskJudgment) {
				aura.Deactivate(sim)

				if target != triggeredTarget {
					spellMod.Activate()
				}
			}
		},
		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(SpellMaskJudgment) {
				spellMod.Deactivate()
				aura.Deactivate(sim)
			}
		},
	})

	core.MakeProcTriggerAura(&paladin.Unit, core.ProcTrigger{
		Name:           "Glyph of Double Jeopardy Trigger" + paladin.Label,
		ActionID:       core.ActionID{SpellID: 54922},
		Callback:       core.CallbackOnSpellHitDealt,
		ClassSpellMask: SpellMaskJudgment,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(SpellMaskJudgment) && !doubleJeopardyAura.IsActive() {
				triggeredTarget = result.Target
				doubleJeopardyAura.Activate(sim)
			}
		},
	})
}

// Increases the instant damage done by Seal of Truth by 40%, but decreases the damage done by Censure by 50%.
func registerGlyphOfImmediateTruth(paladin *Paladin) {
	core.MakePermanent(paladin.RegisterAura(core.Aura{
		Label:    "Glyph of Immediate Truth" + paladin.Label,
		ActionID: core.ActionID{SpellID: 115546},
	})).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  SpellMaskSealOfTruth,
		FloatValue: 0.4,
	}).AttachSpellMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  SpellMaskCensure,
		FloatValue: -0.5,
	})
}

// Your successful blocks increase the damage of your next Shield of the Righteous by 10%. Stacks up to 3 times.
func registerGlyphOfTheAlabasterShield(paladin *Paladin) {
	spellMod := paladin.AddDynamicMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ClassMask:  SpellMaskShieldOfTheRighteous,
		FloatValue: 0.1,
	})

	alabasterShieldAura := paladin.RegisterAura(core.Aura{
		Label:     "Alabaster Shield" + paladin.Label,
		ActionID:  core.ActionID{SpellID: 121467},
		Duration:  time.Second * 12,
		MaxStacks: 3,
		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks, newStacks int32) {
			if newStacks > 0 {
				spellMod.UpdateFloatValue(0.1 * float64(newStacks))
				spellMod.Activate()
			} else {
				spellMod.Deactivate()
			}
		},
		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.Matches(SpellMaskShieldOfTheRighteous) {
				aura.Deactivate(sim)
			}
		},
	})

	core.MakeProcTriggerAura(&paladin.Unit, core.ProcTrigger{
		Name:     "Glyph of the Alabaster Shield" + paladin.Label,
		ActionID: core.ActionID{SpellID: 63222},
		Callback: core.CallbackOnSpellHitTaken,
		Outcome:  core.OutcomeBlock,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			alabasterShieldAura.Activate(sim)
			alabasterShieldAura.AddStack(sim)
		},
	})
}
