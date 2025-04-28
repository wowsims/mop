package hunter

import (
	"github.com/wowsims/mop/sim/core"
)

func (hunter *Hunter) registerArcaneShotSpell() {
	spellConfig := *hunter.SpellConfigFromProto(3044)

	spellConfig.ApplyEffects = func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		wepDmg := hunter.AutoAttacks.Ranged().CalculateNormalizedWeaponDamage(sim, spell.RangedAttackPower(target))
		minEffectSize, _ := spell.GetBaseDamage() // Second is spread so if set should roll
		baseDamage := wepDmg + minEffectSize

		result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeRangedHitAndCrit)

		spell.WaitTravelTime(sim, func(sim *core.Simulation) {
			spell.DealDamage(sim, result)
		})
	}
	hunter.ArcaneShot = hunter.RegisterSpell(spellConfig)
}
