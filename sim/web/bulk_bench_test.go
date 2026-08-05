//go:build with_db

package main

// End-to-end BulkSim benchmark exercising the full production flow:
//   EnsureBulkSimCandidatesGenerated → parallel reforge optimize (with gear cache)
//   → deduplicate by optimized gear → multistage bulk sim
//
// Loads mage-candidates-reference.json from the repository root.
//
// Usage:
//
//	# Full end-to-end (reforge + bulk sim), single iteration:
//	go test -tags with_db ./sim/web/ \
//	    -bench BenchmarkBulkSimMageFullFlow -benchtime 1x -benchmem -v -timeout 7200s
//
//	# Before/after analytical-path comparison — stash the analytical changes and re-run.

import (
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
	googleProto "google.golang.org/protobuf/proto"
)

const mageBulkRequestPath = "../../mage-candidates-reference.json"

func loadMageBulkSimRequest(tb testing.TB) *proto.BulkSimRequest {
	tb.Helper()
	data, err := os.ReadFile(mageBulkRequestPath)
	if err != nil {
		tb.Skipf("mage-candidates-reference.json not found at %q — skipping", mageBulkRequestPath)
		return nil
	}
	var req proto.BulkSimRequest
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(data, &req); err != nil {
		tb.Fatalf("protojson.Unmarshal: %v", err)
	}
	// BENCH_MAX_ITEMS limits the bulk item list for quick sweep iterations.
	if raw := os.Getenv("BENCH_MAX_ITEMS"); raw != "" {
		if n, err2 := strconv.Atoi(raw); err2 == nil && n > 0 && req.BulkSettings != nil {
			if n < len(req.BulkSettings.Items) {
				req.BulkSettings.Items = req.BulkSettings.Items[:n]
			}
		}
	}
	return &req
}

// BenchmarkBulkSimMageFullFlow runs the complete production pipeline via
// BulkSimAsync: candidate generation → parallel reforge optimize (with gear
// cache) → dedup by optimized gear → multistage bulk sim.
//
// Reports reforge_s, bulksim_s, sim_candidates, and top_dps per operation.
func BenchmarkBulkSimMageFullFlow(b *testing.B) {
	sim.RegisterAll()

	req := loadMageBulkSimRequest(b)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Clone so each iteration starts clean — BulkSimAsync mutates Candidates/OptimizedCandidates.
		iterReq := googleProto.Clone(req).(*proto.BulkSimRequest)

		progress := make(chan *proto.ProgressMetrics, 256)
		requestID := fmt.Sprintf("bench-bulk-mage-%d", i)

		phaseTimings := make(map[proto.BulkSimStage]time.Time)
		phaseDurations := make(map[proto.BulkSimStage]time.Duration)
		var prevStage proto.BulkSimStage
		prevTime := time.Now()

		// Collect progress in a goroutine so we can track phase transitions.
		type phaseResult struct {
			final   *proto.BulkSimResult
			timings map[proto.BulkSimStage]time.Duration
		}
		resultCh := make(chan phaseResult, 1)
		go func() {
			for msg := range progress {
				stage := msg.GetBulkStage()
				if stage != prevStage {
					now := time.Now()
					if prevStage != proto.BulkSimStage_BulkSimStageUnknown {
						phaseDurations[prevStage] = now.Sub(prevTime)
					}
					phaseTimings[stage] = now
					prevTime = now
					prevStage = stage
				}
				if msg.GetFinalBulkSimResult() != nil {
					resultCh <- phaseResult{final: msg.GetFinalBulkSimResult(), timings: phaseDurations}
					return
				}
			}
			resultCh <- phaseResult{timings: phaseDurations}
		}()

		BulkSimAsync(iterReq, progress, requestID)
		res := <-resultCh

		if err := res.final.GetError(); err != nil {
			b.Errorf("iter %d: BulkSim error: %s", i, err.GetMessage())
			continue
		}

		topDPS := 0.0
		for _, r := range res.final.GetTopResults() {
			if dps := r.GetDpsMetrics().GetAvg(); dps > topDPS {
				topDPS = dps
			}
		}

		reforgeDur := res.timings[proto.BulkSimStage_BulkSimStageReforge]
		simDur := res.timings[proto.BulkSimStage_BulkSimStageLow] +
			res.timings[proto.BulkSimStage_BulkSimStageMedium] +
			res.timings[proto.BulkSimStage_BulkSimStageHigh]

		simCandidates := len(iterReq.GetCandidates())
		b.Logf("iter %d: optimizedCandidates=%d simCandidates=%d reforge=%s bulksim=%s topDPS=%.1f results=%d",
			i, len(iterReq.GetOptimizedCandidates()), simCandidates,
			reforgeDur, simDur, topDPS, len(res.final.GetTopResults()))

		b.ReportMetric(reforgeDur.Seconds(), "reforge_s/op")
		b.ReportMetric(simDur.Seconds(), "bulksim_s/op")
		b.ReportMetric(float64(simCandidates), "sim_candidates/op")
		b.ReportMetric(topDPS, "top_dps/op")
	}
}
