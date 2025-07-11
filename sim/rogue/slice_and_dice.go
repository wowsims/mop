package rogue

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (rogue *Rogue) registerSliceAndDice() {
	actionID := core.ActionID{SpellID: 5171}
	energyMetrics := rogue.NewEnergyMetrics(core.ActionID{SpellID: 79152})
	isSubtlety := rogue.Spec == proto.Spec_SpecSubtletyRogue

	rogue.SliceAndDiceBonusFlat = 0.4
	rogue.sliceAndDiceDurations = [6]time.Duration{
		0,
		time.Duration(time.Second * 12),
		time.Duration(time.Second * 18),
		time.Duration(time.Second * 24),
		time.Duration(time.Second * 30),
		time.Duration(time.Second * 36),
	}

	getDuration := func(comboPoints int32) time.Duration {
		duration := rogue.sliceAndDiceDurations[comboPoints]
		if rogue.Has2PT15 {
			duration += time.Second * 6
		}

		return duration
	}

	refreshHot := func(sim *core.Simulation, comboPoints int32) {
		hot := rogue.SliceAndDice.Hot(&rogue.Unit)
		hot.Duration = rogue.SliceAndDiceAura.Duration
		hot.BaseTickCount = 3 + 3*comboPoints
		hot.Activate(sim)
	}

	var slideAndDiceMod float64
	rogue.SliceAndDiceAura = rogue.RegisterAura(core.Aura{
		Label:    "Slice and Dice",
		ActionID: actionID,
		// This will be overridden on cast, but set a non-zero default so it doesn't crash when used in APL prepull
		Duration: rogue.sliceAndDiceDurations[5],
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			masteryBonus := core.TernaryFloat64(isSubtlety, rogue.GetMasteryBonus(), 0)
			slideAndDiceMod = 1 + rogue.SliceAndDiceBonusFlat*(1+masteryBonus)
			rogue.MultiplyMeleeSpeed(sim, slideAndDiceMod)
			if sim.Log != nil {
				rogue.Log(sim, "[DEBUG]: Slice and Dice attack speed mod: %v", slideAndDiceMod)
			}
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			rogue.MultiplyMeleeSpeed(sim, 1/slideAndDiceMod)
		},
		OnEncounterStart: func(aura *core.Aura, sim *core.Simulation) {
			if isSubtlety && !rogue.Premeditation.CD.IsReady(sim) && aura.IsActive() {
				aura.Deactivate(sim)
				cp := int32(2)
				aura.Duration = getDuration(cp)
				aura.Activate(sim)
				refreshHot(sim, cp)
				rogue.ResetComboPoints(sim, 0)
			} else {
				aura.Deactivate(sim)
			}
		},
	})

	rogue.SliceAndDice = rogue.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		Flags:          SpellFlagFinisher | core.SpellFlagAPL,
		MetricSplits:   6,
		ClassSpellMask: RogueSpellSliceAndDice,

		EnergyCost: core.EnergyCostOptions{
			Cost: 25,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:    time.Second,
				GCDMin: time.Millisecond * 500,
			},
			IgnoreHaste: true,
			ModifyCast: func(sim *core.Simulation, spell *core.Spell, cast *core.Cast) {
				spell.SetMetricsSplit(rogue.ComboPoints())
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return rogue.ComboPoints() > 0
		},
		Hot: core.DotConfig{ // Subtlety SnD restores 8 energy every 2 seconds; functions like a HoT w/ pandemic window
			Aura: core.Aura{
				Label:    "Slice and Dice",
				Duration: rogue.sliceAndDiceDurations[5],
				ActionID: core.ActionID{SpellID: 79152},
			},
			NumberOfTicks:       0,
			TickLength:          time.Second * 2,
			AffectedByCastSpeed: false,
			BonusCoefficient:    1,
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				if isSubtlety {
					rogue.AddEnergy(sim, 8, energyMetrics)
				}
				// Do something just to give us a tick line
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTickHealingCrit)
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			comboPoints := rogue.ComboPoints()
			rogue.ApplyFinisher(sim, spell)
			spell.RelatedSelfBuff.Deactivate(sim)
			spell.RelatedSelfBuff.Duration = getDuration(comboPoints)
			spell.RelatedSelfBuff.Activate(sim)

			if isSubtlety {
				refreshHot(sim, comboPoints)
			}
		},

		RelatedSelfBuff: rogue.SliceAndDiceAura,
	})
}
