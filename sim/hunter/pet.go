package hunter

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

type HunterPet struct {
	core.Pet

	config    PetConfig
	isPrimary bool

	hunterOwner *Hunter

	FrenzyAura *core.Aura

	specialAbility *core.Spell
	KillCommand    *core.Spell
	focusDump      *core.Spell
	exoticAbility  *core.Spell
	lynxRushSpell  *core.Spell

	uptimePercent    float64
	wolverineBite    *core.Spell
	frostStormBreath *core.Spell
	hasOwnerCooldown bool

	WHFocusIncreaseMod *core.SpellMod
	WHDamageMod        *core.SpellMod
}

func (hunter *Hunter) NewStampedePet(index int) *HunterPet {
	conf := core.PetConfig{
		Name:                            "Stampede",
		Owner:                           &hunter.Character,
		NonHitExpStatInheritance:        hunter.makeStatInheritance(),
		EnabledOnStart:                  false,
		IsGuardian:                      false,
		HasDynamicMeleeSpeedInheritance: true,
	}
	stampedePet := &HunterPet{
		Pet:         core.NewPet(conf),
		config:      PetConfig{Name: "Stampede"},
		hunterOwner: hunter,

		//hasOwnerCooldown: petConfig.SpecialAbility == FuriousHowl || petConfig.SpecialAbility == SavageRend,
	}
	stampedePet.EnableAutoAttacks(stampedePet, core.AutoAttackOptions{
		MainHand: core.Weapon{
			BaseDamageMin:  hunter.ClassSpellScaling * 0.25,
			BaseDamageMax:  hunter.ClassSpellScaling * 0.25,
			CritMultiplier: 2,
			SwingSpeed:     2,
		},
		AutoSwingMelee: true,
		ProcMask:       core.ProcMaskEmpty,
	})
	stampedePet.ApplyTalents()
	hunter.AddPet(stampedePet)
	return stampedePet
}

func (hunter *Hunter) NewDireBeastPet() *HunterPet {
	conf := core.PetConfig{
		Name:                            "Dire Beast Pet",
		Owner:                           &hunter.Character,
		NonHitExpStatInheritance:        hunter.makeStatInheritance(),
		EnabledOnStart:                  false,
		IsGuardian:                      true,
		HasDynamicMeleeSpeedInheritance: true,
	}
	direBeastPet := &HunterPet{
		Pet:         core.NewPet(conf),
		config:      PetConfig{Name: "Dire Beast"},
		hunterOwner: hunter,

		//hasOwnerCooldown: petConfig.SpecialAbility == FuriousHowl || petConfig.SpecialAbility == SavageRend,
	}
	dbActionID := core.ActionID{SpellID: 120679}
	focusMetrics := hunter.NewFocusMetrics(dbActionID)
	direBeastPet.EnableAutoAttacks(direBeastPet, core.AutoAttackOptions{
		MainHand: core.Weapon{
			BaseDamageMin:     hunter.ClassSpellScaling,
			BaseDamageMax:     hunter.ClassSpellScaling,
			CritMultiplier:    2,
			SwingSpeed:        2,
			AttackPowerPerDPS: 7,
		},
		AutoSwingMelee: true,
		ProcMask:       core.ProcMaskEmpty,
	})

	hunter.AddPet(direBeastPet)
	core.MakeProcTriggerAura(&direBeastPet.Unit, core.ProcTrigger{
		Name:       "Dire Beast",
		ActionID:   core.ActionID{ItemID: 120679},
		Callback:   core.CallbackOnSpellHitDealt,
		ProcChance: 1,
		SpellFlags: core.SpellFlagMeleeMetrics,
		Outcome:    core.OutcomeLanded,
		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			hunter.AddFocus(sim, 5, focusMetrics)
		},
	})
	return direBeastPet
}

func (hunter *Hunter) NewHunterPet() *HunterPet {
	if hunter.Options.PetType == proto.HunterOptions_PetNone {
		return nil
	}
	if hunter.Options.PetUptime <= 0 {
		return nil
	}
	petConfig := DefaultPetConfigs[hunter.Options.PetType]
	conf := core.PetConfig{
		Name:                            petConfig.Name,
		Owner:                           &hunter.Character,
		NonHitExpStatInheritance:        hunter.makeStatInheritance(),
		EnabledOnStart:                  true,
		IsGuardian:                      false,
		HasDynamicMeleeSpeedInheritance: true,
		HasResourceRegenInheritance:     true,
	}
	hp := &HunterPet{
		Pet:         core.NewPet(conf),
		config:      petConfig,
		hunterOwner: hunter,
		isPrimary:   true,
	}

	//Todo: Verify this
	// base_focus_regen_per_second  = ( 24.5 / 4.0 );
	// base_focus_regen_per_second *= 1.0 + o -> talents.bestial_discipline -> effect1().percent();
	baseFocusPerSecond := 5.0 // As observed on logs
	WHFocusIncreaseMod := hp.AddDynamicMod(core.SpellModConfig{
		Kind:       core.SpellMod_PowerCost_Pct,
		ProcMask:   core.ProcMaskMeleeMHSpecial,
		FloatValue: 1,
	})

	WHDamageMod := hp.AddDynamicMod(core.SpellModConfig{
		Kind:       core.SpellMod_DamageDone_Pct,
		ProcMask:   core.ProcMaskMeleeMHSpecial,
		FloatValue: 1,
	})

	// Store modifiers for reset
	hp.WHFocusIncreaseMod = WHFocusIncreaseMod
	hp.WHDamageMod = WHDamageMod

	// Active at start - will be controlled by focus bar callback
	WHFocusIncreaseMod.Activate()
	WHDamageMod.Activate()

	kindredSpritsBonusFocus := core.TernaryFloat64(hp.hunterOwner.Spec == proto.Spec_SpecBeastMasteryHunter, 20, 0)
	hp.EnableFocusBar(100+kindredSpritsBonusFocus, baseFocusPerSecond, false, func(sim *core.Simulation, focus float64) {
		if focus >= 50 {
			WHFocusIncreaseMod.Activate()
			WHDamageMod.Activate()
		} else {
			WHFocusIncreaseMod.Deactivate()
			WHDamageMod.Deactivate()
		}
	})

	hp.EnableAutoAttacks(hp, core.AutoAttackOptions{
		MainHand: core.Weapon{
			BaseDamageMin:  hp.hunterOwner.ClassSpellScaling * 0.25,
			BaseDamageMax:  hp.hunterOwner.ClassSpellScaling * 0.25,
			CritMultiplier: 2,
			SwingSpeed:     2,
		},
		AutoSwingMelee: true,
	})

	hunter.AddPet(hp)
	return hp
}
func (hp *HunterPet) ApplyTalents() {
	hp.ApplyCombatExperience() // All pets have this
	hp.ApplySpikedCollar()

}
func (hp *HunterPet) GetPet() *core.Pet {
	return &hp.Pet
}

func (hp *HunterPet) Initialize() {
	if !hp.isPrimary {
		return
	}
	hp.Pet.Initialize()
	cfg := DefaultPetConfigs[hp.hunterOwner.Options.PetType]
	// Primary active ability (often a cooldown)
	if cfg.SpecialAbility != Unknown {
		hp.specialAbility = hp.NewPetAbility(cfg.SpecialAbility, true)
	}

	if cfg.FocusDump != Unknown {
		hp.focusDump = hp.NewPetAbility(cfg.FocusDump, false)
	}

	// Optional exotic ability
	if cfg.ExoticAbility != Unknown {
		hp.exoticAbility = hp.NewPetAbility(cfg.ExoticAbility, false)
	}
	hp.KillCommand = hp.RegisterKillCommandSpell()

	hp.registerRabidCD()
}

func (hp *HunterPet) Reset(sim *core.Simulation) {
	hp.uptimePercent = min(1, max(0, hp.hunterOwner.Options.PetUptime))

	// Reset modifiers to initial state based on starting focus
	if hp.WHFocusIncreaseMod != nil && hp.WHDamageMod != nil {
		// Start with modifiers active (assuming pet starts with full focus)
		hp.WHFocusIncreaseMod.Activate()
		hp.WHDamageMod.Activate()
	}
}

func (hp *HunterPet) ExecuteCustomRotation(sim *core.Simulation) {
	if !hp.isPrimary {
		return
	}
	percentRemaining := sim.GetRemainingDurationPercent()
	if percentRemaining < 1.0-hp.uptimePercent { // once fight is % completed, disable pet.
		hp.Disable(sim)
		return
	}

	if hp.hasOwnerCooldown && hp.CurrentFocus() < 50 {
		// When a major ability (Furious Howl or Savage Rend) is ready, pool enough
		// energy to use on-demand.
		return
	}

	target := hp.CurrentTarget

	if hp.frostStormBreath != nil && hp.frostStormBreath.CanCast(sim, target) && len(sim.Encounter.TargetUnits) > 4 {
		hp.frostStormBreath.Cast(sim, target)
	}

	if hp.wolverineBite.CanCast(sim, target) {
		hp.wolverineBite.Cast(sim, target)
	}

	if hp.focusDump == nil {
		hp.specialAbility.Cast(sim, target)
		return
	}
	if hp.specialAbility == nil {
		hp.focusDump.Cast(sim, target)
		return
	}

	if hp.config.RandomSelection {
		if sim.RandomFloat("Hunter Pet Ability") < 0.5 {
			_ = hp.specialAbility.Cast(sim, target) || hp.focusDump.Cast(sim, target)
		} else {
			_ = hp.focusDump.Cast(sim, target) || hp.specialAbility.Cast(sim, target)
		}
	} else {
		_ = hp.specialAbility.Cast(sim, target) || hp.focusDump.Cast(sim, target)
	}
}

func (hunter *Hunter) makeStatInheritance() core.PetStatInheritance {
	return func(ownerStats stats.Stats) stats.Stats {
		return stats.Stats{
			stats.Stamina:           ownerStats[stats.Stamina] * 0.45,
			stats.Armor:             ownerStats[stats.Armor] * 1.05,
			stats.AttackPower:       ownerStats[stats.RangedAttackPower],
			stats.RangedAttackPower: ownerStats[stats.RangedAttackPower],
			stats.SpellPower:        ownerStats[stats.RangedAttackPower] * 0.5,

			stats.PhysicalCritPercent: ownerStats[stats.PhysicalCritPercent],
			stats.SpellCritPercent:    ownerStats[stats.PhysicalCritPercent],

			stats.HasteRating: ownerStats[stats.HasteRating],
		}
	}
}

type PetConfig struct {
	Name string

	SpecialAbility PetAbilityType
	FocusDump      PetAbilityType
	ExoticAbility  PetAbilityType

	// Randomly select between abilities instead of using a prio.
	RandomSelection bool
}

var DefaultPetConfigs = [...]PetConfig{
	proto.HunterOptions_PetNone:      {},
	proto.HunterOptions_Bat:          {Name: "Bat", FocusDump: Smack},
	proto.HunterOptions_Bear:         {Name: "Bear", FocusDump: Claw, SpecialAbility: DemoralizingRoar},
	proto.HunterOptions_BirdOfPrey:   {Name: "Bird of Prey", FocusDump: Claw},
	proto.HunterOptions_Boar:         {Name: "Boar", FocusDump: Bite, SpecialAbility: Gore},
	proto.HunterOptions_CarrionBird:  {Name: "Carrion Bird", FocusDump: Bite, SpecialAbility: DemoralizingScreech},
	proto.HunterOptions_Cat:          {Name: "Cat", FocusDump: Claw},
	proto.HunterOptions_Chimaera:     {Name: "Chimaera", FocusDump: Bite, ExoticAbility: FroststormBreathAoE},
	proto.HunterOptions_CoreHound:    {Name: "Core Hound", FocusDump: Bite, ExoticAbility: LavaBreath},
	proto.HunterOptions_Crab:         {Name: "Crab", FocusDump: Claw},
	proto.HunterOptions_Crocolisk:    {Name: "Crocolisk", FocusDump: Bite},
	proto.HunterOptions_Devilsaur:    {Name: "Devilsaur", FocusDump: Bite, ExoticAbility: MonstrousBite},
	proto.HunterOptions_Dragonhawk:   {Name: "Dragonhawk", FocusDump: Bite, SpecialAbility: FireBreathDebuff},
	proto.HunterOptions_Fox:          {Name: "Fox", FocusDump: Bite, SpecialAbility: TailSpin},
	proto.HunterOptions_Gorilla:      {Name: "Gorilla", FocusDump: Smack},
	proto.HunterOptions_Hyena:        {Name: "Hyena", FocusDump: Bite},
	proto.HunterOptions_Moth:         {Name: "Moth", FocusDump: Smack},
	proto.HunterOptions_NetherRay:    {Name: "Nether Ray", FocusDump: Bite},
	proto.HunterOptions_Raptor:       {Name: "Raptor", FocusDump: Claw, SpecialAbility: TearArmor},
	proto.HunterOptions_Ravager:      {Name: "Ravager", FocusDump: Bite, SpecialAbility: Ravage},
	proto.HunterOptions_Rhino:        {Name: "Rhino", FocusDump: Bite, SpecialAbility: StampedeDebuff},
	proto.HunterOptions_Scorpid:      {Name: "Scorpid", FocusDump: Bite},
	proto.HunterOptions_Serpent:      {Name: "Serpent", FocusDump: Bite},
	proto.HunterOptions_Silithid:     {Name: "Silithid", FocusDump: Claw, SpecialAbility: QirajiFortitude},
	proto.HunterOptions_Spider:       {Name: "Spider", FocusDump: Bite},
	proto.HunterOptions_SpiritBeast:  {Name: "Spirit Beast", FocusDump: Claw, ExoticAbility: SpiritMend},
	proto.HunterOptions_SporeBat:     {Name: "Spore Bat", FocusDump: Smack, SpecialAbility: SporeCloud},
	proto.HunterOptions_Tallstrider:  {Name: "Tallstrider", FocusDump: Claw, SpecialAbility: DustCloud},
	proto.HunterOptions_Turtle:       {Name: "Turtle", FocusDump: Bite},
	proto.HunterOptions_WarpStalker:  {Name: "Warp Stalker", FocusDump: Bite},
	proto.HunterOptions_Wasp:         {Name: "Wasp", FocusDump: Smack},
	proto.HunterOptions_WindSerpent:  {Name: "Wind Serpent", FocusDump: Bite, SpecialAbility: LightningBreath},
	proto.HunterOptions_Wolf:         {Name: "Wolf", FocusDump: Bite},
	proto.HunterOptions_Worm:         {Name: "Worm", FocusDump: Bite, SpecialAbility: AcidSpitDebuff, ExoticAbility: BurrowAttack},
	proto.HunterOptions_ShaleSpider:  {Name: "Shale Spider", FocusDump: Bite, SpecialAbility: EmbraceOfTheShaleSpider},
	proto.HunterOptions_Goat:         {Name: "Goat", FocusDump: Bite, SpecialAbility: Trample},
	proto.HunterOptions_Porcupine:    {Name: "Porcupine", FocusDump: Bite},
	proto.HunterOptions_Monkey:       {Name: "Monkey", FocusDump: Bite},
	proto.HunterOptions_Basilisk:     {Name: "Basilisk", FocusDump: Bite},
	proto.HunterOptions_Crane:        {Name: "Crane", FocusDump: Bite},
	proto.HunterOptions_Dog:          {Name: "Dog", FocusDump: Bite},
	proto.HunterOptions_Beetle:       {Name: "Beetle", FocusDump: Bite},
	proto.HunterOptions_Quilen:       {Name: "Quilen", FocusDump: Bite},
	proto.HunterOptions_WaterStrider: {Name: "Water Strider", FocusDump: Claw},
}
