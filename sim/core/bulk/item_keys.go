package bulk

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

type bulkSimCandidateOption struct {
	spec *proto.ItemSpec
	item core.Item
}

type itemSpecCacheKey struct {
	id            int32
	randomSuffix  int32
	upgradeStep   proto.ItemLevelState
	challengeMode bool
}

// itemSpecFingerprintKey is a zero-allocation alternative to the string fingerprint.
// gemsHash is a position-weighted XOR of gem IDs; collision probability is negligible
// for the small, fixed set of gem IDs used in practice.
type itemSpecFingerprintKey struct {
	id            int32
	randomSuffix  int32
	enchant       int32
	tinker        int32
	reforging     int32
	upgradeStep   proto.ItemLevelState
	challengeMode bool
	gemsHash      uint64
}

func buildItemSpecFingerprintKey(item *proto.ItemSpec) itemSpecFingerprintKey {
	if item == nil {
		return itemSpecFingerprintKey{}
	}
	var gemsHash uint64
	for i, gem := range item.GetGems() {
		// Knuth multiplicative hash per position to make order matter.
		gemsHash ^= uint64(uint32(gem)*2654435761) << (uint(i) & 63)
	}
	return itemSpecFingerprintKey{
		id:            item.GetId(),
		randomSuffix:  item.GetRandomSuffix(),
		enchant:       item.GetEnchant(),
		tinker:        item.GetTinker(),
		reforging:     item.GetReforging(),
		upgradeStep:   item.GetUpgradeStep(),
		challengeMode: item.GetChallengeMode(),
		gemsHash:      gemsHash,
	}
}

func dedupeCandidateOptions(options []bulkSimCandidateOption, inheritUpgrades bool) []bulkSimCandidateOption {
	if len(options) <= 1 {
		return options
	}

	seen := make(map[itemSpecCacheKey]struct{}, len(options))
	deduped := make([]bulkSimCandidateOption, 0, len(options))
	// Indexed rather than ranged by value: a bulkSimCandidateOption embeds a whole core.Item.
	for i := range options {
		key := buildItemSpecKey(options[i].spec, inheritUpgrades)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		deduped = append(deduped, options[i])
	}

	return deduped
}

// Runs inside the O(n^2) weapon pairing loops, so the target key is built once up front rather than
// once per candidate, and the scan is indexed to avoid copying a core.Item per element.
func optionsContainEquivalent(options []bulkSimCandidateOption, target *bulkSimCandidateOption, inheritUpgrades bool) bool {
	targetKey := buildItemSpecKey(target.spec, inheritUpgrades)
	for i := range options {
		if buildItemSpecKey(options[i].spec, inheritUpgrades) == targetKey {
			return true
		}
	}
	return false
}

func candidateOptionsEqual(left *bulkSimCandidateOption, right *bulkSimCandidateOption, inheritUpgrades bool) bool {
	return buildItemSpecKey(left.spec, inheritUpgrades) == buildItemSpecKey(right.spec, inheritUpgrades)
}

func candidateOptionEqualsItem(option *bulkSimCandidateOption, item *core.Item, inheritUpgrades bool) bool {
	return buildItemSpecKey(option.spec, inheritUpgrades) == buildItemKey(item, inheritUpgrades)
}

func candidateOptionEqualsItemPtr(option *bulkSimCandidateOption, item *core.Item, inheritUpgrades bool) bool {
	if option == nil || item == nil {
		return option == nil && item == nil
	}
	return candidateOptionEqualsItem(option, item, inheritUpgrades)
}

// Keyed straight off the item: ToItemSpecProto would allocate a proto message and a gems slice to
// hand back four scalars.
func buildItemKey(item *core.Item, inheritUpgrades bool) itemSpecCacheKey {
	key := itemSpecCacheKey{
		id:            item.ID,
		randomSuffix:  item.RandomSuffix.ID,
		challengeMode: item.ChallengeMode,
	}
	if inheritUpgrades {
		return key
	}
	key.upgradeStep = item.UpgradeStep
	return key
}

func buildItemSpecKey(itemSpec *proto.ItemSpec, inheritUpgrades bool) itemSpecCacheKey {
	if itemSpec == nil {
		return itemSpecCacheKey{}
	}
	key := itemSpecCacheKey{
		id:            itemSpec.GetId(),
		randomSuffix:  itemSpec.GetRandomSuffix(),
		challengeMode: itemSpec.GetChallengeMode(),
	}
	if inheritUpgrades {
		return key
	}
	key.upgradeStep = itemSpec.GetUpgradeStep()
	return key
}
