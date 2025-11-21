package feral

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

// 2025-07-01 - Savage Roar’s damage increase increased to 45% (was 40%).
// 2025-11-13 - Savage Roar’s damage increase decreased to 40% (was 45%).
// 2025-11-20 - Savage Roar’s damage increase increased to 43% (was 40%).
const SavageRoarMultiplier = 1.43

func (cat *FeralDruid) registerSavageRoarSpell() {
	isGlyphed := cat.HasMajorGlyph(proto.DruidMajorGlyph_GlyphOfSavagery)

	cat.SavageRoarDurationTable = [6]time.Duration{
		core.TernaryDuration(isGlyphed, time.Second*12, 0),
		time.Second * 18,
		time.Second * 24,
		time.Second * 30,
		time.Second * 36,
		time.Second * 42,
	}

	cat.SavageRoar = cat.RegisterSpell(druid.Cat, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 52610},
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: druid.DruidSpellSavageRoar,

		EnergyCost: core.EnergyCostOptions{
			Cost: 25,
		},

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Second,
			},

			IgnoreHaste: true,
		},

		ExtraCastCondition: func(_ *core.Simulation, _ *core.Unit) bool {
			return isGlyphed || (cat.ComboPoints() > 0)
		},

		// Despite being a self-buff, MoP SR maintains a hidden 3s tick
		// timer with a Pandemic effect that grants extra duration to
		// clipped refreshes based on the time until the next "tick". As
		// a result, in a vacuum, it is optimal to execute Roar clips
		// immediately *after* one of these hidden ticks in order to
		// maximize the duration increase granted by Pandemic. In order
		// to explore optimizations along these lines in the sim, we
		// will register the SR buff as a "HoT" whose ticks can be
		// tracked during rotation evaluations. This replicates the
		// functionality of in-game WeakAuras that track the tick timer.
		Hot: core.DotConfig{
			SelfOnly: true,

			Aura: core.Aura{
				Label: "Savage Roar",

				OnGain: func(_ *core.Aura, _ *core.Simulation) {
					cat.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexPhysical] *= SavageRoarMultiplier
				},

				OnExpire: func(_ *core.Aura, _ *core.Simulation) {
					if cat.InForm(druid.Cat) {
						cat.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexPhysical] /= SavageRoarMultiplier
					}
				},

				// https://us.forums.blizzard.com/en/wow/t/mists-of-pandaria-classic-development-notes-updated-july-1/2097329/14
				OnEncounterStart: func(aura *core.Aura, sim *core.Simulation) {
					if !aura.IsActive() {
						return
					}

					if !isGlyphed {
						aura.Deactivate(sim)
					} else if aura.RemainingDuration(sim) > time.Second*12 {
						aura.UpdateExpires(sim.CurrentTime + time.Second*12)
					}
				},
			},

			NumberOfTicks: 4, // Placeholder, update on each cast
			TickLength:    time.Second * 3,

			OnTick: func(sim *core.Simulation, _ *core.Unit, dot *core.Dot) {
				dot.Spell.CalcAndDealPeriodicHealing(sim, &cat.Unit, 0, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			hot := spell.SelfHot()
			hot.BaseTickCount = int32(cat.SavageRoarDurationTable[cat.ComboPoints()] / hot.BaseTickLength)
			hot.Apply(sim)
			cat.SpendComboPoints(sim, spell.ComboPointMetrics())
		},
	})

	cat.SavageRoarBuff = cat.SavageRoar.SelfHot()

	// Buff stays up but damage multiplier does not when leaving Cat Form
	cat.CatFormAura.ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
		if cat.SavageRoarBuff.IsActive() {
			cat.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexPhysical] /= SavageRoarMultiplier
		}
	})

	cat.CatFormAura.ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
		if cat.SavageRoarBuff.IsActive() {
			cat.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexPhysical] *= SavageRoarMultiplier
		}
	})
}

func (cat *FeralDruid) CurrentSavageRoarCost() float64 {
	return cat.SavageRoar.Cost.GetCurrentCost()
}
