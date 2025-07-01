package frost

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/death_knight"
)

func RegisterFrostDeathKnight() {
	core.RegisterAgentFactory(
		proto.Player_FrostDeathKnight{},
		proto.Spec_SpecFrostDeathKnight,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewFrostDeathKnight(character, options)
		},
		func(player *proto.Player, spec any) {
			playerSpec, ok := spec.(*proto.Player_FrostDeathKnight)
			if !ok {
				panic("Invalid spec value for Frost Death Knight!")
			}
			player.Spec = playerSpec
		},
	)
}

type FrostDeathKnight struct {
	*death_knight.DeathKnight

	FreezingFogAura            *core.Aura
	KillingMachineAura         *core.Aura
	MightOfTheFrozenWastesAura *core.Aura
}

func NewFrostDeathKnight(character *core.Character, player *proto.Player) *FrostDeathKnight {
	fdk := &FrostDeathKnight{
		DeathKnight: death_knight.NewDeathKnight(character, death_knight.DeathKnightInputs{
			Spec:  proto.Spec_SpecFrostDeathKnight,
			IsDps: true,
		}, player.TalentsString, 0),
	}

	return fdk
}

func (fdk *FrostDeathKnight) GetDeathKnight() *death_knight.DeathKnight {
	return fdk.DeathKnight
}

func (fdk *FrostDeathKnight) Initialize() {
	fdk.DeathKnight.Initialize()

	fdk.registerMastery()

	fdk.registerBloodOfTheNorth()
	fdk.registerBrittleBones()
	fdk.registerFrostStrike()
	fdk.registerHowlingBlast()
	fdk.registerIcyTalons()
	fdk.registerImprovedFrostPresence()
	fdk.registerKillingMachine()
	fdk.registerMightOfTheFrozenWastes()
	fdk.registerObliterate()
	fdk.registerPillarOfFrost()
	fdk.registerRime()
	fdk.registerThreatOfThassarian()

	fdk.RegisterItemSwapCallback(core.AllWeaponSlots(), func(sim *core.Simulation, slot proto.ItemSlot) {
		if fdk.HasMHWeapon() && fdk.HasOHWeapon() {
			fdk.MightOfTheFrozenWastesAura.Deactivate(sim)
			fdk.ThreatOfThassarianAura.Activate(sim)
		} else if mh := fdk.GetMHWeapon(); mh != nil && mh.HandType == proto.HandType_HandTypeTwoHand {
			fdk.ThreatOfThassarianAura.Deactivate(sim)
			fdk.MightOfTheFrozenWastesAura.Activate(sim)
		}
	})
}

func (fdk *FrostDeathKnight) ApplyTalents() {
	fdk.DeathKnight.ApplyTalents()
	fdk.ApplyArmorSpecializationEffect(stats.Strength, proto.ArmorType_ArmorTypePlate, 86113)
}

func (fdk *FrostDeathKnight) Reset(sim *core.Simulation) {
	fdk.DeathKnight.Reset(sim)
}

func (fdk *FrostDeathKnight) OnEncounterStart(sim *core.Simulation) {
	fdk.FreezingFogAura.Deactivate(sim)
	fdk.KillingMachineAura.Deactivate(sim)
	fdk.DeathKnight.OnEncounterStart(sim)
}
