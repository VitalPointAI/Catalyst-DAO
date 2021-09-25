import { u128 } from 'near-sdk-as'

export type AccountId = string

// Global Constants

/** ~1 block/second (92 blocks/min) 5520 blocks/hour = 22080 (4 hours) = 6 periods/day */
export type PeriodDuration = i32 
/** 42 periods (7 days) */
export type VotingPeriodLength = i32 
/** 42 periods (7 days) */
export type GracePeriodLength = i32 
/**  */
export type ProposalDeposit = u128 
/** maximum multiplier a YES voter will be obligated to pay in case of mass ragequit */
export type DilutionBound = i32 
/** minimum % of total vote required for a proposal to pass - default - 51% */
export type VoteThreshold = i32 

export const ONE_NEAR = u128.from('1000000000000000000000000');

// *******************
// INTERNAL ACCOUNTING
// *******************
export const GUILD: AccountId = 'fund.vitalpointai.testnet'
export const ESCROW: AccountId = 'escrow.vitalpointai.testnet'
export const TOTAL: AccountId = 'total.vitalpointai.testnet'

