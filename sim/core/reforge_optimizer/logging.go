package reforgeoptimizer

import (
	"fmt"
	"log"
	"math"
	"strings"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func logRequestInput(requestID uint64, request *proto.ReforgeOptimizeRequest, normalizedConfig *normalizedReforgeOptimizeConfig) {
	settings := normalizedConfig.settings
	softCaps := normalizedConfig.softCaps
	log.Printf("[reforgeOptimize:%d] request", requestID)
	log.Printf("[reforgeOptimize:%d]   id=%q", requestID, request.GetRequestId())
	log.Printf("[reforgeOptimize:%d]   settings", requestID)
	log.Printf("[reforgeOptimize:%d]     includeGems=%t includeEotbGemSocket=%t", requestID, settings.GetIncludeGems(), settings.GetIncludeEotbGemSocket())
	log.Printf("[reforgeOptimize:%d]     useSoftCapBreakpoints=%t freezeItemSlots=%t", requestID, settings.GetUseSoftCapBreakpoints(), settings.GetFreezeItemSlots())
	log.Printf("[reforgeOptimize:%d]     frozenSlots=%s", requestID, formatItemSlots(settings.GetFrozenItemSlots()))
	log.Printf("[reforgeOptimize:%d]   inputs gemOptions=%d baselineItems=%d softCaps=%d", requestID, len(request.GetGemOptions()), baselineItemCount(request), len(softCaps))
	log.Printf("[reforgeOptimize:%d]   caps", requestID)
	logProtoUnitStats(requestID, "    hard", settings.GetStatCaps())
	logProtoUnitStats(requestID, "    undershoot", request.GetUndershootCaps())
	logProtoUnitStats(requestID, "    breakpoints", settings.GetBreakpointLimits())
	log.Printf("[reforgeOptimize:%d]   weights preCap", requestID)
	logProtoUnitStats(requestID, "    ", request.GetPreCapEpWeights())
	for idx, softCap := range softCaps {
		if idx == 0 {
			log.Printf("[reforgeOptimize:%d]   softCaps", requestID)
		}
		log.Printf("[reforgeOptimize:%d]     [%d] stat=%s", requestID, idx, formatUIStat(softCap.GetUnitStat()))
		log.Printf("[reforgeOptimize:%d]         type=%s", requestID, softCap.GetCapType().String())
		log.Printf("[reforgeOptimize:%d]         breakpoints=%s", requestID, formatFloat64Slice(softCap.GetBreakpoints()))
		log.Printf("[reforgeOptimize:%d]         postCapEPs=%s", requestID, formatFloat64Slice(softCap.GetPostCap_EPs()))
	}
}

func baselineItemCount(request *proto.ReforgeOptimizeRequest) int {
	if request.GetRaid() == nil || len(request.GetRaid().GetParties()) == 0 || len(request.GetRaid().GetParties()[0].GetPlayers()) == 0 {
		return 0
	}
	return len(request.GetRaid().GetParties()[0].GetPlayers()[0].GetEquipment().GetItems())
}

func logProtoUnitStats(requestID uint64, label string, unitStats *proto.UnitStats) {
	parts := protoUnitStatParts(unitStats)
	if len(parts) == 0 {
		log.Printf("[reforgeOptimize:%d] %s=none", requestID, label)
		return
	}
	if strings.TrimSpace(label) != "" {
		log.Printf("[reforgeOptimize:%d] %s", requestID, label)
		label = "      "
	}
	for _, part := range parts {
		log.Printf("[reforgeOptimize:%d] %s%s", requestID, label, part)
	}
}

func logOptimizedGearSummary(requestID uint64, equipment *proto.EquipmentSpec) {
	reforges := 0
	gems := 0
	for _, item := range equipment.GetItems() {
		if item.GetReforging() != 0 {
			reforges++
		}
		for _, gemID := range item.GetGems() {
			if gemID != 0 {
				gems++
			}
		}
	}
	log.Printf("[reforgeOptimize:%d] optimized gear contains reforges=%d gems=%d", requestID, reforges, gems)
}

func logCapEvaluation(requestID uint64, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, optimizedDelta core.UnitStats) {
	for _, cap := range hardCaps {
		value := getUnitStat(optimizedDelta, cap.unitStat)
		status := hardCapStatus(cap, value)
		log.Printf("[reforgeOptimize:%d] hardcap stat=%s valueDelta=%.3f capDelta=%.3f mode=%s status=%s", requestID, unitStatName(cap.unitStat), value, cap.cap, hardCapMode(cap), status)
	}
	for _, cap := range softCaps {
		value := getUnitStat(optimizedDelta, cap.unitStat)
		reached := 0
		nextGap := math.Inf(1)
		for _, breakpoint := range cap.breakpoints {
			if value+1e-6 >= breakpoint {
				reached++
			} else {
				nextGap = math.Min(nextGap, breakpoint-value)
			}
		}
		if math.IsInf(nextGap, 1) {
			log.Printf("[reforgeOptimize:%d] softcap stat=%s valueDelta=%.3f reached=%d/%d status=all-reached", requestID, unitStatName(cap.unitStat), value, reached, len(cap.breakpoints))
		} else {
			log.Printf("[reforgeOptimize:%d] softcap stat=%s valueDelta=%.3f reached=%d/%d nextGap=%.3f", requestID, unitStatName(cap.unitStat), value, reached, len(cap.breakpoints), nextGap)
		}
	}
}

func logSelectedChoices(requestID uint64, choices []reforgeChoice) {
	reforgeChoices := 0
	gemChoices := 0
	socketBonusChoices := 0
	totalScoreDelta := 0.0
	changedSlots := make([]string, 0)
	seenSlots := map[proto.ItemSlot]bool{}
	for _, choice := range choices {
		if choice.reforgeID == 0 && len(choice.gems) == 0 {
			if choice.socketBonus && len(choice.bonusSocketIdxs) > 0 {
				socketBonusChoices++
			}
			continue
		}
		if choice.reforgeID != 0 {
			reforgeChoices++
		}
		if len(choice.gems) > 0 {
			gemChoices += len(choice.gems)
		}
		if choice.socketBonus && len(choice.bonusSocketIdxs) > 0 {
			socketBonusChoices++
		}
		totalScoreDelta += choice.score
		if !seenSlots[choice.slot] {
			seenSlots[choice.slot] = true
			changedSlots = append(changedSlots, choice.slot.String())
		}
	}
	log.Printf("[reforgeOptimize:%d] selected choices reforges=%d gemSockets=%d socketBonuses=%d changedSlots=%d sample=%s scoreDelta=%.3f", requestID, reforgeChoices, gemChoices, socketBonusChoices, len(changedSlots), formatLimitedStringList(changedSlots, 8), totalScoreDelta)
}

func hardCapMode(cap reforgeHardCap) string {
	if cap.undershoot {
		return "max"
	}
	return "min"
}

func hardCapStatus(cap reforgeHardCap, value float64) string {
	if cap.undershoot {
		if value > cap.cap+1e-6 {
			return "exceeded"
		}
		return "met"
	}
	if value+1e-6 < cap.cap {
		return "below"
	}
	return "met"
}

func unitStatName(unitStat stats.UnitStat) string {
	if unitStat.IsStat() {
		return stats.Stat(unitStat.StatIdx()).StatName()
	}
	return proto.PseudoStat(unitStat.PseudoStatIdx()).String()
}

func formatItemSlots(slots []proto.ItemSlot) string {
	if len(slots) == 0 {
		return "none"
	}
	parts := make([]string, 0, len(slots))
	for _, slot := range slots {
		parts = append(parts, slot.String())
	}
	return formatStringList(parts)
}

func formatStringList(parts []string) string {
	if len(parts) == 0 {
		return "none"
	}
	return strings.Join(parts, ",")
}

func formatLimitedStringList(parts []string, limit int) string {
	if len(parts) == 0 {
		return "none"
	}
	if limit <= 0 || len(parts) <= limit {
		return strings.Join(parts, ",")
	}
	return fmt.Sprintf("%s,+%d more", strings.Join(parts[:limit], ","), len(parts)-limit)
}

func protoUnitStatParts(unitStats *proto.UnitStats) []string {
	if unitStats == nil {
		return nil
	}
	parts := make([]string, 0)
	for statIdx, value := range unitStats.GetStats() {
		if value == 0 {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%.3f", stats.Stat(statIdx).StatName(), value))
	}
	for pseudoStatIdx, value := range unitStats.GetPseudoStats() {
		if value == 0 {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%.3f", proto.PseudoStat(pseudoStatIdx).String(), value))
	}
	return parts
}

func formatUIStat(uiStat *proto.UIStat) string {
	unitStat, ok := unitStatFromUIStat(uiStat)
	if !ok {
		return "unknown"
	}
	return unitStatName(unitStat)
}

func formatFloat64Slice(values []float64) string {
	if len(values) == 0 {
		return "none"
	}
	parts := make([]string, 0, len(values))
	for _, value := range values {
		parts = append(parts, fmt.Sprintf("%.3f", value))
	}
	return strings.Join(parts, ",")
}
