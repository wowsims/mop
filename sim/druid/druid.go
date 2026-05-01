package druid

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

type Druid struct {
	core.Character
	SelfBuffs

	Talents *proto.DruidTalents

	ClassSpellScaling float64

	StartingForm DruidForm

	Treants TreantAgents

	BleedsActive      map[*core.Unit]int32
	AssumeBleedActive bool
	CannotShredTarget bool
	RipBaseNumTicks   int32
	RipMaxNumTicks    int32

	MHAutoSpell *core.Spell

	Barkskin              *DruidSpell
	Berserk               *DruidSpell
	CatCharge             *DruidSpell
	Dash                  *DruidSpell
	DisplacerBeast        *DruidSpell
	FaerieFire            *DruidSpell
	FerociousBite         *DruidSpell
	ForceOfNature         *DruidSpell
	FrenziedRegeneration  *DruidSpell
	HealingTouch          *DruidSpell
	Hurricane             *DruidSpell
	HurricaneTickSpell    *DruidSpell
	Lacerate              *DruidSpell
	MangleBear            *DruidSpell
	MangleCat             *DruidSpell
	Maul                  *DruidSpell
	MightOfUrsoc          *DruidSpell
	Moonfire              *DruidSpell
	NaturesSwiftness      *DruidSpell
	Prowl                 *DruidSpell
	Rake                  *DruidSpell
	Ravage                *DruidSpell
	Rejuvenation          *DruidSpell
	Rip                   *DruidSpell
	SurvivalInstincts     *DruidSpell
	SwipeBear             *DruidSpell
	SwipeCat              *DruidSpell
	ThrashBear            *DruidSpell
	ThrashCat             *DruidSpell
	Typhoon               *DruidSpell
	Wrath                 *DruidSpell
	WildMushrooms         *DruidSpell
	WildMushroomsDetonate *DruidSpell

	CatForm     *DruidSpell
	BearForm    *DruidSpell
	MoonkinForm *DruidSpell

	BarkskinAura             *core.Aura
	BearFormAura             *core.Aura
	BerserkBearAura          *core.Aura
	BerserkCatAura           *core.Aura
	CatFormAura              *core.Aura
	DashAura                 *core.Aura
	DisplacerBeastAura       *core.Aura
	FaerieFireAuras          core.AuraArray
	FrenziedRegenerationAura *core.Aura
	LunarEclipseProcAura     *core.Aura
	MightOfUrsocAura         *core.Aura
	MoonkinFormAura          *core.Aura
	ProwlAura                *core.Aura
	StampedeAura             *core.Aura
	StampedePendingAura      *core.Aura
	TigersFury4PT15Aura      *core.Aura
	SurvivalInstinctsAura    *core.Aura
	WeakenedBlowsAuras       core.AuraArray

	form DruidForm

	// Guardian leather specialization is form-specific
	GuardianLeatherSpecTracker *core.Aura
	GuardianLeatherSpecDep     *stats.StatDependency
}

const (
	DruidSpellFlagNone int64 = 0
	DruidSpellBarkskin int64 = 1 << iota
	DruidSpellFearieFire
	DruidSpellHurricane
	DruidSpellAstralStorm
	DruidSpellAstralCommunion
	DruidSpellFerociousBite
	DruidSpellFrenziedRegeneration
	DruidSpellInnervate
	DruidSpellLacerate
	DruidSpellMangleBear
	DruidSpellMangleCat
	DruidSpellMaul
	DruidSpellMightOfUrsoc
	DruidSpellMoonfire
	DruidSpellMoonfireDoT
	DruidSpellRake
	DruidSpellRavage
	DruidSpellRip
	DruidSpellSavageDefense
	DruidSpellSavageRoar
	DruidSpellShred
	DruidSpellStarfall
	DruidSpellStarfallTick
	DruidSpellStarfire
	DruidSpellStarsurge
	DruidSpellSunfire
	DruidSpellSunfireDoT
	DruidSpellSwipeBear
	DruidSpellSwipeCat
	DruidSpellThrashBear
	DruidSpellThrashCat
	DruidSpellTigersFury
	DruidSpellWildMushroom
	DruidSpellWildMushroomDetonate
	DruidSpellWrath

	DruidSpell2PT16Bolt

	DruidSpellHealingTouch
	DruidSpellRegrowth
	DruidSpellLifebloom
	DruidSpellRejuvenation
	DruidSpellNourish
	DruidSpellTranquility
	DruidSpellMarkOfTheWild
	DruidSpellSwiftmend
	DruidSpellWildGrowth
	DruidSpellCenarionWard
	DruidSpellCelestialAlignment

	DruidSpellLast
	DruidSpellsAll               = DruidSpellLast<<1 - 1
	DruidSpellDoT                = DruidSpellMoonfireDoT | DruidSpellSunfireDoT
	DruidSpellHoT                = DruidSpellRejuvenation | DruidSpellLifebloom | DruidSpellRegrowth | DruidSpellWildGrowth
	DruidSpellInstant            = DruidSpellBarkskin | DruidSpellMoonfire | DruidSpellStarfall | DruidSpellSunfire | DruidSpellFearieFire | DruidSpellBarkskin
	DruidSpellMangle             = DruidSpellMangleBear | DruidSpellMangleCat
	DruidSpellThrash             = DruidSpellThrashBear | DruidSpellThrashCat
	DruidSpellSwipe              = DruidSpellSwipeBear | DruidSpellSwipeCat
	DruidSpellBuilder            = DruidSpellMangleCat | DruidSpellShred | DruidSpellRake | DruidSpellRavage
	DruidSpellFinisher           = DruidSpellFerociousBite | DruidSpellRip | DruidSpellSavageRoar
	DruidArcaneSpells            = DruidSpellMoonfire | DruidSpellMoonfireDoT | DruidSpellStarfire | DruidSpellStarsurge | DruidSpellStarfall
	DruidNatureSpells            = DruidSpellWrath | DruidSpellStarsurge | DruidSpellSunfire | DruidSpellSunfireDoT | DruidSpellHurricane | DruidSpellWildMushroomDetonate
	DruidHealingNonInstantSpells = DruidSpellHealingTouch | DruidSpellRegrowth | DruidSpellNourish
	DruidHealingSpells           = DruidHealingNonInstantSpells | DruidSpellRejuvenation | DruidSpellLifebloom | DruidSpellSwiftmend
	DruidDamagingSpells          = DruidArcaneSpells | DruidNatureSpells
)

type SelfBuffs struct {
	InnervateTarget *proto.UnitReference
}

func (druid *Druid) GetCharacter() *core.Character {
	return &druid.Character
}

// func (druid *Druid) AddRaidBuffs(raidBuffs *proto.RaidBuffs) {
// 	if druid.InForm(Cat|Bear) && druid.Talents.LeaderOfThePack {
// 		raidBuffs.LeaderOfThePack = true
// 	}

// 	if druid.InForm(Moonkin) {
// 		raidBuffs.MoonkinForm = true
// 	}

// 	raidBuffs.MarkOfTheWild = true
// }

func (druid *Druid) HasMajorGlyph(glyph proto.DruidMajorGlyph) bool {
	return druid.HasGlyph(int32(glyph))
}

func (druid *Druid) HasMinorGlyph(glyph proto.DruidMinorGlyph) bool {
	return druid.HasGlyph(int32(glyph))
}

func (druid *Druid) RegisterSpell(formMask DruidForm, config core.SpellConfig) *DruidSpell {
	prev := config.ExtraCastCondition
	prevModify := config.Cast.ModifyCast

	ds := &DruidSpell{FormMask: formMask}
	config.ExtraCastCondition = func(sim *core.Simulation, target *core.Unit) bool {
		// Check if we're in allowed form to cast
		// Allow 'humanoid' auto unshift casts
		if (ds.FormMask != Any && !druid.InForm(ds.FormMask)) && !ds.FormMask.Matches(Humanoid) {
			if sim.Log != nil {
				sim.Log("Failed cast to spell %s, wrong form", ds.ActionID)
			}
			return false
		}
		return prev == nil || prev(sim, target)
	}
	config.Cast.ModifyCast = func(sim *core.Simulation, s *core.Spell, c *core.Cast) {
		if !druid.InForm(ds.FormMask) && ds.FormMask.Matches(Humanoid) {
			druid.ClearForm(sim)
		}
		if prevModify != nil {
			prevModify(sim, s, c)
		}
	}

	ds.Spell = druid.Unit.RegisterSpell(config)

	return ds
}

func (druid *Druid) Initialize() {
	druid.form = druid.StartingForm

	druid.Env.RegisterPostFinalizeEffect(func() {
		druid.MHAutoSpell = druid.AutoAttacks.MHAuto()
	})

	druid.RegisterItemSwapCallback([]proto.ItemSlot{proto.ItemSlot_ItemSlotMainHand}, func(sim *core.Simulation, slot proto.ItemSlot) {
		switch {
		case druid.InForm(Cat):
			druid.AutoAttacks.SetMH(druid.GetCatWeapon())
		case druid.InForm(Bear):
			druid.AutoAttacks.SetMH(druid.GetBearWeapon())
		}
	})

	druid.WeakenedBlowsAuras = druid.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		return core.WeakenedBlowsAura(target)
	})

	druid.RegisterBaselineSpells()

	druid.ApplyGlyphs()
}

func (druid *Druid) RegisterBaselineSpells() {
	druid.registerMoonfireSpell()
	druid.registerWrathSpell()
	druid.registerHealingTouchSpell()
	druid.registerHurricaneSpell()
	druid.registerNaturesSwiftness()
	druid.registerFaerieFireSpell()
	druid.registerTranquilityCD()
	druid.registerRejuvenationSpell()

	// druid.registerRebirthSpell()
	// druid.registerInnervateCD()
}

func (druid *Druid) RegisterFeralCatSpells() {
	druid.registerBearFormSpell()
	druid.registerBerserkCD()
	// druid.registerCatCharge()
	druid.registerCatFormSpell()
	druid.registerDashCD()
	druid.registerFerociousBiteSpell()
	druid.registerLacerateSpell()
	druid.registerMangleBearSpell()
	druid.registerMangleCatSpell()
	druid.registerMaulSpell()
	druid.registerProwlSpell()
	druid.registerRakeSpell()
	druid.registerRavageSpell()
	druid.registerRipSpell()
	druid.registerSwipeBearSpell()
	druid.registerSwipeCatSpell()
	druid.registerThrashBearSpell()
	druid.registerThrashCatSpell()
}

func (druid *Druid) RegisterFeralTankSpells() {
	druid.registerBarkskinCD()
	druid.registerBearFormSpell()
	druid.registerBerserkCD()
	druid.registerCatFormSpell()
	druid.registerFrenziedRegenerationSpell()
	druid.registerMangleBearSpell()
	druid.registerMangleCatSpell()
	druid.registerMaulSpell()
	druid.registerMightOfUrsocCD()
	druid.registerLacerateSpell()
	druid.registerRakeSpell()
	druid.registerRipSpell()
	druid.registerSurvivalInstinctsCD()
	druid.registerSwipeBearSpell()
	druid.registerThrashBearSpell()
}

func (druid *Druid) Reset(_ *core.Simulation) {
	druid.form = druid.StartingForm

	for target := range druid.BleedsActive {
		druid.BleedsActive[target] = 0
	}
}

func (druid *Druid) OnEncounterStart(sim *core.Simulation) {
}

func New(char *core.Character, form DruidForm, selfBuffs SelfBuffs, talents string) *Druid {
	druid := &Druid{
		Character:         *char,
		SelfBuffs:         selfBuffs,
		Talents:           &proto.DruidTalents{},
		StartingForm:      form,
		form:              form,
		ClassSpellScaling: core.GetClassSpellScalingCoefficient(proto.Class_ClassDruid),
		BleedsActive:      make(map[*core.Unit]int32),
		RipBaseNumTicks:   8,
	}

	druid.RipMaxNumTicks = druid.RipBaseNumTicks + 3

	core.FillTalentsProto(druid.Talents.ProtoReflect(), talents)
	druid.EnableManaBar()

	druid.AddStatDependency(stats.Strength, stats.AttackPower, 1)
	druid.AddStatDependency(stats.BonusArmor, stats.Armor, 1)
	druid.AddStatDependency(stats.Agility, stats.PhysicalCritPercent, core.CritPerAgiMaxLevel[char.Class])

	// Base dodge is unaffected by Diminishing Returns
	druid.PseudoStats.BaseDodgeChance += 0.03

	// Base Agility to Dodge is not affected by Diminishing Returns
	baseAgility := druid.GetBaseStats()[stats.Agility]
	druid.PseudoStats.BaseDodgeChance += baseAgility * core.AgilityToDodgePercent
	druid.AddStat(stats.DodgeRating, -baseAgility*core.AgilityToDodgeRating)
	druid.AddStatDependency(stats.Agility, stats.DodgeRating, core.AgilityToDodgeRating)

	return druid
}

type DruidSpell struct {
	*core.Spell
	FormMask DruidForm

	// Optional fields used in snapshotting calculations
	CurrentSnapshotPower float64
	NewSnapshotPower     float64
	ShortName            string
}

func (ds *DruidSpell) IsReady(sim *core.Simulation) bool {
	if ds == nil {
		return false
	}
	return ds.Spell.IsReady(sim)
}

func (ds *DruidSpell) CanCast(sim *core.Simulation, target *core.Unit) bool {
	if ds == nil {
		return false
	}
	return ds.Spell.CanCast(sim, target)
}

func (ds *DruidSpell) IsEqual(s *core.Spell) bool {
	if ds == nil || s == nil {
		return false
	}
	return ds.Spell == s
}

func (druid *Druid) UpdateBleedPower(bleedSpell *DruidSpell, sim *core.Simulation, target *core.Unit, updateCurrent bool, updateNew bool) {
	snapshotPower := bleedSpell.ExpectedTickDamage(sim, target)

	if updateCurrent {
		bleedSpell.CurrentSnapshotPower = snapshotPower

		if sim.Log != nil {
			druid.Log(sim, "%s Snapshot Power: %.1f", bleedSpell.ShortName, snapshotPower)
		}
	}

	if updateNew {
		bleedSpell.NewSnapshotPower = snapshotPower

		if (sim.Log != nil) && !updateCurrent {
			druid.Log(sim, "%s Projected Power: %.1f", bleedSpell.ShortName, snapshotPower)
		}
	}
}

// Agent is a generic way to access underlying druid on any of the agents (for example balance druid.)
type DruidAgent interface {
	GetDruid() *Druid
}
