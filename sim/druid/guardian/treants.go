package guardian

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
)

type GuardianTreant struct {
	core.Pet
}

func (bear *GuardianDruid) newTreant() *GuardianTreant {
	treant := &GuardianTreant{
		Pet: core.NewPet(core.PetConfig{
			Name:  "Treant",
			Owner: &bear.Character,

			StatInheritance: func(ownerStats stats.Stats) stats.Stats {
				combinedHitExp := 0.5 * (ownerStats[stats.HitRating] + ownerStats[stats.ExpertiseRating])

				return stats.Stats{
					stats.Health:              0.4 * ownerStats[stats.Health],
					stats.Armor:               4 * ownerStats[stats.Armor],
					stats.AttackPower:         1.2 * ownerStats[stats.AttackPower],
					stats.HitRating:           combinedHitExp,
					stats.ExpertiseRating:     combinedHitExp,
					stats.PhysicalCritPercent: ownerStats[stats.PhysicalCritPercent],
				}
			},

			HasDynamicMeleeSpeedInheritance: true,
		}),
	}

	// Auto-attack configuration
	treant.PseudoStats.DamageDealtMultiplier *= 0.2
	baseWeaponDamage := 3.20000004768 * bear.ClassSpellScaling

	treant.EnableAutoAttacks(treant, core.AutoAttackOptions{
		MainHand: core.Weapon{
			BaseDamageMin:        baseWeaponDamage,
			BaseDamageMax:        baseWeaponDamage,
			SwingSpeed:           2,
			NormalizedSwingSpeed: 2,
			CritMultiplier:       bear.DefaultCritMultiplier(),
			SpellSchool:          core.SpellSchoolPhysical,
		},

		AutoSwingMelee: true,
	})

	treant.OnPetEnable = func(sim *core.Simulation) {
		treant.AutoAttacks.PauseMeleeBy(sim, 500 * time.Millisecond)
	}

	bear.AddPet(treant)

	return treant
}

func (treant *GuardianTreant) Initialize() {}
func (treant *GuardianTreant) ExecuteCustomRotation(_ *core.Simulation) {}

func (treant *GuardianTreant) Reset(sim *core.Simulation) {
	treant.Disable(sim)
}

func (treant *GuardianTreant) GetPet() *core.Pet {
	return &treant.Pet
}

type GuardianTreants [3]*GuardianTreant

func (bear *GuardianDruid) registerTreants() {
	for idx := range bear.Treants {
		bear.Treants[idx] = bear.newTreant()
	}
}

func (treants *GuardianTreants) Enable(sim *core.Simulation) {
	for _, treant := range treants {
		treant.EnableWithTimeout(sim, treant, time.Second * 15)
		treant.ExtendGCDUntil(sim, sim.CurrentTime + time.Second * 15)
	}
}
