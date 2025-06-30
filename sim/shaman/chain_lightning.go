package shaman

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func (shaman *Shaman) registerChainLightningSpell() {
	maxHits := min(core.TernaryInt32(shaman.HasMajorGlyph(proto.ShamanMajorGlyph_GlyphOfChainLightning), 5, 3), shaman.Env.TotalTargetCount())
	shaman.ChainLightning = shaman.newChainLightningSpell(false)
	shaman.ChainLightningOverloads = [2][]*core.Spell{}
	for range maxHits {
		shaman.ChainLightningOverloads[0] = append(shaman.ChainLightningOverloads[0], shaman.newChainLightningSpell(true))
		shaman.ChainLightningOverloads[1] = append(shaman.ChainLightningOverloads[1], shaman.newChainLightningSpell(true)) // overload echo
	}
}

func (shaman *Shaman) NewChainSpellConfig(config ShamSpellConfig) core.SpellConfig {
	config.BaseCastTime = time.Second * 2
	spellConfig := shaman.newElectricSpellConfig(config)
	spellConfig.ClassSpellMask = core.TernaryInt64(config.IsElementalOverload, SpellMaskChainLightningOverload, SpellMaskChainLightning)
	if !config.IsElementalOverload {
		spellConfig.Cast.CD = core.Cooldown{
			Timer:    shaman.NewTimer(),
			Duration: time.Second * 3,
		}
	}
	spellConfig.SpellSchool = config.SpellSchool

	maxHits := int32(3)
	if shaman.HasMajorGlyph(proto.ShamanMajorGlyph_GlyphOfChainLightning) {
		maxHits += 2
	}
	maxHits = min(maxHits, shaman.Env.TotalTargetCount())

	spellConfig.ApplyEffects = func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		curTarget := target

		// Damage calculation and DealDamage are in separate loops so that e.g. a spell power proc
		// can't proc on the first target and apply to the second
		numHits := min(maxHits, shaman.Env.ActiveTargetCount())
		results := make([]*core.SpellResult, numHits)
		for hitIndex := int32(0); hitIndex < numHits; hitIndex++ {
			baseDamage := shaman.CalcAndRollDamageRange(sim, config.Coeff, config.Variance)
			results[hitIndex] = shaman.calcDamageStormstrikeCritChance(sim, curTarget, baseDamage, spell)

			curTarget = sim.Environment.NextActiveTargetUnit(curTarget)
			spell.DamageMultiplier *= config.BounceReduction
		}

		idx := core.TernaryInt32(spell.Flags.Matches(SpellFlagIsEcho), 1, 0)
		for hitIndex := range numHits {
			if !config.IsElementalOverload && results[hitIndex].Landed() && sim.Proc(shaman.GetOverloadChance()/3, "Chain Lightning Elemental Overload") {
				(*config.Overloads)[idx][hitIndex].Cast(sim, results[hitIndex].Target)
			}
			spell.DealDamage(sim, results[hitIndex])
			spell.DamageMultiplier /= config.BounceReduction
		}
	}
	return spellConfig
}

func (shaman *Shaman) newChainLightningSpell(isElementalOverload bool) *core.Spell {
	shamConfig := ShamSpellConfig{
		ActionID:            core.ActionID{SpellID: 421},
		IsElementalOverload: isElementalOverload,
		BaseCostPercent:     30.5,
		BonusCoefficient:    0.51800000668,
		Coeff:               0.98900002241,
		Variance:            0.13300000131,
		SpellSchool:         core.SpellSchoolNature,
		Overloads:           &shaman.ChainLightningOverloads,
		BounceReduction:     1.0,
	}
	spellConfig := shaman.NewChainSpellConfig(shamConfig)

	return shaman.RegisterSpell(spellConfig)
}
