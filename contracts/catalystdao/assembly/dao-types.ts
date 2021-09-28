import { u128 } from 'near-sdk-as'

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

export const ONE_NEAR = u128.from('1000000000000000000000000')

// *******************
// INTERNAL ACCOUNTING
// *******************
export const GUILD: AccountId = 'fund.vitalpointai.testnet'
export const ESCROW: AccountId = 'escrow.vitalpointai.testnet'
export const TOTAL: AccountId = 'total.vitalpointai.testnet'

// *****************
// HARD-CODED LIMITS
// These numbers are quite arbitrary; they are small enough to avoid overflows
// when doing calculations with periods or shares, yet big enough to not limit 
// reasonable use cases.
// *****************
export const MAX_VOTING_PERIOD_LENGTH: i32 = 10**8 // maximum length of voting period
export const MAX_GRACE_PERIOD_LENGTH:i32 = 10**8 // maximum length of grace period
export const MAX_DILUTION_BOUND: i32 = 10**8 // maximum dilution bound
export const MAX_NUMBER_OF_SHARES_AND_LOOT: i32 = 10**8 // maximum number of shares that can be minted
export const MAX_TOKEN_WHITELIST_COUNT: i32 = 400 // maximum number of whitelisted tokens
export const MAX_TOKEN_GUILDBANK_COUNT: i32 = 400 // maximum number of tokens with non-zero balance in guildbank