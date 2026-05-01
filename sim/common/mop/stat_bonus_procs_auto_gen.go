package mop

import (
	"github.com/wowsims/mop/sim/common/shared"
	"github.com/wowsims/mop/sim/core"
)

func RegisterAllProcs() {

	// Procs

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Dreadplate Gauntlets (Season 12)",
	// 	ItemID:             84373,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Dragonhide Gloves (Season 12)",
	// 	ItemID:             84377,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Kodohide Gloves (Season 12)",
	// 	ItemID:             84385,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Wyrmhide Gloves (Season 12)",
	// 	ItemID:             84393,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Chain Gauntlets (Season 12)",
	// 	ItemID:             84409,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Silk Handguards (Season 12)",
	// 	ItemID:             84413,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Scaled Gauntlets (Season 12)",
	// 	ItemID:             84419,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Ornamented Gloves (Season 12)",
	// 	ItemID:             84430,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Mooncloth Gloves (Season 12)",
	// 	ItemID:             84440,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Satin Gloves (Season 12)",
	// 	ItemID:             84445,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Leather Gloves (Season 12)",
	// 	ItemID:             84463,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Ringmail Gauntlets (Season 12)",
	// 	ItemID:             84473,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Linked Gauntlets (Season 12)",
	// 	ItemID:             84478,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Mail Gauntlets (Season 12)",
	// 	ItemID:             84484,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Felweave Handguards (Season 12)",
	// 	ItemID:             84499,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Plate Gauntlets (Season 12)",
	// 	ItemID:             84505,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Ironskin Gloves (Season 12)",
	// 	ItemID:             84543,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dreadful Gladiator's Copperskin Gloves (Season 12)",
	// 	ItemID:             84548,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84830, ItemName: "Malevolent Gladiator's Leather Gloves (LFR) (Season 12)"},
	//	{ItemID: 85023, ItemName: "Malevolent Gladiator's Leather Gloves (Season 12 Elite)"},
	//	{ItemID: 91695, ItemName: "Malevolent Gladiator's Leather Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84831, ItemName: "Malevolent Gladiator's Ornamented Gloves (LFR) (Season 12)"},
	//	{ItemID: 85024, ItemName: "Malevolent Gladiator's Ornamented Gloves (Season 12 Elite)"},
	//	{ItemID: 91642, ItemName: "Malevolent Gladiator's Ornamented Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84832, ItemName: "Malevolent Gladiator's Dragonhide Gloves (LFR) (Season 12)"},
	//	{ItemID: 85025, ItemName: "Malevolent Gladiator's Dragonhide Gloves (Season 12 Elite)"},
	//	{ItemID: 91510, ItemName: "Malevolent Gladiator's Dragonhide Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84833, ItemName: "Malevolent Gladiator's Kodohide Gloves (LFR) (Season 12)"},
	//	{ItemID: 85026, ItemName: "Malevolent Gladiator's Kodohide Gloves (Season 12 Elite)"},
	//	{ItemID: 91525, ItemName: "Malevolent Gladiator's Kodohide Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84834, ItemName: "Malevolent Gladiator's Scaled Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85027, ItemName: "Malevolent Gladiator's Scaled Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91622, ItemName: "Malevolent Gladiator's Scaled Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84835, ItemName: "Malevolent Gladiator's Dreadplate Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85028, ItemName: "Malevolent Gladiator's Dreadplate Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91502, ItemName: "Malevolent Gladiator's Dreadplate Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84836, ItemName: "Malevolent Gladiator's Copperskin Gloves (LFR) (Season 12)"},
	//	{ItemID: 85015, ItemName: "Malevolent Gladiator's Copperskin Gloves (Season 12 Elite)"},
	//	{ItemID: 91610, ItemName: "Malevolent Gladiator's Copperskin Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84837, ItemName: "Malevolent Gladiator's Silk Handguards (LFR) (Season 12)"},
	//	{ItemID: 85016, ItemName: "Malevolent Gladiator's Silk Handguards (Season 12 Elite)"},
	//	{ItemID: 91585, ItemName: "Malevolent Gladiator's Silk Handguards (Season 13)"},
	//	{ItemID: 97839, ItemName: "Malevolent Gladiator's Silk Handguards (Season 12)"},
	//	{ItemID: 97929, ItemName: "Malevolent Gladiator's Silk Handguards (Season 12)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84838, ItemName: "Malevolent Gladiator's Satin Gloves (LFR) (Season 12)"},
	//	{ItemID: 85017, ItemName: "Malevolent Gladiator's Satin Gloves (Season 12 Elite)"},
	//	{ItemID: 91672, ItemName: "Malevolent Gladiator's Satin Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84839, ItemName: "Malevolent Gladiator's Ironskin Gloves (LFR) (Season 12)"},
	//	{ItemID: 85018, ItemName: "Malevolent Gladiator's Ironskin Gloves (Season 12 Elite)"},
	//	{ItemID: 91600, ItemName: "Malevolent Gladiator's Ironskin Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84840, ItemName: "Malevolent Gladiator's Plate Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85019, ItemName: "Malevolent Gladiator's Plate Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91785, ItemName: "Malevolent Gladiator's Plate Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84841, ItemName: "Malevolent Gladiator's Chain Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85020, ItemName: "Malevolent Gladiator's Chain Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91577, ItemName: "Malevolent Gladiator's Chain Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84842, ItemName: "Malevolent Gladiator's Felweave Handguards (LFR) (Season 12)"},
	//	{ItemID: 85021, ItemName: "Malevolent Gladiator's Felweave Handguards (Season 12 Elite)"},
	//	{ItemID: 91773, ItemName: "Malevolent Gladiator's Felweave Handguards (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84843, ItemName: "Malevolent Gladiator's Wyrmhide Gloves (LFR) (Season 12)"},
	//	{ItemID: 85022, ItemName: "Malevolent Gladiator's Wyrmhide Gloves (Season 12 Elite)"},
	//	{ItemID: 91542, ItemName: "Malevolent Gladiator's Wyrmhide Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84844, ItemName: "Malevolent Gladiator's Linked Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85011, ItemName: "Malevolent Gladiator's Linked Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91723, ItemName: "Malevolent Gladiator's Linked Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84845, ItemName: "Malevolent Gladiator's Mail Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85012, ItemName: "Malevolent Gladiator's Mail Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91735, ItemName: "Malevolent Gladiator's Mail Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84846, ItemName: "Malevolent Gladiator's Mooncloth Gloves (LFR) (Season 12)"},
	//	{ItemID: 85013, ItemName: "Malevolent Gladiator's Mooncloth Gloves (Season 12 Elite)"},
	//	{ItemID: 91662, ItemName: "Malevolent Gladiator's Mooncloth Gloves (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 84847, ItemName: "Malevolent Gladiator's Ringmail Gauntlets (LFR) (Season 12)"},
	//	{ItemID: 85014, ItemName: "Malevolent Gladiator's Ringmail Gauntlets (Season 12 Elite)"},
	//	{ItemID: 91713, ItemName: "Malevolent Gladiator's Ringmail Gauntlets (Season 13)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// https://www.wowhead.com/mop/spell=132602
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 86227, ItemName: "Kri'tak, Imperial Scepter of the Swarm (N)"},
	//	{ItemID: 86865, ItemName: "Kri'tak, Imperial Scepter of the Swarm (LFR) (Celestial)"},
	//	{ItemID: 86990, ItemName: "Kri'tak, Imperial Scepter of the Swarm (H)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// https://www.wowhead.com/mop/spell=132602
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 86335, ItemName: "Jin'ya, Orb of the Waterspeaker (N)"},
	//	{ItemID: 86893, ItemName: "Jin'ya, Orb of the Waterspeaker (LFR) (Celestial)"},
	//	{ItemID: 87170, ItemName: "Jin'ya, Orb of the Waterspeaker (H)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Whenever you kill an enemy that rewards experience, you gain Bloodseeker's Fury, granting you 80 Agility
	// for 2min. Stacks up to 10 times.
	// https://www.wowhead.com/mop/spell=128896
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Bloodsoaked Chitin Fragment",
	// 	ItemID:             86525,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases your movement speed by 10% while in Dread Wastes.
	// https://www.wowhead.com/mop/spell=128887
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Swarmkeeper's Medallion",
	// 	ItemID:             86526,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your pet's attacks have a chance to deal an additional 50% damage as Nature, but no more than 0.
	// https://www.wowhead.com/mop/spell=128853
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Manipulator's Talisman",
	// 	ItemID:             86529,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Gladiator's Ironskin Gloves (Season 12)",
	// 	ItemID:             88171,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Gladiator's Copperskin Gloves (Season 12)",
	// 	ItemID:             88176,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Throw a bomb at the target, dealing 20074 Fire Damage upon impact to all enemies within 40 yards.
	// https://www.wowhead.com/mop/spell=128365
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Ban's Bag of Bombs",
	// 	ItemID:             88583,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your attacks have a chance to inflict your target with mantid poison, dealing 882 damage every 0.0 sec
	// for 6s.
	// https://www.wowhead.com/mop/spell=128386
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Dislodged Stinger",
	// 	ItemID:             88585,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Deals 1 Fire damage to your current target.
	// https://www.wowhead.com/mop/spell=128191
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Nurong's Gun",
	// 	ItemID:             88590,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Place a Mogu Rune of Paralysis on the ground for 1min, which will stun the next creature that enters it
	// for 4s.
	// https://www.wowhead.com/mop/spell=129554
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Mogu Rune of Paralysis",
	// 	ItemID:             89232,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// https://www.wowhead.com/mop/spell=130484
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Quilen Statuette",
	// 	ItemID:             89611,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91149, ItemName: "Tyrannical Gladiator's Dreadplate Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91150, ItemName: "Tyrannical Gladiator's Dreadplate Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94364, ItemName: "Tyrannical Gladiator's Dreadplate Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99807, ItemName: "Tyrannical Gladiator's Dreadplate Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100034, ItemName: "Tyrannical Gladiator's Dreadplate Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91157, ItemName: "Tyrannical Gladiator's Dragonhide Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91158, ItemName: "Tyrannical Gladiator's Dragonhide Gloves (Season 13 Elite)"},
	//	{ItemID: 94455, ItemName: "Tyrannical Gladiator's Dragonhide Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99811, ItemName: "Tyrannical Gladiator's Dragonhide Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100125, ItemName: "Tyrannical Gladiator's Dragonhide Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91172, ItemName: "Tyrannical Gladiator's Kodohide Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91173, ItemName: "Tyrannical Gladiator's Kodohide Gloves (Season 13 Elite)"},
	//	{ItemID: 94371, ItemName: "Tyrannical Gladiator's Kodohide Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99819, ItemName: "Tyrannical Gladiator's Kodohide Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100041, ItemName: "Tyrannical Gladiator's Kodohide Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91189, ItemName: "Tyrannical Gladiator's Wyrmhide Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91190, ItemName: "Tyrannical Gladiator's Wyrmhide Gloves (Season 13 Elite)"},
	//	{ItemID: 94412, ItemName: "Tyrannical Gladiator's Wyrmhide Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99828, ItemName: "Tyrannical Gladiator's Wyrmhide Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100082, ItemName: "Tyrannical Gladiator's Wyrmhide Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91224, ItemName: "Tyrannical Gladiator's Chain Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91225, ItemName: "Tyrannical Gladiator's Chain Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94453, ItemName: "Tyrannical Gladiator's Chain Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99848, ItemName: "Tyrannical Gladiator's Chain Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100123, ItemName: "Tyrannical Gladiator's Chain Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91232, ItemName: "Tyrannical Gladiator's Silk Handguards (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91233, ItemName: "Tyrannical Gladiator's Silk Handguards (Season 13 Elite)"},
	//	{ItemID: 94451, ItemName: "Tyrannical Gladiator's Silk Handguards (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99852, ItemName: "Tyrannical Gladiator's Silk Handguards (Season 14) (Alliance)"},
	//	{ItemID: 100121, ItemName: "Tyrannical Gladiator's Silk Handguards (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91247, ItemName: "Tyrannical Gladiator's Ironskin Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91248, ItemName: "Tyrannical Gladiator's Ironskin Gloves (Season 13 Elite)"},
	//	{ItemID: 94391, ItemName: "Tyrannical Gladiator's Ironskin Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99860, ItemName: "Tyrannical Gladiator's Ironskin Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100061, ItemName: "Tyrannical Gladiator's Ironskin Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91257, ItemName: "Tyrannical Gladiator's Copperskin Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91258, ItemName: "Tyrannical Gladiator's Copperskin Gloves (Season 13 Elite)"},
	//	{ItemID: 94340, ItemName: "Tyrannical Gladiator's Copperskin Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99865, ItemName: "Tyrannical Gladiator's Copperskin Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100010, ItemName: "Tyrannical Gladiator's Copperskin Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91269, ItemName: "Tyrannical Gladiator's Scaled Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91270, ItemName: "Tyrannical Gladiator's Scaled Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94343, ItemName: "Tyrannical Gladiator's Scaled Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99871, ItemName: "Tyrannical Gladiator's Scaled Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100013, ItemName: "Tyrannical Gladiator's Scaled Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91289, ItemName: "Tyrannical Gladiator's Ornamented Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91290, ItemName: "Tyrannical Gladiator's Ornamented Gloves (Season 13 Elite)"},
	//	{ItemID: 94438, ItemName: "Tyrannical Gladiator's Ornamented Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99882, ItemName: "Tyrannical Gladiator's Ornamented Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100108, ItemName: "Tyrannical Gladiator's Ornamented Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91309, ItemName: "Tyrannical Gladiator's Mooncloth Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91310, ItemName: "Tyrannical Gladiator's Mooncloth Gloves (Season 13 Elite)"},
	//	{ItemID: 94328, ItemName: "Tyrannical Gladiator's Mooncloth Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99893, ItemName: "Tyrannical Gladiator's Mooncloth Gloves (Season 14) (Alliance)"},
	//	{ItemID: 99989, ItemName: "Tyrannical Gladiator's Mooncloth Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91319, ItemName: "Tyrannical Gladiator's Satin Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91320, ItemName: "Tyrannical Gladiator's Satin Gloves (Season 13 Elite)"},
	//	{ItemID: 94423, ItemName: "Tyrannical Gladiator's Satin Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99898, ItemName: "Tyrannical Gladiator's Satin Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100093, ItemName: "Tyrannical Gladiator's Satin Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91342, ItemName: "Tyrannical Gladiator's Leather Gloves (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91343, ItemName: "Tyrannical Gladiator's Leather Gloves (Season 13 Elite)"},
	//	{ItemID: 94377, ItemName: "Tyrannical Gladiator's Leather Gloves (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99907, ItemName: "Tyrannical Gladiator's Leather Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100047, ItemName: "Tyrannical Gladiator's Leather Gloves (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91360, ItemName: "Tyrannical Gladiator's Ringmail Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91361, ItemName: "Tyrannical Gladiator's Ringmail Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94490, ItemName: "Tyrannical Gladiator's Ringmail Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99917, ItemName: "Tyrannical Gladiator's Ringmail Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100160, ItemName: "Tyrannical Gladiator's Ringmail Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91370, ItemName: "Tyrannical Gladiator's Linked Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91371, ItemName: "Tyrannical Gladiator's Linked Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94458, ItemName: "Tyrannical Gladiator's Linked Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99922, ItemName: "Tyrannical Gladiator's Linked Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100128, ItemName: "Tyrannical Gladiator's Linked Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91382, ItemName: "Tyrannical Gladiator's Mail Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91383, ItemName: "Tyrannical Gladiator's Mail Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94408, ItemName: "Tyrannical Gladiator's Mail Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99928, ItemName: "Tyrannical Gladiator's Mail Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100078, ItemName: "Tyrannical Gladiator's Mail Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91420, ItemName: "Tyrannical Gladiator's Felweave Handguards (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91421, ItemName: "Tyrannical Gladiator's Felweave Handguards (Season 13 Elite)"},
	//	{ItemID: 94441, ItemName: "Tyrannical Gladiator's Felweave Handguards (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99952, ItemName: "Tyrannical Gladiator's Felweave Handguards (Season 14) (Alliance)"},
	//	{ItemID: 100111, ItemName: "Tyrannical Gladiator's Felweave Handguards (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 91432, ItemName: "Tyrannical Gladiator's Plate Gauntlets (LFR) (Season 13) (Alliance)"},
	//	{ItemID: 91433, ItemName: "Tyrannical Gladiator's Plate Gauntlets (Season 13 Elite)"},
	//	{ItemID: 94331, ItemName: "Tyrannical Gladiator's Plate Gauntlets (LFR) (Season 13) (Horde)"},
	//	{ItemID: 99958, ItemName: "Tyrannical Gladiator's Plate Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 99992, ItemName: "Tyrannical Gladiator's Plate Gauntlets (Season 14) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Dreadplate Gauntlets",
	// 	ItemID:             93454,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Dragonhide Gloves",
	// 	ItemID:             93458,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Kodohide Gloves",
	// 	ItemID:             93466,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Wyrmhide Gloves",
	// 	ItemID:             93475,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Chain Gauntlets",
	// 	ItemID:             93495,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Silk Handguards",
	// 	ItemID:             93499,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Ironskin Gloves",
	// 	ItemID:             93507,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Gladiator's Ironskin Gloves (Season 12)",
	// 	ItemID:             93508,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Copperskin Gloves",
	// 	ItemID:             93517,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Gladiator's Copperskin Gloves (Season 12)",
	// 	ItemID:             93518,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Scaled Gauntlets",
	// 	ItemID:             93528,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Ornamented Gloves",
	// 	ItemID:             93539,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Mooncloth Gloves",
	// 	ItemID:             93550,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Satin Gloves",
	// 	ItemID:             93555,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Leather Gloves",
	// 	ItemID:             93570,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Ringmail Gauntlets",
	// 	ItemID:             93580,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Linked Gauntlets",
	// 	ItemID:             93585,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Mail Gauntlets",
	// 	ItemID:             93591,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Felweave Handguards",
	// 	ItemID:             93615,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Dreadful Gladiator's Plate Gauntlets",
	// 	ItemID:             93621,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your helpful spells have a chance to grant you a Blessing of Zuldazar, which stacks up to 6 times. (Approximately
	// 2.89 procs per minute)
	// https://www.wowhead.com/mop/spell=138967
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 94525, ItemName: "Stolen Relic of Zuldazar (N)"},
	//	{ItemID: 95763, ItemName: "Stolen Relic of Zuldazar (LFR) (Celestial)"},
	//	{ItemID: 96135, ItemName: "Stolen Relic of Zuldazar (Thunderforged)"},
	//	{ItemID: 96507, ItemName: "Stolen Relic of Zuldazar (H)"},
	//	{ItemID: 96879, ItemName: "Stolen Relic of Zuldazar (Heroic Thunderforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Consumes all Blessings of Zuldazar to shield the target, absorbing 1000 damage per Blessing consumed.
	// Lasts 15s.
	// https://www.wowhead.com/mop/spell=138925
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 94525, ItemName: "Stolen Relic of Zuldazar (N)"},
	//	{ItemID: 95763, ItemName: "Stolen Relic of Zuldazar (LFR) (Celestial)"},
	//	{ItemID: 96135, ItemName: "Stolen Relic of Zuldazar (Thunderforged)"},
	//	{ItemID: 96507, ItemName: "Stolen Relic of Zuldazar (H)"},
	//	{ItemID: 96879, ItemName: "Stolen Relic of Zuldazar (Heroic Thunderforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your healing spells have a chance to grant you Infinite Power. Once you have accumulated 6 Infinite Power,
	// you will instantly heal the most injured nearby party member for 10387. (Approximately 5.78 procs per
	// minute)
	// https://www.wowhead.com/mop/spell=139190
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 94530, ItemName: "Lightning-Imbued Chalice (N)"},
	//	{ItemID: 95817, ItemName: "Lightning-Imbued Chalice (LFR) (Celestial)"},
	//	{ItemID: 96189, ItemName: "Lightning-Imbued Chalice (Thunderforged)"},
	//	{ItemID: 96561, ItemName: "Lightning-Imbued Chalice (H)"},
	//	{ItemID: 96933, ItemName: "Lightning-Imbued Chalice (Heroic Thunderforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Let the Frostscythe's chill flow through you.
	// https://www.wowhead.com/mop/spell=46643
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Frostscythe of Lord Ahune",
	// 	ItemID:             95426,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Dreadplate Gauntlets",
	// 	ItemID:             98785,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Dragonhide Gloves",
	// 	ItemID:             98789,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Kodohide Gloves",
	// 	ItemID:             98797,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Wyrmhide Gloves",
	// 	ItemID:             98805,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Chain Gauntlets",
	// 	ItemID:             98821,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Silk Handguards",
	// 	ItemID:             98825,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Ironskin Gloves",
	// 	ItemID:             98833,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Copperskin Gloves",
	// 	ItemID:             98838,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Scaled Gauntlets",
	// 	ItemID:             98844,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Ornamented Gloves",
	// 	ItemID:             98855,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Mooncloth Gloves",
	// 	ItemID:             98865,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Satin Gloves",
	// 	ItemID:             98870,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Leather Gloves",
	// 	ItemID:             98885,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Ringmail Gauntlets",
	// 	ItemID:             98895,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Linked Gauntlets",
	// 	ItemID:             98900,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Mail Gauntlets",
	// 	ItemID:             98906,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Felweave Handguards",
	// 	ItemID:             98921,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Crafted Malevolent Gladiator's Plate Gauntlets",
	// 	ItemID:             98927,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100245, ItemName: "Grievous Gladiator's Dreadplate Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100594, ItemName: "Grievous Gladiator's Dreadplate Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102847, ItemName: "Grievous Gladiator's Dreadplate Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103180, ItemName: "Grievous Gladiator's Dreadplate Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100253, ItemName: "Grievous Gladiator's Dragonhide Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100685, ItemName: "Grievous Gladiator's Dragonhide Gloves (Season 14) (Horde)"},
	//	{ItemID: 102936, ItemName: "Grievous Gladiator's Dragonhide Gloves (Season 15) (Horde)"},
	//	{ItemID: 103184, ItemName: "Grievous Gladiator's Dragonhide Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100268, ItemName: "Grievous Gladiator's Kodohide Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100601, ItemName: "Grievous Gladiator's Kodohide Gloves (Season 14) (Horde)"},
	//	{ItemID: 102854, ItemName: "Grievous Gladiator's Kodohide Gloves (Season 15) (Horde)"},
	//	{ItemID: 103192, ItemName: "Grievous Gladiator's Kodohide Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100285, ItemName: "Grievous Gladiator's Wyrmhide Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100642, ItemName: "Grievous Gladiator's Wyrmhide Gloves (Season 14) (Horde)"},
	//	{ItemID: 102893, ItemName: "Grievous Gladiator's Wyrmhide Gloves (Season 15) (Horde)"},
	//	{ItemID: 103201, ItemName: "Grievous Gladiator's Wyrmhide Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100320, ItemName: "Grievous Gladiator's Chain Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100683, ItemName: "Grievous Gladiator's Chain Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102934, ItemName: "Grievous Gladiator's Chain Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103220, ItemName: "Grievous Gladiator's Chain Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100328, ItemName: "Grievous Gladiator's Silk Handguards (Season 14) (Alliance)"},
	//	{ItemID: 100681, ItemName: "Grievous Gladiator's Silk Handguards (Season 14) (Horde)"},
	//	{ItemID: 102932, ItemName: "Grievous Gladiator's Silk Handguards (Season 15) (Horde)"},
	//	{ItemID: 103224, ItemName: "Grievous Gladiator's Silk Handguards (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100343, ItemName: "Grievous Gladiator's Ironskin Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100621, ItemName: "Grievous Gladiator's Ironskin Gloves (Season 14) (Horde)"},
	//	{ItemID: 102872, ItemName: "Grievous Gladiator's Ironskin Gloves (Season 15) (Horde)"},
	//	{ItemID: 103232, ItemName: "Grievous Gladiator's Ironskin Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100353, ItemName: "Grievous Gladiator's Copperskin Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100570, ItemName: "Grievous Gladiator's Copperskin Gloves (Season 14) (Horde)"},
	//	{ItemID: 102824, ItemName: "Grievous Gladiator's Copperskin Gloves (Season 15) (Horde)"},
	//	{ItemID: 103237, ItemName: "Grievous Gladiator's Copperskin Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100365, ItemName: "Grievous Gladiator's Scaled Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100573, ItemName: "Grievous Gladiator's Scaled Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102827, ItemName: "Grievous Gladiator's Scaled Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103243, ItemName: "Grievous Gladiator's Scaled Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100385, ItemName: "Grievous Gladiator's Ornamented Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100668, ItemName: "Grievous Gladiator's Ornamented Gloves (Season 14) (Horde)"},
	//	{ItemID: 102919, ItemName: "Grievous Gladiator's Ornamented Gloves (Season 15) (Horde)"},
	//	{ItemID: 103254, ItemName: "Grievous Gladiator's Ornamented Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100405, ItemName: "Grievous Gladiator's Mooncloth Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100558, ItemName: "Grievous Gladiator's Mooncloth Gloves (Season 14) (Horde)"},
	//	{ItemID: 102812, ItemName: "Grievous Gladiator's Mooncloth Gloves (Season 15) (Horde)"},
	//	{ItemID: 103265, ItemName: "Grievous Gladiator's Mooncloth Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100415, ItemName: "Grievous Gladiator's Satin Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100653, ItemName: "Grievous Gladiator's Satin Gloves (Season 14) (Horde)"},
	//	{ItemID: 102904, ItemName: "Grievous Gladiator's Satin Gloves (Season 15) (Horde)"},
	//	{ItemID: 103270, ItemName: "Grievous Gladiator's Satin Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100432, ItemName: "Grievous Gladiator's Leather Gloves (Season 14) (Alliance)"},
	//	{ItemID: 100607, ItemName: "Grievous Gladiator's Leather Gloves (Season 14) (Horde)"},
	//	{ItemID: 102860, ItemName: "Grievous Gladiator's Leather Gloves (Season 15) (Horde)"},
	//	{ItemID: 103279, ItemName: "Grievous Gladiator's Leather Gloves (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100450, ItemName: "Grievous Gladiator's Ringmail Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100720, ItemName: "Grievous Gladiator's Ringmail Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102971, ItemName: "Grievous Gladiator's Ringmail Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103289, ItemName: "Grievous Gladiator's Ringmail Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100460, ItemName: "Grievous Gladiator's Linked Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100688, ItemName: "Grievous Gladiator's Linked Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102939, ItemName: "Grievous Gladiator's Linked Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103294, ItemName: "Grievous Gladiator's Linked Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100472, ItemName: "Grievous Gladiator's Mail Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100638, ItemName: "Grievous Gladiator's Mail Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102889, ItemName: "Grievous Gladiator's Mail Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103300, ItemName: "Grievous Gladiator's Mail Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100510, ItemName: "Grievous Gladiator's Felweave Handguards (Season 14) (Alliance)"},
	//	{ItemID: 100671, ItemName: "Grievous Gladiator's Felweave Handguards (Season 14) (Horde)"},
	//	{ItemID: 102922, ItemName: "Grievous Gladiator's Felweave Handguards (Season 15) (Horde)"},
	//	{ItemID: 103323, ItemName: "Grievous Gladiator's Felweave Handguards (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 100522, ItemName: "Grievous Gladiator's Plate Gauntlets (Season 14) (Alliance)"},
	//	{ItemID: 100561, ItemName: "Grievous Gladiator's Plate Gauntlets (Season 14) (Horde)"},
	//	{ItemID: 102815, ItemName: "Grievous Gladiator's Plate Gauntlets (Season 15) (Horde)"},
	//	{ItemID: 103329, ItemName: "Grievous Gladiator's Plate Gauntlets (Season 15) (Alliance)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your healing spells have a chance to grant 5700 mana. ( 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126467
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Springrain Idol of Wisdom",
	// 	ItemID:             101038,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your healing spells have a chance to grant 5700 mana. ( 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126467
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Mistdancer Idol of Wisdom",
	// 	ItemID:             101102,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your healing spells have a chance to grant 5700 mana. ( 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126467
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Sunsoul Idol of Wisdom",
	// 	ItemID:             101135,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your healing spells have a chance to grant 5700 mana. ( 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126467
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Communal Idol of Wisdom",
	// 	ItemID:             101179,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your healing spells have a chance to grant 5700 mana. ( 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126467
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Streamtalker Idol of Wisdom",
	// 	ItemID:             101247,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your helpful spells have a chance to grant you Spirit of Chi-Ji, increasing all healing done by 5% and
	// causing all overhealing on players to be redistributed to up to 5 nearby injured friends, for 10s. (Approximately
	// 0.58 procs per minute)
	// https://www.wowhead.com/mop/spell=146200
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Jina-Kang, Kindness of Chi-Ji",
	// 	ItemID:             102247,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your heals have a 0.1% chance to trigger Multistrike, which causes instant additional healing to your
	// target equal to 33% of the original healing done.
	// https://www.wowhead.com/mop/spell=146176
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102294, ItemName: "Nazgrim's Burnished Insignia - Intellect (N)"},
	//	{ItemID: 104553, ItemName: "Nazgrim's Burnished Insignia - Intellect (H)"},
	//	{ItemID: 104802, ItemName: "Nazgrim's Burnished Insignia - Intellect (Flexible)"},
	//	{ItemID: 105051, ItemName: "Nazgrim's Burnished Insignia - Intellect (LFR) (Celestial)"},
	//	{ItemID: 105300, ItemName: "Nazgrim's Burnished Insignia - Intellect (Warforged)"},
	//	{ItemID: 105549, ItemName: "Nazgrim's Burnished Insignia - Intellect (Heroic Warforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces damage taken from creature area of effect attacks by 2585% for 15s.
	// https://www.wowhead.com/mop/spell=146343
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102296, ItemName: "Rook's Unlucky Talisman (N)"},
	//	{ItemID: 104442, ItemName: "Rook's Unlucky Talisman (H)"},
	//	{ItemID: 104691, ItemName: "Rook's Unlucky Talisman (Flexible)"},
	//	{ItemID: 104940, ItemName: "Rook's Unlucky Talisman (LFR) (Celestial)"},
	//	{ItemID: 105189, ItemName: "Rook's Unlucky Talisman (Warforged)"},
	//	{ItemID: 105438, ItemName: "Rook's Unlucky Talisman (Heroic Warforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your heals have a 0.01% chance to Cleave, dealing the same healing to up to 5 other nearby targets.
	// https://www.wowhead.com/mop/spell=148233
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102304, ItemName: "Thok's Acid-Grooved Tooth - Intellect (N)"},
	//	{ItemID: 104611, ItemName: "Thok's Acid-Grooved Tooth - Intellect (H)"},
	//	{ItemID: 104860, ItemName: "Thok's Acid-Grooved Tooth - Intellect (Flexible)"},
	//	{ItemID: 105109, ItemName: "Thok's Acid-Grooved Tooth - Intellect (LFR) (Celestial)"},
	//	{ItemID: 105358, ItemName: "Thok's Acid-Grooved Tooth - Intellect (Warforged)"},
	//	{ItemID: 105607, ItemName: "Thok's Acid-Grooved Tooth - Intellect (Heroic Warforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102615, ItemName: "Prideful Gladiator's Mooncloth Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103462, ItemName: "Prideful Gladiator's Mooncloth Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the rage cost of your Hamstring ability by -3.0.
	// https://www.wowhead.com/mop/spell=22778
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102618, ItemName: "Prideful Gladiator's Plate Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103526, ItemName: "Prideful Gladiator's Plate Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102627, ItemName: "Prideful Gladiator's Copperskin Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103434, ItemName: "Prideful Gladiator's Copperskin Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Judgment by 10 yards.
	// https://www.wowhead.com/mop/spell=61776
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102630, ItemName: "Prideful Gladiator's Scaled Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103440, ItemName: "Prideful Gladiator's Scaled Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Your Chains of Ice ability now generates an additional 10 Runic Power.
	// https://www.wowhead.com/mop/spell=62458
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102650, ItemName: "Prideful Gladiator's Dreadplate Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103377, ItemName: "Prideful Gladiator's Dreadplate Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102657, ItemName: "Prideful Gladiator's Kodohide Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103389, ItemName: "Prideful Gladiator's Kodohide Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the healing you receive from Recuperate by 1% every 3.0 sec.
	// https://www.wowhead.com/mop/spell=61249
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102663, ItemName: "Prideful Gladiator's Leather Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103476, ItemName: "Prideful Gladiator's Leather Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// All snare effects will be cleared upon using Roll, Chi Torpedo or Flying Serpent Kick.
	// https://www.wowhead.com/mop/spell=124489
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102675, ItemName: "Prideful Gladiator's Ironskin Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103429, ItemName: "Prideful Gladiator's Ironskin Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102692, ItemName: "Prideful Gladiator's Mail Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103497, ItemName: "Prideful Gladiator's Mail Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the range of your Cyclone spell by 5 yards.
	// https://www.wowhead.com/mop/spell=33830
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102696, ItemName: "Prideful Gladiator's Wyrmhide Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103398, ItemName: "Prideful Gladiator's Wyrmhide Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Psychic Scream ability by 3 sec.
	// https://www.wowhead.com/mop/spell=44297
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102707, ItemName: "Prideful Gladiator's Satin Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103467, ItemName: "Prideful Gladiator's Satin Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the critical effect chance of your Flash of Light by 2%.
	// https://www.wowhead.com/mop/spell=38522
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102722, ItemName: "Prideful Gladiator's Ornamented Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103451, ItemName: "Prideful Gladiator's Ornamented Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown on your Demonic Circle: Teleport spell by 5 sec.
	// https://www.wowhead.com/mop/spell=33063
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102725, ItemName: "Prideful Gladiator's Felweave Handguards (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103520, ItemName: "Prideful Gladiator's Felweave Handguards (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the global cooldown triggered by Blink by 0.5 sec.
	// https://www.wowhead.com/mop/spell=44301
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102735, ItemName: "Prideful Gladiator's Silk Handguards (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103421, ItemName: "Prideful Gladiator's Silk Handguards (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces the cooldown of your Traps and Black Arrow by -2.0 seconds.
	// https://www.wowhead.com/mop/spell=61255
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102737, ItemName: "Prideful Gladiator's Chain Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103417, ItemName: "Prideful Gladiator's Chain Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Increases the damage done by Maim by 100% and increases the duration of Bear Hug by 1 sec.
	// https://www.wowhead.com/mop/spell=61252
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102739, ItemName: "Prideful Gladiator's Dragonhide Gloves (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103381, ItemName: "Prideful Gladiator's Dragonhide Gloves (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102742, ItemName: "Prideful Gladiator's Linked Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103491, ItemName: "Prideful Gladiator's Linked Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Improves the range of your Shock and Wind Shear spells by 5 yards.
	// https://www.wowhead.com/mop/spell=32973
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           core.CallbackEmpty,
	//	ProcMask:           core.ProcMaskUnknown,
	//	Outcome:            core.OutcomeEmpty,
	//	RequireDamageDealt: false
	// }, []shared.ItemVariant{
	//	{ItemID: 102774, ItemName: "Prideful Gladiator's Ringmail Gauntlets (LFR) (Season 15) (Alliance)"},
	//	{ItemID: 103486, ItemName: "Prideful Gladiator's Ringmail Gauntlets (LFR) (Season 15) (Horde)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// May cause extra gold to drop whenever you kill a target that yields experience or honor.
	// https://www.wowhead.com/mop/spell=148557
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Golden Moss",
	// 	ItemID:             104313,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// https://www.wowhead.com/mop/spell=148596
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "Captain Zvezdan's Lost Leg",
	// 	ItemID:             104321,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Let the Horseman laugh through you.
	// https://www.wowhead.com/mop/spell=43873
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "The Horseman's Horrific Hood",
	// 	ItemID:             263014,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Summon Pumpkin Soldiers to burn your foes.
	// https://www.wowhead.com/mop/spell=50070
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	// 	Name:               "The Horseman's Sinister Slicer",
	// 	ItemID:             263018,
	// 	Callback:           core.CallbackEmpty,
	// 	ProcMask:           core.ProcMaskUnknown,
	// 	Outcome:            core.OutcomeEmpty,
	// 	RequireDamageDealt: false,
	// })

	// Your melee attacks have a chance to grant Blessing of the Celestials, increasing your Strength by 3027
	// for 15s. ( 20% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=128986
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Relic of Xuen - Strength",
		ItemID:             79327,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskMeleeProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// When you deliver a melee or ranged critical strike, you have a chance to gain Blessing of the Celestials,
	// increasing your Agility by 3027 for 15s.
	// https://www.wowhead.com/mop/spell=128984
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Relic of Xuen - Agility",
		ItemID:             79328,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeCrit,
		RequireDamageDealt: true,
	})

	// When you cast healing spells, you have a chance to gain Blessing of the Celestials, increasing your Spirit
	// by 3027 for 20s. ( 20% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=128987
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Relic of Chi-Ji",
		ItemID:             79330,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal spell damage, you have a chance to gain Blessing of the Celestials, increasing your Intellect
	// by 3027 for 15s.
	// https://www.wowhead.com/mop/spell=128985
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Relic of Yu'lon",
		ItemID:             79331,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 haste for 20s.
	// https://www.wowhead.com/mop/spell=126483
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Windswept Pages (H)",
		ItemID:             81125,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your healing spells have a chance to grant 1926 Intellect for 10s.
	// https://www.wowhead.com/mop/spell=126266
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Empty Fruit Barrel (H)",
		ItemID:             81133,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 critical strike for 30s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=126513
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Carbonic Carbuncle (H)",
		ItemID:             81138,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your spells deal damage you have a chance to gain 2573 critical strike for 30s. ( 15% chance, 115
	// sec cooldown)
	// https://www.wowhead.com/mop/spell=126476
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Vision of the Predator (H)",
		ItemID:             81192,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 dodge for 15s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126236
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 81243, ItemName: "Iron Protector Talisman (H)"},
		{ItemID: 85181, ItemName: "Iron Protector Talisman (N)"},
	})

	// When your attacks critical strike your target you have a chance to gain 2573 Agility for 25s. ( 45% chance,
	// 85 sec cooldown)
	// https://www.wowhead.com/mop/spell=126489
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Searing Words (H)",
		ItemID:             81267,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeCrit,
		RequireDamageDealt: false,
	})

	// Your healing and damaging spells have a chance to grant 1851 mastery for 20s.
	// https://www.wowhead.com/mop/spell=122309
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mark of the Catacombs",
		ItemID:             83731,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122310
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of the Catacombs",
		ItemID:             83732,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your melee and ranged attacks have a chance to grant 1851 mastery for 20s.
	// https://www.wowhead.com/mop/spell=122311
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Emblem of the Catacombs",
		ItemID:             83733,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee attacks have a chance to grant 1851 parry for 20s.
	// https://www.wowhead.com/mop/spell=122312
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Medallion of the Catacombs",
		ItemID:             83734,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskMeleeProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee and ranged attacks have a chance to grant 1851 critical strike for 20s.
	// https://www.wowhead.com/mop/spell=122313
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Symbol of the Catacombs",
		ItemID:             83735,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your healing and damaging spells have a chance to grant 1851 spirit for 20s.
	// https://www.wowhead.com/mop/spell=122314
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of Compassion",
		ItemID:             83736,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1851 critical strike for 20s.
	// https://www.wowhead.com/mop/spell=122315
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of Fidelity",
		ItemID:             83737,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your melee and ranged attacks have a chance to grant 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122316
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of Grace",
		ItemID:             83738,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee attacks have a chance to grant 1851 mastery for 20s.
	// https://www.wowhead.com/mop/spell=122317
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of Patience",
		ItemID:             83739,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskMeleeProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee and ranged attacks have a chance to grant 1851 mastery for 20s.
	// https://www.wowhead.com/mop/spell=122318
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of Devotion",
		ItemID:             83740,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your healing and damaging spells have a chance to grant 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122686
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Fearwurm Relic",
		ItemID:             84070,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122687
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Charm of Ten Songs",
		ItemID:             84071,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your melee and ranged attacks have a chance to grant 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122688
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Braid of Ten Songs",
		ItemID:             84072,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee attacks have a chance to grant 1851 parry for 20s.
	// https://www.wowhead.com/mop/spell=122689
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Knot of Ten Songs",
		ItemID:             84073,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskMeleeProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee and ranged attacks have a chance to grant 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122690
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Fearwurm Badge",
		ItemID:             84074,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your healing and damaging spells have a chance to grant 1851 critical strike for 20s.
	// https://www.wowhead.com/mop/spell=122691
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Relic of Kypari Zar",
		ItemID:             84075,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1851 mastery for 20s.
	// https://www.wowhead.com/mop/spell=122692
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sigil of Kypari Zar",
		ItemID:             84076,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your melee and ranged attacks have a chance to grant 1851 haste for 20s.
	// https://www.wowhead.com/mop/spell=122693
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Emblem of Kypari Zar",
		ItemID:             84077,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee attacks have a chance to grant 1851 dodge for 20s.
	// https://www.wowhead.com/mop/spell=122694
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Insignia of Kypari Zar",
		ItemID:             84078,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskMeleeProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Your melee and ranged attacks have a chance to grant 1851 critical strike for 20s.
	// https://www.wowhead.com/mop/spell=122695
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Badge of Kypari Zar",
		ItemID:             84079,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Dreadful Gladiator's Insignia of Conquest (Season 12)",
		ItemID:             84349,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Dreadful Gladiator's Insignia of Dominance (Season 12)",
		ItemID:             84489,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Dreadful Gladiator's Insignia of Victory (Season 12)",
		ItemID:             84495,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 84935, ItemName: "Malevolent Gladiator's Insignia of Conquest (Season 12)"},
		{ItemID: 91457, ItemName: "Malevolent Gladiator's Insignia of Conquest (Season 13)"},
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 84937, ItemName: "Malevolent Gladiator's Insignia of Victory (Season 12)"},
		{ItemID: 91768, ItemName: "Malevolent Gladiator's Insignia of Victory (Season 13)"},
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 84941, ItemName: "Malevolent Gladiator's Insignia of Dominance (Season 12)"},
		{ItemID: 91754, ItemName: "Malevolent Gladiator's Insignia of Dominance (Season 13)"},
	})

	// Your attacks have a chance to grant you 963 dodge for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126533
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86131, ItemName: "Vial of Dragon's Blood (N)"},
		{ItemID: 86790, ItemName: "Vial of Dragon's Blood (LFR) (Celestial)"},
		{ItemID: 87063, ItemName: "Vial of Dragon's Blood (H)"},
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126554
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86132, ItemName: "Bottle of Infinite Stars (N)"},
		{ItemID: 86791, ItemName: "Bottle of Infinite Stars (LFR) (Celestial)"},
		{ItemID: 87057, ItemName: "Bottle of Infinite Stars (H)"},
	})

	// Each time you deal periodic damage you have a chance to gain 963 Intellect for 20s. ( 15% chance, 55 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126577
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	}, []shared.ItemVariant{
		{ItemID: 86133, ItemName: "Light of the Cosmos (N)"},
		{ItemID: 86792, ItemName: "Light of the Cosmos (LFR) (Celestial)"},
		{ItemID: 87065, ItemName: "Light of the Cosmos (H)"},
	})

	// Your attacks have a chance to grant you 963 Strength for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126582
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86144, ItemName: "Lei Shen's Final Orders (N)"},
		{ItemID: 86802, ItemName: "Lei Shen's Final Orders (LFR) (Celestial)"},
		{ItemID: 87072, ItemName: "Lei Shen's Final Orders (H)"},
	})

	// Each time your spells heal you have a chance to gain 963 Intellect for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126588
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86147, ItemName: "Qin-xi's Polarizing Seal (N)"},
		{ItemID: 86805, ItemName: "Qin-xi's Polarizing Seal (LFR) (Celestial)"},
		{ItemID: 87075, ItemName: "Qin-xi's Polarizing Seal (H)"},
	})

	// Each time your attacks hit, you have a chance to gain 963 dodge for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=126646
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86323, ItemName: "Stuff of Nightmares (N)"},
		{ItemID: 86881, ItemName: "Stuff of Nightmares (LFR) (Celestial)"},
		{ItemID: 87160, ItemName: "Stuff of Nightmares (H)"},
	})

	// Each time your spells heal you have a chance to gain 963 Spirit for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=126640
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86327, ItemName: "Spirits of the Sun (N)"},
		{ItemID: 86885, ItemName: "Spirits of the Sun (LFR) (Celestial)"},
		{ItemID: 87163, ItemName: "Spirits of the Sun (H)"},
	})

	// Each time your attacks hit, you have a chance to gain 963 critical strike for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126649
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86332, ItemName: "Terror in the Mists (N)"},
		{ItemID: 86890, ItemName: "Terror in the Mists (LFR) (Celestial)"},
		{ItemID: 87167, ItemName: "Terror in the Mists (H)"},
	})

	// Each time your attacks hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=126657
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86336, ItemName: "Darkmist Vortex (N)"},
		{ItemID: 86894, ItemName: "Darkmist Vortex (LFR) (Celestial)"},
		{ItemID: 87172, ItemName: "Darkmist Vortex (H)"},
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126659
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 86388, ItemName: "Essence of Terror (N)"},
		{ItemID: 86907, ItemName: "Essence of Terror (LFR) (Celestial)"},
		{ItemID: 87175, ItemName: "Essence of Terror (H)"},
	})

	// Your healing spells have a chance to grant 1926 spellpower for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=127572
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Core of Decency",
		ItemID:             87497,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// You gain an additional 375 critical strike for 10s. This effect stacks up to 3 times.
	// https://www.wowhead.com/mop/spell=127890
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "The Gloaming Blade",
		ItemID:             88149,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskUnknown,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 91104, ItemName: "Tyrannical Gladiator's Insignia of Conquest (Season 13) (Alliance)"},
		{ItemID: 94356, ItemName: "Tyrannical Gladiator's Insignia of Conquest (Season 13) (Horde)"},
		{ItemID: 99777, ItemName: "Tyrannical Gladiator's Insignia of Conquest (Season 14) (Alliance)"},
		{ItemID: 100026, ItemName: "Tyrannical Gladiator's Insignia of Conquest (Season 14) (Horde)"},
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 91401, ItemName: "Tyrannical Gladiator's Insignia of Dominance (Season 13) (Alliance)"},
		{ItemID: 94482, ItemName: "Tyrannical Gladiator's Insignia of Dominance (Season 13) (Horde)"},
		{ItemID: 99938, ItemName: "Tyrannical Gladiator's Insignia of Dominance (Season 14) (Alliance)"},
		{ItemID: 100152, ItemName: "Tyrannical Gladiator's Insignia of Dominance (Season 14) (Horde)"},
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 91415, ItemName: "Tyrannical Gladiator's Insignia of Victory (Season 13) (Alliance)"},
		{ItemID: 94415, ItemName: "Tyrannical Gladiator's Insignia of Victory (Season 13) (Horde)"},
		{ItemID: 99948, ItemName: "Tyrannical Gladiator's Insignia of Victory (Season 14) (Alliance)"},
		{ItemID: 100085, ItemName: "Tyrannical Gladiator's Insignia of Victory (Season 14) (Horde)"},
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Crafted Dreadful Gladiator's Insignia of Conquest",
		ItemID:             93424,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Crafted Dreadful Gladiator's Insignia of Dominance",
		ItemID:             93601,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Crafted Dreadful Gladiator's Insignia of Victory",
		ItemID:             93611,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Strength for 15s. ( 15% chance, 85 sec cooldown)
	// https://www.wowhead.com/mop/spell=138702
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Brutal Talisman of the Shado-Pan Assault",
		ItemID:             94508,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 10s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=138703
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Volatile Talisman of the Shado-Pan Assault",
		ItemID:             94510,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=138699
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Vicious Talisman of the Shado-Pan Assault",
		ItemID:             94511,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Strength for 10s. This effect can stack up to 5 times. (Approximately
	// 3.50 procs per minute)
	// https://www.wowhead.com/mop/spell=138870
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 94519, ItemName: "Primordius' Talisman of Rage (N)"},
		{ItemID: 95757, ItemName: "Primordius' Talisman of Rage (LFR) (Celestial)"},
		{ItemID: 96129, ItemName: "Primordius' Talisman of Rage (Thunderforged)"},
		{ItemID: 96501, ItemName: "Primordius' Talisman of Rage (H)"},
		{ItemID: 96873, ItemName: "Primordius' Talisman of Rage (Heroic Thunderforged)"},
	})

	// Your periodic damage spells have a chance to grant 1926 Intellect for 10s. (Approximately 1.10 procs per
	// minute)
	// https://www.wowhead.com/mop/spell=138898
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	}, []shared.ItemVariant{
		{ItemID: 94521, ItemName: "Breath of the Hydra (N)"},
		{ItemID: 95711, ItemName: "Breath of the Hydra (LFR) (Celestial)"},
		{ItemID: 96083, ItemName: "Breath of the Hydra (Thunderforged)"},
		{ItemID: 96455, ItemName: "Breath of the Hydra (H)"},
		{ItemID: 96827, ItemName: "Breath of the Hydra (Heroic Thunderforged)"},
	})

	// Your attacks have a chance to grant you 963 haste for 10s. This effect can stack up to 5 times. (Approximately
	// 3.50 procs per minute)
	// https://www.wowhead.com/mop/spell=138895
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 94522, ItemName: "Talisman of Bloodlust (N)"},
		{ItemID: 95748, ItemName: "Talisman of Bloodlust (LFR) (Celestial)"},
		{ItemID: 96120, ItemName: "Talisman of Bloodlust (Thunderforged)"},
		{ItemID: 96492, ItemName: "Talisman of Bloodlust (H)"},
		{ItemID: 96864, ItemName: "Talisman of Bloodlust (Heroic Thunderforged)"},
	})

	// When your attacks hit you have a chance to gain 2573 Agility and summon 3 Voodoo Gnomes for 10s. (Approximately
	// 1.10 procs per minute)
	// https://www.wowhead.com/mop/spell=138938
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 94523, ItemName: "Bad Juju (N)"},
		{ItemID: 95665, ItemName: "Bad Juju (LFR) (Celestial)"},
		{ItemID: 96037, ItemName: "Bad Juju (Thunderforged)"},
		{ItemID: 96409, ItemName: "Bad Juju (H)"},
		{ItemID: 96781, ItemName: "Bad Juju (Heroic Thunderforged)"},
	})

	// Your critical attacks have a chance to grant you 963 Critical Strike for 20s. This effect can stack up
	// to 3 times. (Approximately 0.72 procs per minute)
	// https://www.wowhead.com/mop/spell=139170
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeCrit,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 94529, ItemName: "Gaze of the Twins (N)"},
		{ItemID: 95799, ItemName: "Gaze of the Twins (LFR) (Celestial)"},
		{ItemID: 96171, ItemName: "Gaze of the Twins (Thunderforged)"},
		{ItemID: 96543, ItemName: "Gaze of the Twins (H)"},
		{ItemID: 96915, ItemName: "Gaze of the Twins (Heroic Thunderforged)"},
	})

	// When your spells deal critical damage, you have a chance to gain 1926 Intellect for 10s. (Approximately
	// 0.85 procs per minute)
	// https://www.wowhead.com/mop/spell=139133
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeCrit,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 94531, ItemName: "Cha-Ye's Essence of Brilliance (N)"},
		{ItemID: 95772, ItemName: "Cha-Ye's Essence of Brilliance (LFR) (Celestial)"},
		{ItemID: 96144, ItemName: "Cha-Ye's Essence of Brilliance (Thunderforged)"},
		{ItemID: 96516, ItemName: "Cha-Ye's Essence of Brilliance (H)"},
		{ItemID: 96888, ItemName: "Cha-Ye's Essence of Brilliance (Heroic Thunderforged)"},
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Crafted Malevolent Gladiator's Insignia of Conquest",
		ItemID:             98760,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Crafted Malevolent Gladiator's Insignia of Dominance",
		ItemID:             98911,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Crafted Malevolent Gladiator's Insignia of Victory",
		ItemID:             98917,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 100200, ItemName: "Grievous Gladiator's Insignia of Conquest (Season 14) (Alliance)"},
		{ItemID: 100586, ItemName: "Grievous Gladiator's Insignia of Conquest (Season 14) (Horde)"},
		{ItemID: 102840, ItemName: "Grievous Gladiator's Insignia of Conquest (Season 15) (Horde)"},
		{ItemID: 103150, ItemName: "Grievous Gladiator's Insignia of Conquest (Season 15) (Alliance)"},
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 100491, ItemName: "Grievous Gladiator's Insignia of Dominance (Season 14) (Alliance)"},
		{ItemID: 100712, ItemName: "Grievous Gladiator's Insignia of Dominance (Season 14) (Horde)"},
		{ItemID: 102963, ItemName: "Grievous Gladiator's Insignia of Dominance (Season 15) (Horde)"},
		{ItemID: 103309, ItemName: "Grievous Gladiator's Insignia of Dominance (Season 15) (Alliance)"},
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 100505, ItemName: "Grievous Gladiator's Insignia of Victory (Season 14) (Alliance)"},
		{ItemID: 100645, ItemName: "Grievous Gladiator's Insignia of Victory (Season 14) (Horde)"},
		{ItemID: 102896, ItemName: "Grievous Gladiator's Insignia of Victory (Season 15) (Horde)"},
		{ItemID: 103319, ItemName: "Grievous Gladiator's Insignia of Victory (Season 15) (Alliance)"},
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Heart-Lesion Stone of Battle",
		ItemID:             100990,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Strength for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126582
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Heart-Lesion Idol of Battle",
		ItemID:             100991,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 dodge for 15s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126236
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Heart-Lesion Defender Idol",
		ItemID:             100999,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Heart-Lesion Defender Stone",
		ItemID:             101002,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126554
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Springrain Idol of Rage",
		ItemID:             101009,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Springrain Stone of Rage",
		ItemID:             101012,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126659
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Springrain Idol of Destruction",
		ItemID:             101023,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Springrain Stone of Destruction",
		ItemID:             101026,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your healing spells have a chance to grant 1926 Intellect for 10s.
	// https://www.wowhead.com/mop/spell=126266
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Springrain Stone of Wisdom",
		ItemID:             101041,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126554
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Trailseeker Idol of Rage",
		ItemID:             101054,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Trailseeker Stone of Rage",
		ItemID:             101057,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126659
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mountainsage Idol of Destruction",
		ItemID:             101069,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mountainsage Stone of Destruction",
		ItemID:             101072,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mistdancer Defender Stone",
		ItemID:             101087,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 dodge for 15s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126236
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mistdancer Defender Idol",
		ItemID:             101089,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your healing spells have a chance to grant 1926 Intellect for 10s.
	// https://www.wowhead.com/mop/spell=126266
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mistdancer Stone of Wisdom",
		ItemID:             101107,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126554
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mistdancer Idol of Rage",
		ItemID:             101113,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mistdancer Stone of Rage",
		ItemID:             101117,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your healing spells have a chance to grant 1926 Intellect for 10s.
	// https://www.wowhead.com/mop/spell=126266
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sunsoul Stone of Wisdom",
		ItemID:             101138,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sunsoul Stone of Battle",
		ItemID:             101151,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Strength for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126582
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sunsoul Idol of Battle",
		ItemID:             101152,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 dodge for 15s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126236
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sunsoul Defender Idol",
		ItemID:             101160,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Sunsoul Defender Stone",
		ItemID:             101163,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126659
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Communal Idol of Destruction",
		ItemID:             101168,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Communal Stone of Destruction",
		ItemID:             101171,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your healing spells have a chance to grant 1926 Intellect for 10s.
	// https://www.wowhead.com/mop/spell=126266
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Communal Stone of Wisdom",
		ItemID:             101183,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126554
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Lightdrinker Idol of Rage",
		ItemID:             101200,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Lightdrinker Stone of Rage",
		ItemID:             101203,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Agility for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126554
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Streamtalker Idol of Rage",
		ItemID:             101217,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Streamtalker Stone of Rage",
		ItemID:             101220,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126659
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Streamtalker Idol of Destruction",
		ItemID:             101222,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Streamtalker Stone of Destruction",
		ItemID:             101225,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your healing spells have a chance to grant 1926 Intellect for 10s.
	// https://www.wowhead.com/mop/spell=126266
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Streamtalker Stone of Wisdom",
		ItemID:             101250,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Each time your harmful spells hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec
	// cooldown)
	// https://www.wowhead.com/mop/spell=126659
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Felsoul Idol of Destruction",
		ItemID:             101263,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Felsoul Stone of Destruction",
		ItemID:             101266,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Oathsworn Stone of Battle",
		ItemID:             101294,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 Strength for 20s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126582
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Oathsworn Idol of Battle",
		ItemID:             101295,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your attacks have a chance to grant you 963 dodge for 15s. ( 15% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=126236
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Oathsworn Defender Idol",
		ItemID:             101303,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s.
	// https://www.wowhead.com/mop/spell=133630
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Oathsworn Defender Stone",
		ItemID:             101306,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your helpful spells have a chance to grant 1 Intellect for 10s. (Approximately 0.92 procs per minute)
	// https://www.wowhead.com/mop/spell=148908
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackEmpty,
		ProcMask:           core.ProcMaskUnknown,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	}, []shared.ItemVariant{
		{ItemID: 102294, ItemName: "Nazgrim's Burnished Insignia - Intellect (N)"},
		{ItemID: 104553, ItemName: "Nazgrim's Burnished Insignia - Intellect (H)"},
		{ItemID: 104802, ItemName: "Nazgrim's Burnished Insignia - Intellect (Flexible)"},
		{ItemID: 105051, ItemName: "Nazgrim's Burnished Insignia - Intellect (LFR) (Celestial)"},
		{ItemID: 105300, ItemName: "Nazgrim's Burnished Insignia - Intellect (Warforged)"},
		{ItemID: 105549, ItemName: "Nazgrim's Burnished Insignia - Intellect (Heroic Warforged)"},
	})

	// Each time your spells heal you have a chance to gain 963 Intellect for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=148911
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 102304, ItemName: "Thok's Acid-Grooved Tooth - Intellect (N)"},
		{ItemID: 104611, ItemName: "Thok's Acid-Grooved Tooth - Intellect (H)"},
		{ItemID: 104860, ItemName: "Thok's Acid-Grooved Tooth - Intellect (Flexible)"},
		{ItemID: 105109, ItemName: "Thok's Acid-Grooved Tooth - Intellect (LFR) (Celestial)"},
		{ItemID: 105358, ItemName: "Thok's Acid-Grooved Tooth - Intellect (Warforged)"},
		{ItemID: 105607, ItemName: "Thok's Acid-Grooved Tooth - Intellect (Heroic Warforged)"},
	})

	// Your heals have a chance to grant you 19260 Spirit for 10s. Every 0.5 sec, this effect is reduced by 963
	// Spirit. (Approximately 0.92 procs per minute)
	// https://www.wowhead.com/mop/spell=146317
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 102309, ItemName: "Dysmorphic Samophlange of Discontinuity (N)"},
		{ItemID: 104619, ItemName: "Dysmorphic Samophlange of Discontinuity (H)"},
		{ItemID: 104868, ItemName: "Dysmorphic Samophlange of Discontinuity (Flexible)"},
		{ItemID: 105117, ItemName: "Dysmorphic Samophlange of Discontinuity (LFR) (Celestial)"},
		{ItemID: 105366, ItemName: "Dysmorphic Samophlange of Discontinuity (Warforged)"},
		{ItemID: 105615, ItemName: "Dysmorphic Samophlange of Discontinuity (Heroic Warforged)"},
	})

	// When you deal damage you have a chance to gain 1287 Agility for 20s.
	// https://www.wowhead.com/mop/spell=126707
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 102643, ItemName: "Prideful Gladiator's Insignia of Conquest (Season 15) (Alliance)"},
		{ItemID: 103347, ItemName: "Prideful Gladiator's Insignia of Conquest (Season 15) (Horde)"},
	})

	// When you deal damage you have a chance to gain 1287 Strength for 20s.
	// https://www.wowhead.com/mop/spell=126700
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 102699, ItemName: "Prideful Gladiator's Insignia of Victory (Season 15) (Alliance)"},
		{ItemID: 103516, ItemName: "Prideful Gladiator's Insignia of Victory (Season 15) (Horde)"},
	})

	// When you deal damage or heal a target you have a chance to gain 1287 Intellect for 20s.
	// https://www.wowhead.com/mop/spell=126705
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 102766, ItemName: "Prideful Gladiator's Insignia of Dominance (Season 15) (Alliance)"},
		{ItemID: 103506, ItemName: "Prideful Gladiator's Insignia of Dominance (Season 15) (Horde)"},
	})

	// Your melee and ranged attacks have a chance to grant 1149 haste for 20s.
	// https://www.wowhead.com/mop/spell=148447
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Time-Lost Artifact",
		ItemID:             103678,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// When your attacks hit you have a chance to gain 2573 Mastery for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=146312
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskMeleeProc | core.ProcMaskRangedProc | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 103686, ItemName: "Discipline of Xuen"},
		{ItemID: 103986, ItemName: "Discipline of Xuen (Timeless)"},
	})

	// When your spells deal damage you have a chance to gain 2573 critical strike for 20s. ( 15% chance, 115
	// sec cooldown)
	// https://www.wowhead.com/mop/spell=146218
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	}, []shared.ItemVariant{
		{ItemID: 103687, ItemName: "Yu'lon's Bite"},
		{ItemID: 103987, ItemName: "Yu'lon's Bite (Timeless)"},
	})

	// Each time your melee attacks hit, you have a chance to gain 963 haste for 20s. ( 15% chance, 115 sec cooldown)
	// https://www.wowhead.com/mop/spell=146296
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskMeleeProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	}, []shared.ItemVariant{
		{ItemID: 103689, ItemName: "Alacrity of Xuen"},
		{ItemID: 103989, ItemName: "Alacrity of Xuen (Timeless)"},
	})

	// Chance on melee and ranged critical strike to increase your attack power by 4000 for 10s.
	// https://www.wowhead.com/mop/spell=127928
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Coren's Cold Chromium Coaster",
		ItemID:             257880,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial,
		Outcome:            core.OutcomeCrit,
		RequireDamageDealt: true,
	})

	// Your direct healing and heal over time spells have a chance to increase your haste by 2040 for 10s. (
	// 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=127915
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Thousand-Year Pickled Egg",
		ItemID:             257881,
		Callback:           core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Your harmful spells have a chance to increase your spell power by 2040 for 10s. ( 10% chance, 55 sec cooldown)
	// https://www.wowhead.com/mop/spell=127923
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mithril Wristwatch",
		ItemID:             257884,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellDamageProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})
}
