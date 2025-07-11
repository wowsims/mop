package blood

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/death_knight"
)

func RegisterBloodDeathKnight() {
	core.RegisterAgentFactory(
		proto.Player_BloodDeathKnight{},
		proto.Spec_SpecBloodDeathKnight,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewBloodDeathKnight(character, options)
		},
		func(player *proto.Player, spec any) {
			playerSpec, ok := spec.(*proto.Player_BloodDeathKnight)
			if !ok {
				panic("Invalid spec value for Blood Death Knight!")
			}
			player.Spec = playerSpec
		},
	)
}

// Threat Done By Caster setup
const (
	TDBC_DarkCommand int = iota

	TDBC_Total
)

type BloodDeathKnight struct {
	*death_knight.DeathKnight

	Bloodworms []*BloodwormPet

	RuneTapSpell *core.Spell
}

func NewBloodDeathKnight(character *core.Character, options *proto.Player) *BloodDeathKnight {
	bdk := &BloodDeathKnight{
		DeathKnight: death_knight.NewDeathKnight(character, death_knight.DeathKnightInputs{
			Spec:  proto.Spec_SpecBloodDeathKnight,
			IsDps: false,
		}, options.TalentsString, 50034),
	}

	bdk.RuneWeapon = bdk.NewRuneWeapon()

	bdk.Bloodworms = make([]*BloodwormPet, 5)
	for i := range 5 {
		bdk.Bloodworms[i] = bdk.NewBloodwormPet(i)
	}

	return bdk
}

func (bdk *BloodDeathKnight) GetDeathKnight() *death_knight.DeathKnight {
	return bdk.DeathKnight
}

func (bdk *BloodDeathKnight) Initialize() {
	bdk.DeathKnight.Initialize()

	bdk.registerMastery()

	bdk.registerBloodParasite()
	bdk.registerBloodRites()
	bdk.registerBoneShield()
	bdk.registerCrimsonScourge()
	bdk.registerDancingRuneWeapon()
	bdk.registerDarkCommand()
	bdk.registerHeartStrike()
	bdk.registerHotfixPassive()
	bdk.registerImprovedBloodPresence()
	bdk.registerRiposte()
	bdk.registerRuneStrike()
	bdk.registerRuneTap()
	bdk.registerSanguineFortitude()
	bdk.registerScarletFever()
	bdk.registerScentOfBlood()
	bdk.registerVampiricBlood()
	bdk.registerVeteranOfTheThirdWar()
	bdk.registerWillOfTheNecropolis()

	bdk.RuneWeapon.AddCopySpell(HeartStrikeActionID, bdk.registerDrwHeartStrike())
	bdk.RuneWeapon.AddCopySpell(RuneStrikeActionID, bdk.registerDrwRuneStrike())
}

func (bdk *BloodDeathKnight) ApplyTalents() {
	bdk.DeathKnight.ApplyTalents()
	bdk.ApplyArmorSpecializationEffect(stats.Stamina, proto.ArmorType_ArmorTypePlate, 86537)

	// Vengeance
	vengeanceAura := bdk.RegisterVengeance(93099, nil)
	vengeanceAura.ApplyOnStacksChange(func(_ *core.Aura, sim *core.Simulation, oldVengeance int32, newVengeance int32) {
		vengeanceDiff := oldVengeance - newVengeance
		if vengeanceDiff == 0 {
			return
		}

		invertedAPChange := bdk.ApplyStatDependencies(stats.Stats{stats.AttackPower: float64(vengeanceDiff)})
		bdk.Env.TriggerDelayedPetInheritance(sim, bdk.GetAllActiveGhoulPets(), func(sim *core.Simulation, pet *core.Pet) {
			pet.AddOwnerStats(sim, invertedAPChange)
		})
	})

	for _, ghoul := range bdk.AllGhoulPets {
		oldOnPetEnable := ghoul.OnPetEnable
		ghoul.OnPetEnable = func(sim *core.Simulation) {
			if oldOnPetEnable != nil {
				oldOnPetEnable(sim)
			}

			vengeanceStacks := vengeanceAura.GetStacks()
			if vengeanceStacks == 0 {
				return
			}

			invertedAPChange := bdk.ApplyStatDependencies(stats.Stats{stats.AttackPower: -float64(vengeanceStacks)})
			ghoul.AddOwnerStats(sim, invertedAPChange)
		}
	}
}

func (bdk *BloodDeathKnight) Reset(sim *core.Simulation) {
	bdk.DeathKnight.Reset(sim)
}
