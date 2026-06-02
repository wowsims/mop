package main

import (
	"github.com/wowsims/mop/sim/bulk"
	"github.com/wowsims/mop/sim/core/proto"
)

func ensureBulkSimCandidatesGenerated(request *proto.BulkSimRequest) error {
	return bulk.EnsureBulkSimCandidatesGenerated(request)
}

func BulkCombinationCount(request *proto.BulkCombinationCountRequest) *proto.BulkCombinationCountResult {
	return bulk.BulkCombinationCount(request)
}

func BulkCandidates(request *proto.BulkCandidatesRequest) *proto.BulkCandidatesResult {
	return bulk.BulkCandidates(request)
}
