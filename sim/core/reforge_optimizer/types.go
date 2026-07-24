package reforgeoptimizer

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const (
	optimizerTimeout                = 30 * time.Second
	relativeStatCapOptimizerTimeout = 120 * time.Second
	relativeStatCapMIPRelGap        = 0.0005
)

type reforgeChoice struct {
	slot              proto.ItemSlot
	hasReforge        bool
	reforgeID         int32
	gems              []reforgeGemChoice
	socketChoice      bool
	socketIdx         int
	socketMatches     bool
	socketBonus       bool
	bonusSocketIdxs   []int
	forcedBonusDelta  core.UnitStats
	jewelcraftingGems int
	shaTouchedGems    int
	uniqueGemIDs      []int32
	delta             core.UnitStats
	objectiveDelta    core.UnitStats
	score             float64
}

type reforgeGemChoice struct {
	socketIdx int
	gemID     int32
}

type reforgeGemOption struct {
	id              int32
	color           proto.GemColor
	isJewelcrafting bool
	unique          bool
	score           float64
	cappedStats     []stats.UnitStat
}

type reforgeSlotChoices struct {
	slot    proto.ItemSlot
	choices []reforgeChoice
}

type reforgeHardCap struct {
	unitStat   stats.UnitStat
	cap        float64
	undershoot bool
}

type reforgeSoftCap struct {
	unitStat    stats.UnitStat
	breakpoints []float64
	postCapEPs  []float64
	capType     proto.StatCapType
}

type reforgeRelativeStatCap struct {
	forcedStat      stats.UnitStat
	constrainedStat stats.UnitStat
	minDelta        float64
	actualMinDelta  float64
	adjustWeight    bool
}

type reforgeOptimization struct {
	request      *proto.ReforgeOptimizeRequest
	settings     *proto.ReforgeSettings
	player       *proto.Player
	baseRaid     *proto.Raid
	originalGear *proto.EquipmentSpec
	baseGear     *proto.EquipmentSpec
	capBaseStats core.UnitStats
	weights      core.UnitStats
	hardCaps     []reforgeHardCap
	softCaps     []reforgeSoftCap
	relativeCaps []reforgeRelativeStatCap
	slotChoices  []reforgeSlotChoices
	ampModifier  float64
}

type normalizedReforgeOptimizeConfig struct {
	settings *proto.ReforgeSettings
	softCaps []*proto.StatCapConfig
}

type reforgeSearchState struct {
	request        *proto.ReforgeOptimizeRequest
	baseRaid       *proto.Raid
	baseEquipment  core.Equipment
	capBaseStats   core.UnitStats
	slots          []reforgeSlotChoices
	weights        core.UnitStats
	hardCaps       []reforgeHardCap
	hardCapsByStat map[stats.UnitStat]reforgeHardCap
	softCaps       []reforgeSoftCap
	softCapsByStat map[stats.UnitStat]reforgeSoftCap
	relativeCaps   []reforgeRelativeStatCap
	ampModifier    float64

	// Pre-allocated per-solve working state — avoids repeated allocations across solver passes.
	workingRaid         *proto.Raid                // reused across selectedChoicesCapDelta calls
	workingStatsRequest *proto.ComputeStatsRequest // bound to workingRaid
	choiceVarIdx        [][]int                    // reused across buildChoiceMIPModel calls
	uniqueGemIDs        []int32                    // cached once; gem choices never change
}
