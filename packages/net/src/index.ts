// @sx4im/chronos-net — virtual network and fault injection layer on top of @sx4im/chronos-core.
//
// Extracted from @sx4im/chronos-core in Phase 3.1: the Simulator still owns the
// event loop and dependency injection, but the fault-injecting `SimNetwork`
// lives here so a future chaos engine and additional fault types can evolve
// without polluting the (dependency-free) core. Core injects this via its
// `netFactory` option — core never imports this package (no package cycle).

export {
  SimNetwork,
  PartitionManager,
  DEFAULT_NETWORK,
  type Message,
  type NetworkConfig,
  type SimNetworkOptions,
  type DeliverFn,
  type TraceLogger,
} from "./network.js";
