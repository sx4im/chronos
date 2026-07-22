// Built-in demo capsule for immediate interactive exploration on the landing page.
import type { ParsedCapsule } from "./capsule.js";

export const DEMO_CAPSULE: ParsedCapsule = {
  seed: "8273461",
  nodes: ["node-0", "node-1", "node-2", "node-3", "node-4"],
  invariant: {
    name: "at-most-one-leader",
    detail: "nodes node-1 and node-3 both claim term 4 leadership during network partition",
  },
  trace: {
    seed: "8273461",
    config: {
      network: { dropProb: 0.05, minLatency: 5, maxLatency: 45 },
      chaos: { partitionProb: 0.05, crashProb: 0.02 },
    },
    nodes: ["node-0", "node-1", "node-2", "node-3", "node-4"],
    result: "violation",
    events: [
      { seq: 0, t: 0, kind: "wake", nodeId: "node-0" },
      { seq: 1, t: 0, kind: "wake", nodeId: "node-1" },
      { seq: 2, t: 0, kind: "wake", nodeId: "node-2" },
      { seq: 3, t: 0, kind: "wake", nodeId: "node-3" },
      { seq: 4, t: 0, kind: "wake", nodeId: "node-4" },

      { seq: 5, t: 15, kind: "timer", nodeId: "node-1" },
      { seq: 6, t: 15, kind: "send", from: "node-1", to: "node-0", summary: "RequestVote term=1 candidate=node-1" },
      { seq: 7, t: 15, kind: "send", from: "node-1", to: "node-2", summary: "RequestVote term=1 candidate=node-1" },
      { seq: 8, t: 15, kind: "send", from: "node-1", to: "node-3", summary: "RequestVote term=1 candidate=node-1" },

      { seq: 9, t: 28, kind: "deliver", from: "node-1", to: "node-0", summary: "RequestVote term=1 candidate=node-1" },
      { seq: 10, t: 28, kind: "send", from: "node-0", to: "node-1", summary: "RequestVoteResp term=1 voteGranted=true" },

      { seq: 11, t: 32, kind: "deliver", from: "node-1", to: "node-2", summary: "RequestVote term=1 candidate=node-1" },
      { seq: 12, t: 32, kind: "send", from: "node-2", to: "node-1", summary: "RequestVoteResp term=1 voteGranted=true" },

      { seq: 13, t: 45, kind: "deliver", from: "node-0", to: "node-1", summary: "RequestVoteResp term=1 voteGranted=true" },
      { seq: 14, t: 50, kind: "deliver", from: "node-2", to: "node-1", summary: "RequestVoteResp term=1 voteGranted=true" },

      { seq: 15, t: 50, kind: "timer", nodeId: "node-1" },
      { seq: 16, t: 50, kind: "send", from: "node-1", to: "node-0", summary: "Heartbeat term=1 leader=node-1" },
      { seq: 17, t: 50, kind: "send", from: "node-1", to: "node-2", summary: "Heartbeat term=1 leader=node-1" },
      { seq: 18, t: 50, kind: "send", from: "node-1", to: "node-3", summary: "Heartbeat term=1 leader=node-1" },
      { seq: 19, t: 50, kind: "send", from: "node-1", to: "node-4", summary: "Heartbeat term=1 leader=node-1" },

      { seq: 20, t: 120, kind: "partition", groups: [["node-0", "node-1"], ["node-2", "node-3", "node-4"]], healAt: 350 },

      { seq: 21, t: 160, kind: "timer", nodeId: "node-3" },
      { seq: 22, t: 160, kind: "send", from: "node-3", to: "node-2", summary: "RequestVote term=2 candidate=node-3" },
      { seq: 23, t: 160, kind: "send", from: "node-3", to: "node-4", summary: "RequestVote term=2 candidate=node-3" },

      { seq: 24, t: 180, kind: "deliver", from: "node-3", to: "node-2", summary: "RequestVote term=2 candidate=node-3" },
      { seq: 25, t: 180, kind: "send", from: "node-2", to: "node-3", summary: "RequestVoteResp term=2 voteGranted=true" },

      { seq: 26, t: 185, kind: "deliver", from: "node-3", to: "node-4", summary: "RequestVote term=2 candidate=node-3" },
      { seq: 27, t: 185, kind: "send", from: "node-4", to: "node-3", summary: "RequestVoteResp term=2 voteGranted=true" },

      { seq: 28, t: 205, kind: "deliver", from: "node-2", to: "node-3", summary: "RequestVoteResp term=2 voteGranted=true" },
      { seq: 29, t: 210, kind: "deliver", from: "node-4", to: "node-3", summary: "RequestVoteResp term=2 voteGranted=true" },

      { seq: 30, t: 250, kind: "crash", nodeId: "node-2" },

      { seq: 31, t: 350, kind: "restart", nodeId: "node-2" },

      { seq: 32, t: 355, kind: "invariant-violation", name: "at-most-one-leader", detail: "nodes node-1 and node-3 both claim term 4 leadership during network partition" },
    ],
  },
};
