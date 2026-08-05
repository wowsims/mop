package dbc

import (
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

type RandomSuffix struct {
	ID            int
	Name          string
	AllocationPct []int // AllocationPct_0-4
	EffectArgs    []int // EffectArg_0-4
	Effects       []int // Effect_0-4
}

func (raw RandomSuffix) ToProto() *proto.ItemRandomSuffix {
	// A suffix stores an allocation share of the item's stat budget rather than a flat amount,
	// so what lands in Stats here is AllocationPct and the consumer scales it by rand prop
	// points. Attack power is not mirrored onto ranged attack power: no item references a
	// suffix that grants raw attack power, so there is nothing to decide.
	suffixStats := stats.Stats{}
	processEnchantmentEffects(raw.Effects, raw.EffectArgs, raw.AllocationPct, &suffixStats, false)

	suffix := &proto.ItemRandomSuffix{
		Name:  raw.Name,
		Id:    int32(raw.ID),
		Stats: suffixStats.ToProtoArray(),
	}

	// Some suffixes ship without a name and are known by the stat they grant. Every one of
	// those resolves to a single stat, so the first non-zero entry is that stat.
	if suffix.Name == "" {
		for stat, amount := range suffixStats {
			if amount != 0 {
				suffix.Name = stats.Stat(stat).StatName()
				break
			}
		}
	}

	return suffix
}
