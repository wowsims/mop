package monk

import (
	"github.com/wowsims/cata/sim/core"
	"github.com/wowsims/cata/sim/core/proto"
)

/*
// 103985 - Stance of the Fierce Tiger
// 108561 - 2H Staff equipped
// 115697 - Polearm equipped
// 120267 - Vengeance
// 124146 - Dual Wield

Monk weapon damage is calculated by combining main hand and off hand damage.
The following formula is embedded into all the tooltips for monk strikes:

$stnc=<basically Fierce Tiger stance modifier, handled by the stance spell>
$dwm1=$?a108561[${1}][${0.898882275}]
$dwm=$?a115697[${1}][${$<dwm1>}]
$bm=$?s120267[${0.4}][${1}]
$offm1=$?a108561[${0}][${1}]
$offm=$?a115697[${0}][${$<offm1>}]
$apc=$?s120267[${$AP/11}][${$AP/14}]
$offlow=$?!s124146[${$mwb/2/$mws}][${$owb/2/$ows}]
$offhigh=$?!s124146[${$MWB/2/$mws}][${$OWB/2/$ows}]
$low=${$<stnc>*($<bm>*$<dwm>*(($mwb)/($MWS)+$<offm>*$<offlow>)+$<apc>-1)}
$high=${$<stnc>*($<bm>*$<dwm>*(($MWB)/($MWS)+$<offm>*$<offhigh>)+$<apc>+1)}
*/
func (monk *Monk) CalculateMonkStrikeDamage(sim *core.Simulation, spell *core.Spell) float64 {
	totalDamage := 0.0
	ap := spell.MeleeAttackPower()

	staffOrPolearm := false
	hasMainHand := false
	mh := monk.MainHand()
	mhw := monk.WeaponFromMainHand(monk.MeleeCritMultiplier())
	if mh != nil && mh.WeaponType != proto.WeaponType_WeaponTypeUnknown {
		staffOrPolearm = mh.WeaponType == proto.WeaponType_WeaponTypeStaff || mh.WeaponType == proto.WeaponType_WeaponTypePolearm
		dmg := mhw.BaseDamage(sim) / mhw.SwingSpeed
		totalDamage += dmg
		hasMainHand = true

		if sim.Log != nil {
			monk.Log(sim, "[DEBUG] main hand weapon damage portion for %s: td=%0.3f, wd=%0.3f, ws=%0.3f",
				spell.ActionID, totalDamage, dmg, mhw.SwingSpeed, ap)
		}
	}

	hasOffHand := false
	oh := monk.OffHand()
	if oh != nil && oh.WeaponType != proto.WeaponType_WeaponTypeUnknown {
		ohw := monk.WeaponFromOffHand(monk.MeleeCritMultiplier())
		dmg := ohw.BaseDamage(sim) / ohw.SwingSpeed * 0.5
		totalDamage += dmg
		hasOffHand = true

		if sim.Log != nil {
			monk.Log(sim, "[DEBUG] off hand weapon damage portion for %s: td=%0.3f, wd=%0.3f, ws=%0.3f",
				spell.ActionID, totalDamage, dmg, ohw.SwingSpeed, ap)
		}
	}

	// When not wielding a staff or polearm, total damage is multiplied by 0.898882275.
	if !staffOrPolearm {
		totalDamage *= 0.898882275
	}

	apMod := 1.0 / core.DefaultAttackPowerPerDPS
	if monk.Spec == proto.Spec_SpecBrewmasterMonk {
		// Brewmaster monks does a flat 40% of total damage as well as AP per DPS being 11 instead of 14
		totalDamage *= 0.4
		apMod = 1.0 / 11.0
	}

	if !hasMainHand && !hasOffHand {
		// Unarmed
		totalDamage += mhw.CalculateWeaponDamage(sim, ap)
	} else {
		totalDamage += apMod * ap
	}

	if sim.Log != nil {
		monk.Log(sim, "[DEBUG] total weapon damage for %s: td=%0.3f, apmod=%0.3f, ap=%0.3f",
			spell.ActionID, totalDamage, apMod, ap)
	}

	return totalDamage
}
