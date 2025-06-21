package shaman

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const (
	frostbrandEnchantID  int32 = 2
	flametongueEnchantID int32 = 5
	windfuryEnchantID    int32 = 283
	earthlivingEnchantID int32 = 3345
	rockbiterEnchantID   int32 = 3021
)

func (shaman *Shaman) RegisterOnItemSwapWithImbue(effectID int32, procMask *core.ProcMask, aura *core.Aura) {
	shaman.RegisterItemSwapCallback(core.AllWeaponSlots(), func(sim *core.Simulation, slot proto.ItemSlot) {
		mask := core.ProcMaskUnknown
		if shaman.MainHand().TempEnchant == effectID {
			mask |= core.ProcMaskMeleeMH
		}
		if shaman.OffHand().TempEnchant == effectID {
			mask |= core.ProcMaskMeleeOH
		}
		*procMask = mask

		if mask == core.ProcMaskUnknown {
			aura.Deactivate(sim)
		} else {
			aura.Activate(sim)
		}
	})
}

func (shaman *Shaman) newWindfuryImbueSpell(isMH bool) *core.Spell {
	apBonus := shaman.CalcScalingSpellDmg(5.0)

	tag := 1
	procMask := core.ProcMaskMeleeMHSpecial
	weaponDamageFunc := shaman.MHWeaponDamage
	if !isMH {
		tag = 2
		procMask = core.ProcMaskMeleeOHSpecial
		weaponDamageFunc = shaman.OHWeaponDamage
		apBonus *= 2 // applied after 50% offhand penalty
	}

	spellConfig := core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 8232, Tag: int32(tag)},
		SpellSchool:    core.SpellSchoolPhysical,
		ProcMask:       procMask,
		ClassSpellMask: SpellMaskWindfuryWeapon,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		CritMultiplier:   shaman.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: 1,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			mAP := spell.MeleeAttackPower() + apBonus

			baseDamage1 := weaponDamageFunc(sim, mAP)
			baseDamage2 := weaponDamageFunc(sim, mAP)
			baseDamage3 := weaponDamageFunc(sim, mAP)
			result1 := spell.CalcDamage(sim, target, baseDamage1, spell.OutcomeMeleeSpecialHitAndCrit)
			result2 := spell.CalcDamage(sim, target, baseDamage2, spell.OutcomeMeleeSpecialHitAndCrit)
			result3 := spell.CalcDamage(sim, target, baseDamage3, spell.OutcomeMeleeSpecialHitAndCrit)
			spell.DealDamage(sim, result1)
			spell.DealDamage(sim, result2)
			spell.DealDamage(sim, result3)
		},
	}

	return shaman.RegisterSpell(spellConfig)
}

func (shaman *Shaman) makeWFProcTriggerAura(dpm *core.DynamicProcManager, procMask *core.ProcMask, mhSpell *core.Spell, ohSpell *core.Spell) *core.Aura {
	icd := &core.Cooldown{
		Timer:    shaman.NewTimer(),
		Duration: time.Second * 3,
	}
	aura := shaman.RegisterAura(core.Aura{
		Label:    "Windfury Imbue",
		Icd:      icd,
		Dpm:      dpm,
		Duration: core.NeverExpires,
		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if !aura.Icd.IsReady(sim) || !result.Landed() || !spell.ProcMask.Matches(*procMask) || !dpm.Proc(sim, *procMask, "Windfury Imbue") {
				return
			}
			aura.Icd.Use(sim)
			if spell.IsMH() {
				mhSpell.Cast(sim, result.Target)
			} else {
				ohSpell.Cast(sim, result.Target)
			}
		},
		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			aura.Activate(sim)
		},
	})
	return aura
}

func (shaman *Shaman) getWindfuryFixedProcChance(procMask core.ProcMask) float64 {
	return core.TernaryFloat64(procMask == core.ProcMaskMelee, 0.36, 0.2)
}

func (shaman *Shaman) RegisterWindfuryImbue(procMask core.ProcMask) {
	if procMask == core.ProcMaskUnknown && !shaman.ItemSwap.IsEnabled() {
		return
	}

	mask := core.ProcMaskUnknown

	if shaman.SelfBuffs.ImbueMH == proto.ShamanImbue_WindfuryWeapon {
		shaman.MainHand().TempEnchant = windfuryEnchantID
		if shaman.ItemSwap.IsEnabled() {
			shaman.ItemSwap.AddTempEnchant(windfuryEnchantID, proto.ItemSlot_ItemSlotMainHand, false)
		}
		mask |= core.ProcMaskMeleeMH
	}
	if shaman.SelfBuffs.ImbueOH == proto.ShamanImbue_WindfuryWeapon {
		shaman.OffHand().TempEnchant = windfuryEnchantID
		if shaman.ItemSwap.IsEnabled() {
			shaman.ItemSwap.AddTempEnchant(windfuryEnchantID, proto.ItemSlot_ItemSlotOffHand, false)
		}
		mask |= core.ProcMaskMeleeOH
	}
	if shaman.ItemSwap.IsEnabled() {
		if mhSwap := shaman.ItemSwap.GetUnequippedItemBySlot(proto.ItemSlot_ItemSlotMainHand); mhSwap != nil && shaman.SelfBuffs.ImbueMHSwap == proto.ShamanImbue_WindfuryWeapon {
			mhSwap.TempEnchant = windfuryEnchantID
			shaman.ItemSwap.AddTempEnchant(windfuryEnchantID, proto.ItemSlot_ItemSlotMainHand, true)
		}
		if ohSwap := shaman.ItemSwap.GetUnequippedItemBySlot(proto.ItemSlot_ItemSlotOffHand); ohSwap != nil && shaman.SelfBuffs.ImbueOHSwap == proto.ShamanImbue_WindfuryWeapon {
			ohSwap.TempEnchant = windfuryEnchantID
			shaman.ItemSwap.AddTempEnchant(windfuryEnchantID, proto.ItemSlot_ItemSlotOffHand, true)
		}
	}

	dpm := shaman.NewDynamicLegacyProcForTempEnchant(windfuryEnchantID, 0, shaman.getWindfuryFixedProcChance)

	mhSpell := shaman.newWindfuryImbueSpell(true)
	ohSpell := shaman.newWindfuryImbueSpell(false)

	aura := shaman.makeWFProcTriggerAura(dpm, &mask, mhSpell, ohSpell)

	shaman.RegisterOnItemSwapWithImbue(windfuryEnchantID, &mask, aura)
}

func (shaman *Shaman) newFlametongueImbueSpell(weapon *core.Item) *core.Spell {
	return shaman.RegisterSpell(core.SpellConfig{
		ActionID:         core.ActionID{SpellID: int32(8024)},
		SpellSchool:      core.SpellSchoolFire,
		ProcMask:         core.ProcMaskSpellDamageProc,
		ClassSpellMask:   SpellMaskFlametongueWeapon,
		Flags:            core.SpellFlagPassiveSpell,
		DamageMultiplier: weapon.SwingSpeed / 2.6, //WIll be updated on item swap L188
		CritMultiplier:   shaman.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: 0.05799999833,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			if weapon.SwingSpeed != 0 {
				scalingDamage := shaman.CalcScalingSpellDmg(7.75)
				baseDamage := (scalingDamage/77 + scalingDamage/25) / 2
				spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
			}
		},
	})
}

func (shaman *Shaman) makeFTProcTriggerAura(itemSlot proto.ItemSlot, triggerProcMask core.ProcMask, flameTongueSpell *core.Spell) *core.Aura {
	aura := core.MakeProcTriggerAura(&shaman.Unit, core.ProcTrigger{
		Name:     fmt.Sprintf("Flametongue Imbue %s", itemSlot),
		ProcMask: triggerProcMask,
		Outcome:  core.OutcomeLanded,
		Callback: core.CallbackOnSpellHitDealt,
		Handler: func(sim *core.Simulation, _ *core.Spell, result *core.SpellResult) {
			flameTongueSpell.Cast(sim, result.Target)
		},
	})

	shaman.RegisterItemSwapCallback([]proto.ItemSlot{itemSlot}, func(sim *core.Simulation, is proto.ItemSlot) {
		if is == proto.ItemSlot_ItemSlotMainHand {
			mh := shaman.MainHand()
			mhSwap := shaman.ItemSwap.GetUnequippedItemBySlot(is)
			if mh.TempEnchant != flametongueEnchantID {
				aura.Deactivate(sim)
				return
			}
			if mhSwap.TempEnchant != flametongueEnchantID {
				aura.Activate(sim)
				return
			}
			flameTongueSpell.DamageMultiplier /= mhSwap.SwingSpeed
			flameTongueSpell.DamageMultiplier *= mh.SwingSpeed
		}
		if is == proto.ItemSlot_ItemSlotOffHand {
			oh := shaman.OffHand()
			ohSwap := shaman.ItemSwap.GetUnequippedItemBySlot(is)
			if oh.TempEnchant != flametongueEnchantID {
				aura.Deactivate(sim)
				return
			}
			if ohSwap.TempEnchant != flametongueEnchantID {
				aura.Activate(sim)
				return
			}
			if ohSwap.SwingSpeed != 0 {
				flameTongueSpell.DamageMultiplier /= ohSwap.SwingSpeed
			}
			if oh.SwingSpeed != 0 {
				flameTongueSpell.DamageMultiplier *= oh.SwingSpeed
			}

		}
	})

	return aura
}

func (shaman *Shaman) RegisterFlametongueImbue(procMask core.ProcMask) {
	if procMask == core.ProcMaskUnknown && !shaman.ItemSwap.IsEnabled() {
		return
	}

	magicDamageBonus := 1.07

	magicDamageAura := shaman.RegisterAura(core.Aura{
		Label:    "Flametongue Weapon",
		Duration: core.NeverExpires,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			shaman.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexFire] *= magicDamageBonus
			shaman.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexFrost] *= magicDamageBonus
			shaman.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexNature] *= magicDamageBonus
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			shaman.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexFire] /= magicDamageBonus
			shaman.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexFrost] /= magicDamageBonus
			shaman.PseudoStats.SchoolDamageDealtMultiplier[stats.SchoolIndexNature] /= magicDamageBonus
		},
		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			if shaman.MainHand().TempEnchant == flametongueEnchantID || shaman.OffHand().TempEnchant == flametongueEnchantID {
				aura.Activate(sim)
			}
		},
	})

	for _, itemSlot := range core.AllWeaponSlots() {
		var weapon *core.Item
		var triggerProcMask core.ProcMask
		switch {
		case shaman.SelfBuffs.ImbueMH == proto.ShamanImbue_FlametongueWeapon && itemSlot == proto.ItemSlot_ItemSlotMainHand:
			weapon = shaman.MainHand()
			triggerProcMask = core.ProcMaskMeleeMH | core.ProcMaskMeleeProc
		case shaman.SelfBuffs.ImbueOH == proto.ShamanImbue_FlametongueWeapon && itemSlot == proto.ItemSlot_ItemSlotOffHand:
			weapon = shaman.OffHand()
			triggerProcMask = core.ProcMaskMeleeOH
		}

		if weapon == nil {
			continue
		}

		weapon.TempEnchant = flametongueEnchantID

		if shaman.ItemSwap.IsEnabled() {
			shaman.ItemSwap.AddTempEnchant(flametongueEnchantID, itemSlot, false)
		}

		flameTongueSpell := shaman.newFlametongueImbueSpell(weapon)
		shaman.makeFTProcTriggerAura(itemSlot, triggerProcMask, flameTongueSpell)
	}

	if shaman.ItemSwap.IsEnabled() {
		if shaman.SelfBuffs.ImbueMHSwap == proto.ShamanImbue_FlametongueWeapon {
			shaman.ItemSwap.GetUnequippedItemBySlot(proto.ItemSlot_ItemSlotMainHand).TempEnchant = flametongueEnchantID
			shaman.ItemSwap.AddTempEnchant(flametongueEnchantID, proto.ItemSlot_ItemSlotMainHand, true)
		}
		if shaman.SelfBuffs.ImbueOHSwap == proto.ShamanImbue_FlametongueWeapon {
			shaman.ItemSwap.GetUnequippedItemBySlot(proto.ItemSlot_ItemSlotOffHand).TempEnchant = flametongueEnchantID
			shaman.ItemSwap.AddTempEnchant(flametongueEnchantID, proto.ItemSlot_ItemSlotOffHand, true)
		}
	}

	shaman.RegisterOnItemSwapWithImbue(flametongueEnchantID, &procMask, magicDamageAura)
}

func (shaman *Shaman) frostbrandDDBCHandler(sim *core.Simulation, spell *core.Spell, attackTable *core.AttackTable) float64 {
	return 1.0
}

func (shaman *Shaman) FrostbrandDebuffAura(target *core.Unit) *core.Aura {
	return target.GetOrRegisterAura(core.Aura{
		Label:    "Frostbrand Attack-" + shaman.Label,
		ActionID: core.ActionID{SpellID: 8034},
		Duration: time.Second * 8,
	}).AttachDDBC(DDBC_FrostbrandWeapon, DDBC_Total, &shaman.AttackTables, shaman.frostbrandDDBCHandler)
}

func (shaman *Shaman) newFrostbrandImbueSpell() *core.Spell {
	return shaman.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: 8033},
		SpellSchool:    core.SpellSchoolFrost,
		ClassSpellMask: SpellMaskFrostbrandWeapon,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		CritMultiplier:   shaman.DefaultCritMultiplier(),
		ThreatMultiplier: 1,
		BonusCoefficient: 0.10000000149,
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := shaman.CalcScalingSpellDmg(0.60900002718) //spell id 8034
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)
		},
	})
}

func (shaman *Shaman) RegisterFrostbrandImbue(procMask core.ProcMask) {
	if procMask == core.ProcMaskUnknown && !shaman.ItemSwap.IsEnabled() {
		return
	}

	if shaman.SelfBuffs.ImbueMH == proto.ShamanImbue_FrostbrandWeapon {
		shaman.MainHand().TempEnchant = frostbrandEnchantID
		if shaman.ItemSwap.IsEnabled() {
			shaman.ItemSwap.AddTempEnchant(frostbrandEnchantID, proto.ItemSlot_ItemSlotMainHand, false)
		}
	}
	if shaman.SelfBuffs.ImbueOH == proto.ShamanImbue_FrostbrandWeapon {
		shaman.OffHand().TempEnchant = frostbrandEnchantID
		if shaman.ItemSwap.IsEnabled() {
			shaman.ItemSwap.AddTempEnchant(frostbrandEnchantID, proto.ItemSlot_ItemSlotOffHand, false)
		}
	}
	if shaman.ItemSwap.IsEnabled() {
		if mhSwap := shaman.ItemSwap.GetUnequippedItemBySlot(proto.ItemSlot_ItemSlotMainHand); mhSwap != nil && shaman.SelfBuffs.ImbueMHSwap == proto.ShamanImbue_FrostbrandWeapon {
			mhSwap.TempEnchant = frostbrandEnchantID
			shaman.ItemSwap.AddTempEnchant(frostbrandEnchantID, proto.ItemSlot_ItemSlotMainHand, true)
		}
		if ohSwap := shaman.ItemSwap.GetUnequippedItemBySlot(proto.ItemSlot_ItemSlotOffHand); ohSwap != nil && shaman.SelfBuffs.ImbueOHSwap == proto.ShamanImbue_FrostbrandWeapon {
			ohSwap.TempEnchant = frostbrandEnchantID
			shaman.ItemSwap.AddTempEnchant(frostbrandEnchantID, proto.ItemSlot_ItemSlotOffHand, true)
		}
	}

	dpm := shaman.NewDynamicLegacyProcForTempEnchant(frostbrandEnchantID, 9.0, func(pm core.ProcMask) float64 { return 0 })

	fbSpell := shaman.newFrostbrandImbueSpell()

	fbDebuffAuras := shaman.NewEnemyAuraArray(shaman.FrostbrandDebuffAura)

	aura := core.MakeProcTriggerAura(&shaman.Unit, core.ProcTrigger{
		Name:     "Frostbrand Imbue",
		Callback: core.CallbackOnSpellHitDealt,
		Outcome:  core.OutcomeLanded,
		DPM:      dpm,
		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			fbSpell.Cast(sim, result.Target)
			fbDebuffAuras.Get(result.Target).Activate(sim)
		},
	})

	shaman.RegisterOnItemSwapWithImbue(frostbrandEnchantID, &procMask, aura)
}

/*func (shaman *Shaman) newEarthlivingImbueSpell() *core.Spell {

	return shaman.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 51730},
		SpellSchool: core.SpellSchoolNature,
		ProcMask:    core.ProcMaskEmpty,
		Flags:       core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Hot: core.DotConfig{
			Aura: core.Aura{
				Label:    "Earthliving",
				ActionID: core.ActionID{SpellID: 51945},
			},
			NumberOfTicks: 4,
			TickLength:    time.Second * 3,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, _ bool) {
				dot.SnapshotBaseDamage = (shaman.CalcScalingSpellDmg(0.57400000095) + (0.038 * dot.Spell.HealingPower(target)))
				dot.SnapshotAttackerMultiplier = dot.Spell.CasterHealingMultiplier()
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotHealing(sim, target, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Hot(target).Apply(sim)
		},
	})
}

func (shaman *Shaman) ApplyEarthlivingImbueToItem(item *core.Item) {
	enchantId := int32(3345)

	if item == nil || item.TempEnchant == enchantId {
		return
	}

	spBonus := 780.0

	newStats := stats.Stats{stats.SpellPower: spBonus}
	item.Stats = item.Stats.Add(newStats)
	item.TempEnchant = enchantId
}

func (shaman *Shaman) RegisterEarthlivingImbue(procMask core.ProcMask) {
	if procMask == core.ProcMaskEmpty && !shaman.ItemSwap.IsEnabled() {
		return
	}

	if procMask.Matches(core.ProcMaskMeleeMH) {
		shaman.ApplyEarthlivingImbueToItem(shaman.MainHand())
	}
	if procMask.Matches(core.ProcMaskMeleeOH) {
		shaman.ApplyEarthlivingImbueToItem(shaman.OffHand())
	}

	imbueSpell := shaman.newEarthlivingImbueSpell()

	shaman.RegisterAura(core.Aura{
		Label:    "Earthliving Imbue",
		Duration: core.NeverExpires,
		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			aura.Activate(sim)
		},
		OnHealDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell != shaman.ChainHeal && spell != shaman.HealingSurge && spell != shaman.HealingWave && spell != shaman.Riptide {
				return
			}

			if procMask.Matches(core.ProcMaskMeleeMH) && sim.RandomFloat("earthliving") < 0.2 {
				imbueSpell.Cast(sim, result.Target)
			}

			if procMask.Matches(core.ProcMaskMeleeOH) && sim.RandomFloat("earthliving") < 0.2 {
				imbueSpell.Cast(sim, result.Target)
			}
		},
	})

	// Currently Imbues are carried over on item swap
	// shaman.RegisterOnItemSwapWithImbue(3350, &procMask, aura)
}*/
