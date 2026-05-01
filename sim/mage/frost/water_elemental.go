package frost

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/mage"
)

func (frost *FrostMage) registerSummonWaterElementalSpell() {

	frost.SummonWaterElemental = frost.RegisterSpell(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 31687},
		Flags:    core.SpellFlagNoOnCastComplete | core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 3,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: 1500 * time.Millisecond,
			},
			CD: core.Cooldown{
				Timer:    frost.NewTimer(),
				Duration: time.Minute * 1,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			frost.waterElemental.Enable(sim, frost.waterElemental)
		},
	})
}

type WaterElemental struct {
	core.Pet

	mageOwner *FrostMage

	Waterbolt *core.Spell
}

func (frost *FrostMage) NewWaterElemental() *WaterElemental {
	waterElementalStatInheritance := func(ownerStats stats.Stats) stats.Stats {
		// Water elemental usually has about half the HP of the caster, with glyph this is bumped by an additional 40%
		return stats.Stats{
			stats.Stamina:          ownerStats[stats.Stamina] * 0.5,
			stats.SpellPower:       ownerStats[stats.SpellPower],
			stats.HasteRating:      ownerStats[stats.HasteRating],
			stats.SpellCritPercent: ownerStats[stats.SpellCritPercent],
			// this (crit) needs to be tested more thoroughly when pet hit is not bugged
		}
	}

	waterElementalBaseStats := stats.Stats{
		// Mana seems to always be at 300k on beta
		stats.Mana: 300000,
	}

	waterElemental := &WaterElemental{
		Pet: core.NewPet(core.PetConfig{
			Name:                           "Water Elemental",
			Owner:                          &frost.Character,
			BaseStats:                      waterElementalBaseStats,
			NonHitExpStatInheritance:       waterElementalStatInheritance,
			HasDynamicCastSpeedInheritance: true,
			EnabledOnStart:                 true,
			IsGuardian:                     true,
		}),
		mageOwner: frost,
	}
	waterElemental.EnableManaBar()

	frost.AddPet(waterElemental)

	return waterElemental
}

func (we *WaterElemental) GetPet() *core.Pet {
	return &we.Pet
}

func (we *WaterElemental) Initialize() {
	we.registerWaterboltSpell()

	tier5TalentDamageValue := 0.0
	var tier5talentAura *core.Aura = nil
	if we.mageOwner.Talents.Invocation {
		tier5talentAura = we.mageOwner.InvocationAura
		tier5TalentDamageValue = 0.15
	} else if we.mageOwner.Talents.RuneOfPower {
		tier5talentAura = we.mageOwner.RuneOfPowerAura
		tier5TalentDamageValue = 0.15
	} else if we.mageOwner.Talents.IncantersWard {
		tier5talentAura = we.mageOwner.IncantersWardPassiveAura
		tier5TalentDamageValue = 0.06
	}

	if tier5talentAura != nil {
		tier5Talent5DamageMod := we.AddDynamicMod(core.SpellModConfig{
			Kind:       core.SpellMod_DamageDone_Pct,
			FloatValue: tier5TalentDamageValue,
		})
		tier5talentAura.
			ApplyOnGain(func(aura *core.Aura, sim *core.Simulation) {
				tier5Talent5DamageMod.Activate()
			}).
			ApplyOnExpire(func(aura *core.Aura, sim *core.Simulation) {
				tier5Talent5DamageMod.Deactivate()
			})
	}
}

func (we *WaterElemental) Reset(_ *core.Simulation) {
}

func (we *WaterElemental) OnEncounterStart(_ *core.Simulation) {
}

func (we *WaterElemental) ExecuteCustomRotation(sim *core.Simulation) {
	spell := we.Waterbolt
	spell.Cast(sim, we.CurrentTarget)
}

func (we *WaterElemental) registerWaterboltSpell() {

	waterboltVariance := 0.25   // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=31707 Field: "Variance"
	waterboltScale := 0.5       // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=31707 Field: "Coefficient"
	waterboltCoefficient := 0.5 // Per https://wago.tools/db2/SpellEffect?build=5.5.0.60802&filter%5BSpellID%5D=31707 Field: "BonusCoefficient"
	if we.mageOwner.HasMajorGlyph(proto.MageMajorGlyph_GlyphOfWaterElemental) {
		we.AddStaticMod(core.SpellModConfig{
			Kind:      core.SpellMod_AllowCastWhileMoving,
			ClassMask: mage.MageWaterElementalSpellWaterBolt,
		})
	}

	hasGlyph := we.mageOwner.HasMajorGlyph(proto.MageMajorGlyph_GlyphOfIcyVeins)

	we.Waterbolt = we.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 31707},
		SpellSchool:    core.SpellSchoolFrost,
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: mage.MageWaterElementalSpellWaterBolt,

		ManaCost: core.ManaCostOptions{
			BaseCostPercent: 1,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				GCDMin:   core.GCDDefault,
				CastTime: time.Millisecond * 2500,
			},
		},

		DamageMultiplier: 1 * 1.2, // 2013-09-23 Ice Lance's damage has been increased by 20%
		CritMultiplier:   we.mageOwner.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: waterboltCoefficient,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			hasSplitBolts := we.mageOwner.IcyVeinsAura.IsActive() && hasGlyph
			numberOfBolts := core.TernaryInt32(hasSplitBolts, 3, 1)
			damageMultiplier := core.TernaryFloat64(hasSplitBolts, 0.4, 1.0)

			spell.DamageMultiplier *= damageMultiplier
			for range numberOfBolts {
				baseDamage := we.CalcAndRollDamageRange(sim, waterboltScale, waterboltVariance)
				result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
				spell.WaitTravelTime(sim, func(sim *core.Simulation) {
					spell.DealDamage(sim, result)
				})
			}
			spell.DamageMultiplier /= damageMultiplier
		},
	})
}
