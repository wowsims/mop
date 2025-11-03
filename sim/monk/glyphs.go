package monk

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (monk *Monk) applyGlyphs() {
	if monk.HasMajorGlyph(proto.MonkMajorGlyph_GlyphOfFistsOfFury) {
		monk.registerGlyphOfFistsOfFury()
	}

	if monk.HasMajorGlyph(proto.MonkMajorGlyph_GlyphOfFortuitousSpheres) {
		monk.registerGlyphOfFortuitousSpheres()
	}
}

func (monk *Monk) registerGlyphOfFistsOfFury() {
	parryBuff := monk.RegisterAura(core.Aura{
		Label:    "Glyph of Fists of Fury" + monk.Label,
		ActionID: core.ActionID{SpellID: 125671},
	}).AttachAdditivePseudoStatBuff(&monk.PseudoStats.BaseParryChance, 1)

	monk.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Glyph of Fists of Fury Trigger" + monk.Label,
		ClassSpellMask:     MonkSpellFistsOfFury,
		Callback:           core.CallbackOnCastComplete,
		SpellFlags:         SpellFlagSpender,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			parryBuff.Duration = spell.AOEDot().RemainingDuration(sim)
			parryBuff.Activate(sim)
		},
	})
}

func (monk *Monk) registerGlyphOfFortuitousSpheres() {
	monk.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Glyph of Fortuitous Spheres" + monk.Label,
		ICD:                30 * time.Second,
		Outcome:            core.OutcomeLanded,
		Callback:           core.CallbackOnSpellHitTaken,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if result.Target.CurrentHealthPercent() < 0.25 {
				monk.SummonHealingSphere(sim)
			}
		},
	})
}
