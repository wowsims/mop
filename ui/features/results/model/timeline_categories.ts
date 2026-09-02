import { ActionId } from '@domain/proto_utils/action_id';
import { APLActionItemSwap_SwapSet } from '@generated/proto/apl';
import { OtherAction } from '@generated/proto/common';
import { ResourceType } from '@generated/proto/spell';

export const MELEE_ACTION_CATEGORY = 1;
export const SPELL_ACTION_CATEGORY = 2;
export const DEFAULT_ACTION_CATEGORY = 3;

export const auraAsResource: ActionId[] = [
	// APL Damage Amplifier
	ActionId.fromOtherId(OtherAction.OtherActionDamageAmplifier),

	// Item Swap
	ActionId.fromOtherId(OtherAction.OtherActionItemSwap, APLActionItemSwap_SwapSet.Main),
	ActionId.fromOtherId(OtherAction.OtherActionItemSwap, APLActionItemSwap_SwapSet.Swap1),

	// Vengeance
	ActionId.fromSpellId(84840), // Druid
	ActionId.fromSpellId(84839), // Paladin
	ActionId.fromSpellId(93098), // Warrior
	ActionId.fromSpellId(93099), // Death Knight
	ActionId.fromSpellId(120267), // Monk

	// Monk
	ActionId.fromSpellId(124255, 1), // Stagger
	ActionId.fromSpellId(128938), // Elusive Brew - Stacks
	ActionId.fromSpellId(115308), // Elusive Brew - Active
	ActionId.fromSpellId(1247279), // Tiger Eye Brew - Stacks
	ActionId.fromSpellId(1247275), // Tiger Eye Brew - Active

	// Mage
	ActionId.fromSpellId(148022), // Icicle
];

// Hard-coded spell categories for controlling rotation ordering.
export const idToCategoryMap: Record<number, number> = {
	[OtherAction.OtherActionMove]: 0,
	[OtherAction.OtherActionAttack]: 0.01,
	[OtherAction.OtherActionShoot]: 0.5,
	[OtherAction.OtherActionDamageAmplifier]: 0.6,

	// Druid
	[48480]: 0.1, // Maul
	[48564]: MELEE_ACTION_CATEGORY + 0.1, // Mangle (Bear)
	[48568]: MELEE_ACTION_CATEGORY + 0.2, // Lacerate
	[48562]: MELEE_ACTION_CATEGORY + 0.3, // Swipe (Bear)

	[48566]: MELEE_ACTION_CATEGORY + 0.1, // Mangle (Cat)
	[48572]: MELEE_ACTION_CATEGORY + 0.2, // Shred
	[49800]: MELEE_ACTION_CATEGORY + 0.51, // Rip
	[52610]: MELEE_ACTION_CATEGORY + 0.52, // Savage Roar
	[48577]: MELEE_ACTION_CATEGORY + 0.53, // Ferocious Bite

	[48465]: SPELL_ACTION_CATEGORY + 0.1, // Starfire
	[48461]: SPELL_ACTION_CATEGORY + 0.2, // Wrath
	[53201]: SPELL_ACTION_CATEGORY + 0.3, // Starfall
	[48463]: SPELL_ACTION_CATEGORY + 0.4, // Moonfire

	// Hunter
	[48996]: 0.1, // Raptor Strike
	[53217]: 0.6, // Wild Quiver
	[53209]: MELEE_ACTION_CATEGORY + 0.1, // Chimera Shot
	[53353]: MELEE_ACTION_CATEGORY + 0.11, // Chimera Shot Serpent
	[53301]: MELEE_ACTION_CATEGORY + 0.1, // Explosive Shot
	[1215485]: MELEE_ACTION_CATEGORY + 0.12, // Explosive Shot
	[49050]: MELEE_ACTION_CATEGORY + 0.2, // Aimed Shot
	[49048]: MELEE_ACTION_CATEGORY + 0.21, // Multi Shot
	[3044]: MELEE_ACTION_CATEGORY + 0.22, // Arcane Shot
	[56641]: MELEE_ACTION_CATEGORY + 0.27, // Steady Shot
	[53351]: MELEE_ACTION_CATEGORY + 0.28, // Kill Shot
	[34490]: MELEE_ACTION_CATEGORY + 0.29, // Silencing Shot
	[49001]: MELEE_ACTION_CATEGORY + 0.3, // Serpent Sting
	[53238]: MELEE_ACTION_CATEGORY + 0.31, // Piercing Shots
	[3674]: MELEE_ACTION_CATEGORY + 0.32, // Black Arrow
	[49067]: MELEE_ACTION_CATEGORY + 0.33, // Explosive Trap
	[77767]: MELEE_ACTION_CATEGORY + 0.34, // Cobra Shot

	// Paladin
	[76672]: MELEE_ACTION_CATEGORY + 0.01, // Hand of Light (mastery)
	[35395]: MELEE_ACTION_CATEGORY + 0.02, // Crusader Strike
	[53595]: MELEE_ACTION_CATEGORY + 0.04, // Hammer of the Righteous (Physical)
	[88263]: MELEE_ACTION_CATEGORY + 0.05, // Hammer of the Righteous (Holy)
	[53385]: MELEE_ACTION_CATEGORY + 0.06, // Divine Storm
	[85256]: MELEE_ACTION_CATEGORY + 0.07, // Templar's Verdict
	[20271]: MELEE_ACTION_CATEGORY + 0.08, // Judgment
	[42463]: MELEE_ACTION_CATEGORY + 0.09, // Seal of Truth (on-hit)
	[31803]: MELEE_ACTION_CATEGORY + 0.1, // Censure (Seal of Truth)
	[101423]: MELEE_ACTION_CATEGORY + 0.11, // Seal of Righteousness
	[53600]: MELEE_ACTION_CATEGORY + 0.12, // Shield of the Righteous
	[879]: MELEE_ACTION_CATEGORY + 0.15, // Exorcism
	[26573]: MELEE_ACTION_CATEGORY + 0.16, // Consecration
	[119072]: MELEE_ACTION_CATEGORY + 0.17, // Holy Wrath
	[24275]: MELEE_ACTION_CATEGORY + 0.18, // Hammer of Wrath
	[114852]: MELEE_ACTION_CATEGORY + 0.19, // Holy Prism (Damage)
	[114919]: MELEE_ACTION_CATEGORY + 0.19, // Arcing Light (Damage)
	[114916]: MELEE_ACTION_CATEGORY + 0.19, // Execution Sentence
	[114871]: MELEE_ACTION_CATEGORY + 0.2, // Holy Prism (Heal)
	[119952]: MELEE_ACTION_CATEGORY + 0.2, // Arcing Light (Heal)
	[146586]: MELEE_ACTION_CATEGORY + 0.2, // Stay of Execution
	[84963]: SPELL_ACTION_CATEGORY + 0.01, // Inquisition
	[54428]: SPELL_ACTION_CATEGORY + 0.02, // Divine Plea
	[498]: SPELL_ACTION_CATEGORY + 0.03, // Divine Protection
	[66233]: SPELL_ACTION_CATEGORY + 0.05, // Ardent Defender
	[31884]: SPELL_ACTION_CATEGORY + 0.06, // Avenging Wrath
	[114232]: SPELL_ACTION_CATEGORY + 0.07, // Sanctified Wrath
	[105809]: SPELL_ACTION_CATEGORY + 0.08, // Holy Avenger,
	[86698]: SPELL_ACTION_CATEGORY + 0.09, // Guardian of Ancient Kings
	[86704]: SPELL_ACTION_CATEGORY + 0.1, // Ancient Fury
	[20925]: SPELL_ACTION_CATEGORY + 0.11, // Sacred Shield (Ret / Prot)
	[148039]: SPELL_ACTION_CATEGORY + 0.11, // Sacred Shield (Holy)
	[65148]: SPELL_ACTION_CATEGORY + 0.12, // Sacred Shield (Absorb)
	[114039]: SPELL_ACTION_CATEGORY + 0.13, // Hand of Purity

	// Priest
	[48300]: SPELL_ACTION_CATEGORY + 0.11, // Devouring Plague
	[48125]: SPELL_ACTION_CATEGORY + 0.12, // Shadow Word: Pain
	[48160]: SPELL_ACTION_CATEGORY + 0.13, // Vampiric Touch
	[48135]: SPELL_ACTION_CATEGORY + 0.14, // Holy Fire
	[48123]: SPELL_ACTION_CATEGORY + 0.19, // Smite
	[48127]: SPELL_ACTION_CATEGORY + 0.2, // Mind Blast
	[48158]: SPELL_ACTION_CATEGORY + 0.3, // Shadow Word: Death
	[48156]: SPELL_ACTION_CATEGORY + 0.4, // Mind Flay

	// Rogue
	[6774]: MELEE_ACTION_CATEGORY + 0.1, // Slice and Dice
	[8647]: MELEE_ACTION_CATEGORY + 0.2, // Expose Armor
	[48672]: MELEE_ACTION_CATEGORY + 0.3, // Rupture
	[57993]: MELEE_ACTION_CATEGORY + 0.3, // Envenom
	[48668]: MELEE_ACTION_CATEGORY + 0.4, // Eviscerate
	[48666]: MELEE_ACTION_CATEGORY + 0.5, // Mutilate
	[48665]: MELEE_ACTION_CATEGORY + 0.6, // Mutilate (MH)
	[48664]: MELEE_ACTION_CATEGORY + 0.7, // Mutilate (OH)
	[48638]: MELEE_ACTION_CATEGORY + 0.5, // Sinister Strike
	[51723]: MELEE_ACTION_CATEGORY + 0.8, // Fan of Knives
	[57973]: SPELL_ACTION_CATEGORY + 0.1, // Deadly Poison
	[57968]: SPELL_ACTION_CATEGORY + 0.2, // Instant Poison

	// Shaman
	[8232]: 0.11, // Windfury Weapon
	[8024]: 0.12, // Flametongue Weapon
	[8033]: 0.12, // Frostbrand Weapon
	[17364]: MELEE_ACTION_CATEGORY + 0.1, // Stormstrike
	[60103]: MELEE_ACTION_CATEGORY + 0.2, // Lava Lash
	[49233]: SPELL_ACTION_CATEGORY + 0.21, // Flame Shock
	[49231]: SPELL_ACTION_CATEGORY + 0.22, // Earth Shock
	[49236]: SPELL_ACTION_CATEGORY + 0.23, // Frost Shock
	[60043]: SPELL_ACTION_CATEGORY + 0.31, // Lava Burst
	[49238]: SPELL_ACTION_CATEGORY + 0.32, // Lightning Bolt
	[49271]: SPELL_ACTION_CATEGORY + 0.33, // Chain Lightning
	[61657]: SPELL_ACTION_CATEGORY + 0.41, // Fire Nova
	[58734]: SPELL_ACTION_CATEGORY + 0.42, // Magma Totem
	[58704]: SPELL_ACTION_CATEGORY + 0.43, // Searing Totem
	[49281]: SPELL_ACTION_CATEGORY + 0.51, // Lightning Shield
	[49279]: SPELL_ACTION_CATEGORY + 0.52, // Lightning Shield (Proc)
	[2825]: DEFAULT_ACTION_CATEGORY + 0.1, // Bloodlust

	// Warlock
	[603]: SPELL_ACTION_CATEGORY + 0.01, // Curse of Doom
	[980]: SPELL_ACTION_CATEGORY + 0.02, // Curse of Agony
	[172]: SPELL_ACTION_CATEGORY + 0.1, // Corruption
	[48181]: SPELL_ACTION_CATEGORY + 0.2, // Haunt
	[30108]: SPELL_ACTION_CATEGORY + 0.3, // Unstable Affliction
	[348]: SPELL_ACTION_CATEGORY + 0.31, // Immolate
	[17962]: SPELL_ACTION_CATEGORY + 0.32, // Conflagrate
	[50796]: SPELL_ACTION_CATEGORY + 0.49, // Chaos Bolt
	[686]: SPELL_ACTION_CATEGORY + 0.5, // Shadow Bolt
	[29722]: SPELL_ACTION_CATEGORY + 0.51, // Incinerate
	[6353]: SPELL_ACTION_CATEGORY + 0.52, // Soul Fire
	[1120]: SPELL_ACTION_CATEGORY + 0.6, // Drain Soul
	[1454]: SPELL_ACTION_CATEGORY + 0.7, // Life Tap
	[59672]: SPELL_ACTION_CATEGORY + 0.8, // Metamorphosis
	[104025]: SPELL_ACTION_CATEGORY + 0.81, // Immolation Aura
	[129476]: SPELL_ACTION_CATEGORY + 0.81, // Immolation Aura
	[47193]: SPELL_ACTION_CATEGORY + 0.82, // Demonic Empowerment

	// Mage
	[42842]: SPELL_ACTION_CATEGORY + 0.01, // Frostbolt
	[47610]: SPELL_ACTION_CATEGORY + 0.02, // Frostfire Bolt
	[42897]: SPELL_ACTION_CATEGORY + 0.02, // Arcane Blast
	[42833]: SPELL_ACTION_CATEGORY + 0.02, // Fireball
	[10]: SPELL_ACTION_CATEGORY + 0.021, // Blizzard - Cast
	[42208]: SPELL_ACTION_CATEGORY + 0.022, // Blizzard - Tick
	[42859]: SPELL_ACTION_CATEGORY + 0.03, // Scorch
	[42891]: SPELL_ACTION_CATEGORY + 0.1, // Pyroblast
	[42846]: SPELL_ACTION_CATEGORY + 0.1, // Arcane Missiles
	[44572]: SPELL_ACTION_CATEGORY + 0.1, // Deep Freeze
	[44781]: SPELL_ACTION_CATEGORY + 0.2, // Arcane Barrage
	[42914]: SPELL_ACTION_CATEGORY + 0.2, // Ice Lance
	[55360]: SPELL_ACTION_CATEGORY + 0.2, // Living Bomb
	[55362]: SPELL_ACTION_CATEGORY + 0.21, // Living Bomb (Explosion)
	[12654]: SPELL_ACTION_CATEGORY + 0.3, // Ignite
	[12472]: SPELL_ACTION_CATEGORY + 0.4, // Icy Veins
	[11129]: SPELL_ACTION_CATEGORY + 0.4, // Combustion
	[12042]: SPELL_ACTION_CATEGORY + 0.4, // Arcane Power
	[11958]: SPELL_ACTION_CATEGORY + 0.41, // Cold Snap
	[12043]: SPELL_ACTION_CATEGORY + 0.41, // Presence of Mind
	[31687]: SPELL_ACTION_CATEGORY + 0.41, // Water Elemental
	[55342]: SPELL_ACTION_CATEGORY + 0.5, // Mirror Image
	[33312]: SPELL_ACTION_CATEGORY + 0.51, // Mana Gems
	[12051]: SPELL_ACTION_CATEGORY + 0.52, // Evocate
	[44401]: SPELL_ACTION_CATEGORY + 0.6, // Missile Barrage
	[44448]: SPELL_ACTION_CATEGORY + 0.6, // Hot Streak
	[44545]: SPELL_ACTION_CATEGORY + 0.6, // Fingers of Frost
	[44549]: SPELL_ACTION_CATEGORY + 0.61, // Brain Freeze
	[12536]: SPELL_ACTION_CATEGORY + 0.61, // Clearcasting

	// Warrior
	[47520]: 0.1, // Cleave
	[47450]: 0.1, // Heroic Strike
	[47475]: MELEE_ACTION_CATEGORY + 0.05, // Slam
	[23881]: MELEE_ACTION_CATEGORY + 0.1, // Bloodthirst
	[47486]: MELEE_ACTION_CATEGORY + 0.1, // Mortal Strike
	[30356]: MELEE_ACTION_CATEGORY + 0.1, // Shield Slam
	[47498]: MELEE_ACTION_CATEGORY + 0.21, // Devastate
	[47467]: MELEE_ACTION_CATEGORY + 0.22, // Sunder Armor
	[57823]: MELEE_ACTION_CATEGORY + 0.23, // Revenge
	[1680]: MELEE_ACTION_CATEGORY + 0.24, // Whirlwind
	[7384]: MELEE_ACTION_CATEGORY + 0.25, // Overpower
	[47471]: MELEE_ACTION_CATEGORY + 0.42, // Execute
	[12867]: SPELL_ACTION_CATEGORY + 0.51, // Deep Wounds
	[58874]: SPELL_ACTION_CATEGORY + 0.52, // Damage Shield
	[47296]: SPELL_ACTION_CATEGORY + 0.53, // Critical Block
	[46924]: MELEE_ACTION_CATEGORY + 0.61, // Bladestorm
	[46968]: MELEE_ACTION_CATEGORY + 0.61, // Shockwave
	[118000]: MELEE_ACTION_CATEGORY + 0.61, // Dragon Roar
	[2565]: SPELL_ACTION_CATEGORY + 0.62, // Shield Block
	[112048]: SPELL_ACTION_CATEGORY + 0.63, // Shield Barrier
	[76857]: SPELL_ACTION_CATEGORY + 0.64, // Mastery: Critical Block
	[1249459]: SPELL_ACTION_CATEGORY + 0.65, // Shattering Throw
	[71]: DEFAULT_ACTION_CATEGORY + 0.1, // Defensive Stance
	[2457]: DEFAULT_ACTION_CATEGORY + 0.1, // Battle Stance
	[6673]: DEFAULT_ACTION_CATEGORY + 0.1, // Battle Shout
	[469]: DEFAULT_ACTION_CATEGORY + 0.1, // Commanding Shout

	// Death Knight
	[49998]: MELEE_ACTION_CATEGORY + 0.01, // Death Strike
	[45470]: MELEE_ACTION_CATEGORY + 0.02, // Death Strike (Heal)
	[77535]: MELEE_ACTION_CATEGORY + 0.03, // Blood Shield
	[49184]: MELEE_ACTION_CATEGORY + 0.04, // Howling Blast
	[49020]: MELEE_ACTION_CATEGORY + 0.05, // Obliterate
	[49143]: MELEE_ACTION_CATEGORY + 0.1, // Frost strike
	[45902]: MELEE_ACTION_CATEGORY + 0.15, // Blood strike
	[50842]: MELEE_ACTION_CATEGORY + 0.2, // Pestilence
	[47541]: MELEE_ACTION_CATEGORY + 0.25, // Death Coil
	[43265]: MELEE_ACTION_CATEGORY + 0.25, // Death and Decay
	[63560]: MELEE_ACTION_CATEGORY + 0.25, // Dark Transformation
	[50536]: MELEE_ACTION_CATEGORY + 0.25, // Unholy Blight
	[57623]: MELEE_ACTION_CATEGORY + 0.25, // HoW
	[45477]: MELEE_ACTION_CATEGORY + 0.3, // Icy touch
	[45462]: MELEE_ACTION_CATEGORY + 0.3, // Plague strike
	[114866]: MELEE_ACTION_CATEGORY + 0.31, // Soul Reaper
	[130735]: MELEE_ACTION_CATEGORY + 0.31, // Soul Reaper
	[130736]: MELEE_ACTION_CATEGORY + 0.31, // Soul Reaper
	[114867]: MELEE_ACTION_CATEGORY + 0.32, // Soul Reaper (Tick)
	[51271]: MELEE_ACTION_CATEGORY + 0.35, // UA
	[45529]: MELEE_ACTION_CATEGORY + 0.35, // BT
	[47568]: MELEE_ACTION_CATEGORY + 0.35, // ERW
	[49206]: MELEE_ACTION_CATEGORY + 0.35, // Summon Gargoyle
	[46584]: MELEE_ACTION_CATEGORY + 0.35, // Raise Dead
	[55095]: MELEE_ACTION_CATEGORY + 0.4, // Frost Fever
	[55078]: MELEE_ACTION_CATEGORY + 0.4, // Blood Plague
	[50401]: MELEE_ACTION_CATEGORY + 0.5, // Razor Frost
	[50689]: DEFAULT_ACTION_CATEGORY + 0.1, // Blood Presence
	[48263]: DEFAULT_ACTION_CATEGORY + 0.1, // Frost Presence
	[48265]: DEFAULT_ACTION_CATEGORY + 0.1, // Unholy Presence

	// Monk
	[120274]: 0.02, // Tiger Strikes (Main Hand)
	[120278]: 0.03, // Tiger Strikes (Off Hand)
	[100780]: MELEE_ACTION_CATEGORY + 0.01, // Jab
	[100787]: MELEE_ACTION_CATEGORY + 0.02, // Tiger Palm
	[100784]: MELEE_ACTION_CATEGORY + 0.03, // Blackout Kick
	[130320]: MELEE_ACTION_CATEGORY + 0.04, // Rising Sun Kick
	[113656]: MELEE_ACTION_CATEGORY + 0.05, // Fists of Fury (Cast)
	[117418]: MELEE_ACTION_CATEGORY + 0.06, // Fists of Fury (Hit)
	[101546]: MELEE_ACTION_CATEGORY + 0.07, // Spinning Crane Kick (Cast)
	[107270]: MELEE_ACTION_CATEGORY + 0.08, // Spinning Crane Kick (Hit)
	[116847]: MELEE_ACTION_CATEGORY + 0.07, // Rushing Jade Wind (Cast)
	[148187]: MELEE_ACTION_CATEGORY + 0.08, // Rushing Jade Wind (Hit)
	[115098]: SPELL_ACTION_CATEGORY + 0.01, // Chi Wave
	[132467]: SPELL_ACTION_CATEGORY + 0.011, // Chi Wave (Damage)
	[132463]: SPELL_ACTION_CATEGORY + 0.012, // Chi Wave (Heal)
	[124098]: SPELL_ACTION_CATEGORY + 0.01, // Zen Sphere (Damage)
	[124081]: SPELL_ACTION_CATEGORY + 0.011, // Zen Sphere (Heal)
	[125033]: SPELL_ACTION_CATEGORY + 0.011, // Zen Sphere: Detonate (Damage)
	[124101]: SPELL_ACTION_CATEGORY + 0.011, // Zen Sphere: Detonate (Heal)
	[123986]: SPELL_ACTION_CATEGORY + 0.01, // Chi Burst
	[148135]: SPELL_ACTION_CATEGORY + 0.011, // Chi Burst (Damage)
	[130654]: SPELL_ACTION_CATEGORY + 0.012, // Chi Burst (Heal)
	[1247275]: SPELL_ACTION_CATEGORY + 0.02, // Tigereye Brew
	[115399]: SPELL_ACTION_CATEGORY + 0.03, // Chi Brew
	[115288]: SPELL_ACTION_CATEGORY + 0.04, // Energizing Brew
	[123402]: SPELL_ACTION_CATEGORY + 0.04, // Guard
	[115295]: SPELL_ACTION_CATEGORY + 0.04, // Guard
	[126456]: SPELL_ACTION_CATEGORY + 0.05, // Fortifying Brew
	[123904]: SPELL_ACTION_CATEGORY + 0.06, // Invoke Xuen, the White Tiger
	[115008]: SPELL_ACTION_CATEGORY + 0.06, // Chi Torpedo

	// Generic
	[53307]: SPELL_ACTION_CATEGORY + 0.931, // Thorns
	[54043]: SPELL_ACTION_CATEGORY + 0.932, // Retribution Aura
	[54758]: SPELL_ACTION_CATEGORY + 0.933, // Hyperspeed Acceleration
	[42641]: SPELL_ACTION_CATEGORY + 0.941, // Sapper
	[40536]: SPELL_ACTION_CATEGORY + 0.942, // Explosive Decoy
	[41119]: SPELL_ACTION_CATEGORY + 0.943, // Saronite Bomb
	[40771]: SPELL_ACTION_CATEGORY + 0.944, // Cobalt Frag Bomb
	[120687]: DEFAULT_ACTION_CATEGORY + 0.945, // Stormlash Totem
	[114206]: DEFAULT_ACTION_CATEGORY + 0.946, // Skull Bnaner
};

export const idsToGroupForRotation: Array<number> = [
	5171, // Rogue - Slice and Dice
	2098, // Rogue - Eviscerate
	1943, // Rogue - Rupture
	51690, // Rogue - Killing Spree
	32645, // Rogue - Envenom
	16511, // Rogue - Hemorrhage
	121471, // Rogue - Shadow Blades
];

export const percentageResources: Array<ResourceType> = [ResourceType.ResourceTypeHealth, ResourceType.ResourceTypeMana];
