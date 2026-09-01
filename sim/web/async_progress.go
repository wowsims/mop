package main

import (
	"slices"
	"sync"
	"sync/atomic"

	uuid "github.com/google/uuid"
	proto "github.com/wowsims/mop/sim/core/proto"
)

type asyncProgress struct {
	id             string
	latestProgress atomic.Value
	pendingMu      sync.Mutex
	// Buffered partial bulk reforge candidates that have not yet been delivered
	// to an asyncProgress poll response.
	pendingOptimizedCandidates []*proto.BulkGearCandidate
	pendingCandidateIndices    map[int32]struct{}
	// Candidate indices already delivered to the client via incremental
	// OptimizedCandidates progress payloads.
	deliveredCandidateIndices map[int32]struct{}
}

func (s *server) addNewSim() *asyncProgress {
	newID := uuid.NewString()
	simProgress := &asyncProgress{
		id:                        newID,
		pendingCandidateIndices:   make(map[int32]struct{}),
		deliveredCandidateIndices: make(map[int32]struct{}),
	}
	simProgress.latestProgress.Store(&proto.ProgressMetrics{})

	s.progMut.Lock()
	s.asyncProgresses[newID] = simProgress
	s.progMut.Unlock()

	return simProgress
}

func (p *asyncProgress) appendPendingOptimizedCandidates(candidates []*proto.BulkGearCandidate) {
	if len(candidates) == 0 {
		return
	}

	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		if _, delivered := p.deliveredCandidateIndices[candidate.Index]; delivered {
			continue
		}
		if _, exists := p.pendingCandidateIndices[candidate.Index]; exists {
			continue
		}
		p.pendingCandidateIndices[candidate.Index] = struct{}{}
		p.pendingOptimizedCandidates = append(p.pendingOptimizedCandidates, candidate)
	}
}

// Snapshot of the buffered candidates, still queued. They are only marked delivered once
// the response carrying them has actually been written, so a marshal or write failure
// leaves them for the next poll instead of dropping them: the final result filters out
// everything already handed over, so a candidate lost here is never sent at all and the
// frontend never writes its reforge-cache entry.
func (p *asyncProgress) peekPendingOptimizedCandidates() []*proto.BulkGearCandidate {
	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	return slices.Clone(p.pendingOptimizedCandidates)
}

func (p *asyncProgress) markOptimizedCandidatesDelivered(delivered []*proto.BulkGearCandidate) {
	if len(delivered) == 0 {
		return
	}

	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	for _, candidate := range delivered {
		if candidate == nil {
			continue
		}
		p.deliveredCandidateIndices[candidate.Index] = struct{}{}
		delete(p.pendingCandidateIndices, candidate.Index)
	}
	// More may have been appended while the response was being written, so drop exactly
	// the delivered ones rather than clearing the queue. Testing the delivered set is the
	// same test as "was in this batch": appendPendingOptimizedCandidates never queues an
	// index that is already delivered, so nothing else in the queue can match.
	p.pendingOptimizedCandidates = slices.DeleteFunc(p.pendingOptimizedCandidates, func(candidate *proto.BulkGearCandidate) bool {
		_, ok := p.deliveredCandidateIndices[candidate.Index]
		return ok
	})
}

func (p *asyncProgress) filterUndeliveredOptimizedCandidates(candidates []*proto.BulkGearCandidate) []*proto.BulkGearCandidate {
	if len(candidates) == 0 {
		return nil
	}

	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	filtered := make([]*proto.BulkGearCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		if _, delivered := p.deliveredCandidateIndices[candidate.Index]; delivered {
			continue
		}
		if _, pending := p.pendingCandidateIndices[candidate.Index]; pending {
			continue
		}
		filtered = append(filtered, candidate)
	}
	return filtered
}
