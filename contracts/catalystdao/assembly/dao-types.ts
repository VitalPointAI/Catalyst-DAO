import { u128, Context } from 'near-sdk-as'

export type AccountId = string

// Global Constants

/** default = 17280 = 4.8 hours in seconds (5 periods per day) - NEAR - default = ~1 block/second (92 blocks/min) 5520 blocks/hour = 22080 (4 hours) = 6 periods/day */
export type PeriodDuration = i32 
/** default = 35 periods (7 days) - NEAR - default = 42 periods (7 days) */
export type VotingPeriodLength = i32 
/** default = 35 periods (7 days) = NEAR default = 42 periods (7 days) */
export type GracePeriodLength = i32 
/** default = 10 ETH (~$1,000 worth of ETH at contract deployment) */
export type ProposalDeposit = u128 
/** default = 3 - maximum multiplier a YES voter will be obligated to pay in case of mass ragequit */
export type DilutionBound = i32 
/** minimum % of total vote required for a proposal to pass - default - 51% */
export type VoteThreshold = i32

// *******************
// INTERNAL ACCOUNTING
// *******************
export const GUILD: AccountId = 'fund.' + Context.contractName
export const ESCROW: AccountId = 'escrow.' + Context.contractName
export const TOTAL: AccountId = 'total.'+ Context.contractName

export const XCC_GAS: u64 = 35000000000000

