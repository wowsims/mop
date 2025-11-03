package feral

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

func RegisterFeralDruid() {
	core.RegisterAgentFactory(
		proto.Player_FeralDruid{},
		proto.Spec_SpecFeralDruid,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewFeralDruid(character, options)
		},
		func(player *proto.Player, spec interface{}) {
			playerSpec, ok := spec.(*proto.Player_FeralDruid)
			if !ok {
				panic("Invalid spec value for Feral Druid!")
			}
			player.Spec = playerSpec
		},
	)
}

func NewFeralDruid(character *core.Character, options *proto.Player) *FeralDruid {
	feralOptions := options.GetFeralDruid()
	selfBuffs := druid.SelfBuffs{}

	cat := &FeralDruid{
		Druid: druid.New(character, druid.Cat, selfBuffs, options.TalentsString),
	}

	cat.AssumeBleedActive = feralOptions.Options.AssumeBleedActive
	cat.CannotShredTarget = feralOptions.Options.CannotShredTarget
	cat.registerTreants()

	cat.EnableEnergyBar(core.EnergyBarOptions{
		MaxComboPoints:        5,
		MaxEnergy:             100.0,
		UnitClass:             proto.Class_ClassDruid,
		HasHasteRatingScaling: true,
	})
	cat.EnableRageBar(core.RageBarOptions{BaseRageMultiplier: 2.5})

	cat.EnableAutoAttacks(cat, core.AutoAttackOptions{
		// Base paw weapon.
		MainHand:       cat.GetCatWeapon(),
		AutoSwingMelee: true,
	})

	cat.RegisterCatFormAura()
	cat.RegisterBearFormAura()

	return cat
}

type FeralDruid struct {
	*druid.Druid

	// Aura references
	ClearcastingAura        *core.Aura
	DreamOfCenariusAura     *core.Aura
	FeralFuryAura           *core.Aura
	FeralRageAura           *core.Aura
	HeartOfTheWildAura      *core.Aura
	IncarnationAura         *core.Aura
	PredatorySwiftnessAura  *core.Aura
	SavageRoarBuff          *core.Dot
	SavageRoarDurationTable [6]time.Duration
	TigersFuryAura          *core.Aura

	// Spell references
	HeartOfTheWild *druid.DruidSpell
	Incarnation    *druid.DruidSpell
	SavageRoar     *druid.DruidSpell
	Shred          *druid.DruidSpell
	TigersFury     *druid.DruidSpell

	// Bonus references
	FeralFuryBonus *core.Aura

	tempSnapshotAura *core.Aura
}

func (cat *FeralDruid) GetDruid() *druid.Druid {
	return cat.Druid
}

func (cat *FeralDruid) AddRaidBuffs(raidBuffs *proto.RaidBuffs) {
	raidBuffs.LeaderOfThePack = true
}

func (cat *FeralDruid) Initialize() {
	cat.Druid.Initialize()
	cat.RegisterFeralCatSpells()
	cat.registerSavageRoarSpell()
	cat.registerShredSpell()
	cat.registerTigersFurySpell()
	cat.ApplyPrimalFury()
	cat.ApplyLeaderOfThePack()
	cat.ApplyNurturingInstinct()
	cat.applyOmenOfClarity()
	cat.applyPredatorySwiftness()

	snapshotHandler := func(aura *core.Aura, sim *core.Simulation) {
		previousRipSnapshotPower := cat.Rip.NewSnapshotPower
		cat.UpdateBleedPower(cat.Rip, sim, cat.CurrentTarget, false, true)
		cat.UpdateBleedPower(cat.Rake, sim, cat.CurrentTarget, false, true)
		cat.UpdateBleedPower(cat.ThrashCat, sim, cat.CurrentTarget, false, true)

		if cat.Rip.NewSnapshotPower > previousRipSnapshotPower+0.001 {
			if !cat.tempSnapshotAura.IsActive() || (aura.ExpiresAt() < cat.tempSnapshotAura.ExpiresAt()) {
				cat.tempSnapshotAura = aura

				if sim.Log != nil {
					cat.Log(sim, "New bleed snapshot aura found: %s", aura.ActionID)
				}
			}
		} else if !cat.tempSnapshotAura.IsActive() {
			cat.tempSnapshotAura = nil
		}
	}

	cat.TigersFuryAura.ApplyOnGain(snapshotHandler)
	cat.TigersFuryAura.ApplyOnExpire(snapshotHandler)
	cat.AddOnTemporaryStatsChange(func(sim *core.Simulation, buffAura *core.Aura, _ stats.Stats) {
		snapshotHandler(buffAura, sim)
	})

	if cat.DreamOfCenariusAura != nil {
		cat.DreamOfCenariusAura.ApplyOnGain(snapshotHandler)
		cat.DreamOfCenariusAura.ApplyOnExpire(snapshotHandler)
	}

	cat.CatFormAura.ApplyOnGain(func(_ *core.Aura, sim *core.Simulation) {
		if cat.tempSnapshotAura.IsActive() {
			cat.UpdateBleedPower(cat.Rip, sim, cat.CurrentTarget, false, true)
			cat.UpdateBleedPower(cat.Rake, sim, cat.CurrentTarget, false, true)
			cat.UpdateBleedPower(cat.ThrashCat, sim, cat.CurrentTarget, false, true)
		}
	})
}

func (cat *FeralDruid) ApplyTalents() {
	cat.Druid.ApplyTalents()
	cat.applySpecTalents()
	cat.ApplyArmorSpecializationEffect(stats.Agility, proto.ArmorType_ArmorTypeLeather, 86097)
	cat.applyMastery()
}

const BaseMasteryPoints = 8.0
const MasteryModPerPoint = 0.0313 // TODO: We expect 0.03125, possibly bugged?
const BaseMasteryMod = BaseMasteryPoints * MasteryModPerPoint

func (cat *FeralDruid) applyMastery() {
	razorClaws := cat.AddDynamicMod(core.SpellModConfig{
		ClassMask:  druid.DruidSpellThrashCat | druid.DruidSpellRake | druid.DruidSpellRip,
		Kind:       core.SpellMod_DamageDone_Pct,
		FloatValue: BaseMasteryMod + MasteryModPerPoint*cat.GetMasteryPoints(),
	})

	cat.AddOnMasteryStatChanged(func(_ *core.Simulation, _ float64, newMasteryRating float64) {
		razorClaws.UpdateFloatValue(BaseMasteryMod + MasteryModPerPoint*core.MasteryRatingToMasteryPoints(newMasteryRating))
	})

	razorClaws.Activate()
}

func (cat *FeralDruid) Reset(sim *core.Simulation) {
	cat.Druid.Reset(sim)
	cat.Druid.ClearForm(sim)
	cat.CatFormAura.Activate(sim)

	// Reset snapshot power values until first cast
	cat.Rip.CurrentSnapshotPower = 0
	cat.Rip.NewSnapshotPower = 0
	cat.Rake.CurrentSnapshotPower = 0
	cat.Rake.NewSnapshotPower = 0
	cat.tempSnapshotAura = nil
}
