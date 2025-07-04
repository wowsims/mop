package blood

import (
	"math"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

type BloodwormPet struct {
	core.Pet

	stackAura *core.Aura
	dkOwner   *BloodDeathKnight
}

func (bdk *BloodDeathKnight) NewBloodwormPet(_ int) *BloodwormPet {
	bloodworm := &BloodwormPet{
		Pet: core.NewPet(core.PetConfig{
			Name:                            "Bloodworm",
			Owner:                           &bdk.Character,
			BaseStats:                       stats.Stats{},
			NonHitExpStatInheritance:        bloodwormStatInheritance,
			EnabledOnStart:                  false,
			IsGuardian:                      true,
			HasDynamicMeleeSpeedInheritance: true,
		}),
		dkOwner: bdk,
	}

	baseDamage := bdk.CalcScalingSpellDmg(0.55)
	bloodworm.EnableAutoAttacks(bloodworm, core.AutoAttackOptions{
		MainHand: core.Weapon{
			BaseDamageMin:  baseDamage,
			BaseDamageMax:  baseDamage,
			SwingSpeed:     2,
			CritMultiplier: bdk.DefaultCritMultiplier(),
		},
		AutoSwingMelee: true,
	})

	bloodworm.OnPetDisable = bloodworm.disable

	// Command doesn't apply to Bloodworms
	if bdk.Race == proto.Race_RaceOrc {
		bloodworm.PseudoStats.DamageDealtMultiplier /= 1.02
	}

	bdk.AddPet(bloodworm)

	return bloodworm
}

func (bloodworm *BloodwormPet) GetPet() *core.Pet {
	return &bloodworm.Pet
}

func (bloodworm *BloodwormPet) getBloodBurstProcChance() float64 {
	stacks := bloodworm.stackAura.GetStacks()
	dkHealth := bloodworm.dkOwner.CurrentHealthPercent()
	baseProcChance := math.Pow(float64(stacks+1), 3)
	multiplier := 0.0

	if dkHealth >= 100 && stacks >= 5 {
		multiplier = 0.5
	} else if dkHealth > 60 && dkHealth < 100 {
		multiplier = 1.0
	} else if dkHealth > 30 && dkHealth <= 60 {
		multiplier = 1.5
	} else if dkHealth <= 30 {
		multiplier = 2.0
	}

	return baseProcChance * multiplier
}

func (bloodworm *BloodwormPet) Initialize() {
	bloodworm.Pet.Initialize()

	bloodworm.stackAura = bloodworm.GetOrRegisterAura(core.Aura{
		Label:     "Blood Gorged" + bloodworm.Label,
		ActionID:  core.ActionID{SpellID: 81277},
		Duration:  core.NeverExpires,
		MaxStacks: 99,
	})

	healSpell := bloodworm.dkOwner.GetOrRegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 81280},
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagPassiveSpell | core.SpellFlagHelpful,

		DamageMultiplier: 1,
		CritMultiplier:   bloodworm.dkOwner.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
	})

	explosion := bloodworm.GetOrRegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 81280},
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellHealing,
		Flags:       core.SpellFlagPassiveSpell | core.SpellFlagHelpful,

		DamageMultiplier: 1,
		CritMultiplier:   bloodworm.DefaultCritMultiplier(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			healSpell.Cast(sim, target)

			baseHealing := float64(bloodworm.stackAura.GetStacks()) * 0.25 * bloodworm.MaxHealth()
			for _, target := range sim.Raid.AllPlayerUnits {
				if target == &bloodworm.Unit {
					continue
				}

				if target.DistanceFromTarget > core.MaxMeleeRange {
					continue
				}

				healSpell.CalcAndDealHealing(sim, target, baseHealing, healSpell.OutcomeHealingCrit)
			}

			bloodworm.Pet.Disable(sim)
		},
	})

	core.MakeProcTriggerAura(&bloodworm.Unit, core.ProcTrigger{
		Name:     "Blood Gorged Trigger" + bloodworm.Label,
		ActionID: core.ActionID{SpellID: 50453},
		Callback: core.CallbackOnSpellHitDealt,
		Outcome:  core.OutcomeLanded,

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if bloodworm.stackAura.IsActive() {
				if bloodworm.getBloodBurstProcChance() > sim.RollWithLabel(0, 999, "Blood Burst"+bloodworm.Label) {
					explosion.Cast(sim, &bloodworm.Unit)
					return
				}
			}

			bloodworm.stackAura.Activate(sim)
			bloodworm.stackAura.AddStack(sim)
		},
	})
}

func (bloodworm *BloodwormPet) Reset(_ *core.Simulation) {
}

func (bloodworm *BloodwormPet) ExecuteCustomRotation(_ *core.Simulation) {
}

func (bloodworm *BloodwormPet) OnEncounterStart(sim *core.Simulation) {
	if bloodworm.IsActive() {
		bloodworm.Disable(sim)
	}
}

func (bloodworm *BloodwormPet) disable(sim *core.Simulation) {
	bloodworm.stackAura.Deactivate(sim)
}

func bloodwormStatInheritance(ownerStats stats.Stats) stats.Stats {
	return stats.Stats{
		stats.AttackPower:         ownerStats[stats.AttackPower] * 0.55,
		stats.HasteRating:         ownerStats[stats.HasteRating],
		stats.Health:              ownerStats[stats.Health] * 0.15,
		stats.PhysicalCritPercent: ownerStats[stats.PhysicalCritPercent],
	}
}
