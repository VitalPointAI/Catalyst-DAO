  

import { Context, storage, env, u128, ContractPromiseBatch, PersistentVector } from "near-sdk-as"

import { 
  AccountId, 
  PeriodDuration, 
  VotingPeriodLength, 
  GracePeriodLength, 
  ProposalDeposit, 
  DilutionBound,
  VoteThreshold
} from './dao-types'

import { 
  userTokenBalances,
  members,
  memberAddressByDelegatekey,
  tokenWhiteList,
  communityRole,
  memberRoles,
  roles,
  reputationFactor,
  reputationFactors,
  memberReputationFactors,
  Member,
  Proposal,
  proposals,
  proposedToWhiteList,
  proposedToKick,
  approvedTokens,
  votesByMember,
  Votes,
  TokenBalances,
  Donation,
  contributions,
  delegation,
  delegationInfo,
  GenericObject
 } from './dao-models'

import {
  ERR_DAO_ALREADY_INITIALIZED,
  ERR_MUSTBE_GREATERTHAN_ZERO,
  ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH,
  ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH,
  ERR_DILUTIONBOUND_ZERO,
  ERR_DILUTIONBOUND_LIMIT,
  ERR_APPROVEDTOKENS,
  ERR_TOO_MANY_TOKENS,
  ERR_DUPLICATE_TOKEN,
  ERR_TOO_MANY_SHARES,
  ERR_NOT_WHITELISTED,
  ERR_NOT_WHITELISTED_PT,
  ERR_ALREADY_WHITELISTED,
  ERR_TOO_MANY_WHITELISTED,
  ERR_NOT_SHAREHOLDER,
  ERR_RESERVED,
  ERR_CANNOT_RAGEQUIT,
  ERR_JAILED,
  ERR_ALREADY_SPONSORED,
  ERR_FULL_GUILD_BANK,
  ERR_GREATER_ZERO_TOTALSHARES,
  ERR_NO_OVERWRITE_KEY,
  ERR_NO_OVERWRITE_MEMBER,
  ERR_PROPOSAL_PROCESSED,
  ERR_SHAREORLOOT,
  ERR_INSUFFICIENT_SHARES,
  ERR_INSUFFICIENT_LOOT,
  ERR_WHITELIST_PROPOSAL,
  ERR_PROPOSAL_NO,
  ERR_NOT_DELEGATE,
  ERR_VOTE_INVALID,
  ERR_ALREADY_VOTED,
  ERR_ALREADY_CANCELLED,
  ERR_VOTING_PERIOD_EXPIRED,
  ERR_VOTING_NOT_STARTED,
  ERR_STANDARD_PROPOSAL,
  ERR_GUILD_PROPOSAL,
  ERR_HAVE_LOOT,
  ERR_IN_JAIL,
  ERR_NOT_READY,
  ERR_INVALID_ACCOUNT_ID,
  ERR_INSUFFICIENT_BALANCE,
  ERR_NOT_A_MEMBER
} from './dao-error-messages'

// HARD-CODED LIMITS
// These numbers are quite arbitrary; they are small enough to avoid overflows when doing calculations
// with periods or shares, yet big enough to not limit reasonable use cases.
const MAX_VOTING_PERIOD_LENGTH: i32 = 10**8 // maximum length of voting period
const MAX_GRACE_PERIOD_LENGTH:i32 = 10**8 // maximum length of grace period
const MAX_DILUTION_BOUND: i32 = 10**8 // maximum dilution bound
const MAX_NUMBER_OF_SHARES_AND_LOOT: i32 = 10**8 // maximum number of shares that can be minted
const MAX_TOKEN_WHITELIST_COUNT: i32 = 400 // maximum number of whitelisted tokens
const MAX_TOKEN_GUILDBANK_COUNT: i32 = 400 // maximum number of tokens with non-zero balance in guildbank

// *******************
// INTERNAL ACCOUNTING
// *******************
let depositToken: string
const GUILD: AccountId = 'fund.vitalpointai.testnet'
const ESCROW: AccountId = 'escrow.vitalpointai.testnet'
const TOTAL: AccountId = 'total.vitalpointai.testnet'


// ********************
// MODIFIERS
// ********************

/**
* Returns the owner (summoner) which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param owner 
*/
export function isOwner(summoner: AccountId): boolean {
  assert(env.isValidAccountID(summoner), ERR_INVALID_ACCOUNT_ID)
  return summoner == storage.getSome<string>("summoner")
}

/**
* Returns the shareholder which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param shareholder
*/
export function onlyShareholder(shareholder: AccountId): boolean {
  assert(env.isValidAccountID(shareholder), ERR_INVALID_ACCOUNT_ID)
  assert(members.get(shareholder)!=null, ERR_NOT_A_MEMBER)
  let shareholderExists = members.getSome(shareholder)
  return u128.gt(shareholderExists.shares, u128.Zero) ? true : false
}

/**
* Returns the member which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param member 
*/
export function onlyMember(member: AccountId): boolean {
  assert(env.isValidAccountID(member), ERR_INVALID_ACCOUNT_ID)
  assert(members.contains(member), ERR_NOT_A_MEMBER)
  let memberExists = members.getSome(member);
  return u128.gt(memberExists.shares, u128.Zero) || u128.gt(memberExists.loot, u128.Zero) ? true : false
}

/**
* Returns the delegate which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param delegate
*/
export function onlyDelegate(delegate: AccountId): boolean {
  assert(env.isValidAccountID(delegate), ERR_INVALID_ACCOUNT_ID)
  assert(memberAddressByDelegatekey.contains(delegate), ERR_NOT_DELEGATE)
  let memberDelegateExists = members.getSome(delegate)
  return u128.gt(memberDelegateExists.shares, u128.Zero) ? true : false
}


// ****************************
// COMMUNITY DAO INITIALIZATION
// ****************************

/**
 * Init function that summons a new community DAO into existence 
 * @param _approvedTokens
 * @param _periodDuration
 * @param _votingPeriodLength
 * @param _gracePeriodLength
 * @param _proposalDeposit
 * @param _dilutionBound
 * @param _voteThreshold
 * @param _shares
 * @param _contractId
 */

export function init(
    _approvedTokens: Array<string>,
    _periodDuration: PeriodDuration,
    _votingPeriodLength: VotingPeriodLength,
    _gracePeriodLength: GracePeriodLength,
    _proposalDeposit: ProposalDeposit,
    _dilutionBound: DilutionBound,
    _voteThreshold: VoteThreshold,
    _shares: u128,
    _contractId: AccountId
): u64 {
  assert(storage.get<string>("init") == null, ERR_DAO_ALREADY_INITIALIZED)
  assert(_periodDuration > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
  assert(_votingPeriodLength > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
  assert(_votingPeriodLength <= MAX_VOTING_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH)
  assert(_gracePeriodLength <= MAX_GRACE_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH)
  assert(_dilutionBound > 0, ERR_DILUTIONBOUND_ZERO)
  assert(_dilutionBound <= MAX_DILUTION_BOUND, ERR_DILUTIONBOUND_LIMIT)
  assert(_voteThreshold <= 100, 'must be between 1 and 100')
  assert(_voteThreshold > 0, 'must be between 0 and 100')
  assert(_approvedTokens.length > 0, ERR_APPROVEDTOKENS)
  assert(_approvedTokens.length <= MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_TOKENS)
  assert(u128.le(_shares, u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT)), ERR_TOO_MANY_SHARES)
  assert(u128.gt(_shares, u128.Zero), 'invalid contribution')
  assert(env.isValidAccountID(_contractId), ERR_INVALID_ACCOUNT_ID)
  assert(u128.eq(Context.attachedDeposit, u128.mul(_shares, u128.from('1000000000000000000000000'))), 'attached deposit must match shares')
 
  depositToken = _approvedTokens[0]
  storage.set<string>('depositToken', depositToken)

  for (let i: i32 = 0; i < _approvedTokens.length; i++) {
    if(_approvedTokens[i] != 'Ⓝ' ){
    assert(env.isValidAccountID(_approvedTokens[i]), ERR_INVALID_ACCOUNT_ID)
    }
    if(tokenWhiteList.contains(_approvedTokens[i])) {
      assert(!tokenWhiteList.getSome(_approvedTokens[i]), ERR_DUPLICATE_TOKEN)
    } else {
      tokenWhiteList.set(_approvedTokens[i], true)
    }
    approvedTokens.push(_approvedTokens[i])
  }
  
  //set Summoner
  storage.set<string>('summoner', Context.predecessor)

  //set periodDuration
  storage.set<i32>('periodDuration', _periodDuration)

  //set votingPeriodLength
  storage.set<i32>('votingPeriodLength', _votingPeriodLength)

  //set gracePeriodLength
  storage.set<i32>('gracePeriodLength', _gracePeriodLength)

  //set proposalDeposit
  storage.set<u128>('proposalDeposit', _proposalDeposit)

  //set dilutionBound
  storage.set<i32>('dilutionBound', _dilutionBound)

  //set voteThreshold
  storage.set<i32>('voteThreshold', _voteThreshold)

  //set summoning Time
  storage.set<u64>('summoningTime', Context.blockTimestamp)

  //set initial Guild/Escrow/Total address balances
  userTokenBalances.push({user: GUILD, token: depositToken, balance: u128.Zero})
  userTokenBalances.push({user: ESCROW, token: depositToken, balance: u128.Zero})
  userTokenBalances.push({user: TOTAL, token: depositToken, balance: u128.Zero})
  storage.set<i32>('totalGuildBankTokens', 0)
  storage.set<u128>('totalShares', u128.Zero)
  storage.set<u128>('totalLoot', u128.Zero)
  storage.set<u128>('totalMembers', u128.Zero)

  // transfer summoner contribution to the community fund
  let transferred = _sT(_shares, depositToken, _contractId)

  if(transferred) {
    _addToBalance(Context.predecessor, depositToken, _shares)
    _addToBalance(GUILD, depositToken, _shares)
    _addToTotalBalance(depositToken, _shares)

    // *******************
    // ROLES INITIALIZATION
    // *******************
    let defaultPermissions = new Array<string>()
    defaultPermissions.push('read')
    const memberRole = new communityRole('member', u128.Zero, Context.blockTimestamp, 0, defaultPermissions, new Array<string>(), 'default member role', 'nil') // default role given to everyone

    let communitysRoles = new Array<communityRole>()
    communitysRoles.push(memberRole)
    roles.set(Context.contractName, communitysRoles) // start building the available community roles


    // assign default member role
    let availableRoles = roles.getSome(Context.contractName)
    let thisMemberRoles = new Array<communityRole>()
    thisMemberRoles.push(availableRoles[0])
    memberRoles.set(Context.predecessor, thisMemberRoles)

    // makes member object for summoner and puts it into the members storage
    members.set(Context.predecessor, 
      new Member(
        Context.predecessor, 
        _shares, 
        u128.Zero, 
        u128.Zero, 
        u128.Zero, 
        true, 
        0, 
        0, 
        Context.blockTimestamp, 
        Context.blockTimestamp, 
        true,
        thisMemberRoles,
        new Array<reputationFactor>()
        ))

    let currentMembers = storage.getSome<u128>('totalMembers')
    storage.set('totalMembers', u128.add(currentMembers, u128.from(1)))

    memberAddressByDelegatekey.set(Context.predecessor, Context.predecessor)

    storage.set<u128>('totalShares', _shares)

    //set init to done
    storage.set<string>("init", "done")
  }

  return Context.blockTimestamp
}


/**
 * setInit function that is callable by the summoner if they are the only member in the community to make configuration changes
 * @param periodDuration
 * @param votingPeriodLength
 * @param gracePeriodLength
 * @param proposalDeposit
 * @param dilutionBound
 * @param voteThreshold
 */
export function setInit(
  _periodDuration: PeriodDuration,
  _votingPeriodLength: VotingPeriodLength,
  _gracePeriodLength: GracePeriodLength,
  _proposalDeposit: ProposalDeposit,
  _dilutionBound: DilutionBound,
  _voteThreshold: VoteThreshold
): u64 {
assert(isOwner(Context.predecessor), 'not the owner')
assert(_periodDuration > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
assert(_votingPeriodLength > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
assert(_votingPeriodLength <= MAX_VOTING_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH)
assert(_gracePeriodLength <= MAX_GRACE_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH)
assert(_dilutionBound > 0, ERR_DILUTIONBOUND_ZERO)
assert(_dilutionBound <= MAX_DILUTION_BOUND, ERR_DILUTIONBOUND_LIMIT)
assert(_voteThreshold <= 100, 'must be between 1 and 100')
assert(_voteThreshold > 0, 'must be between 0 and 100')

//set periodDuration
storage.set<i32>('periodDuration', _periodDuration)

//set votingPeriodLength
storage.set<i32>('votingPeriodLength', _votingPeriodLength)

//set gracePeriodLength
storage.set<i32>('gracePeriodLength', _gracePeriodLength)

//set proposalDeposit
storage.set<u128>('proposalDeposit', _proposalDeposit)

//set dilutionBound
storage.set<i32>('dilutionBound', _dilutionBound)

//set voteThreshold
storage.set<i32>('voteThreshold', _voteThreshold)

//set dao update time
storage.set<u64>('updated', Context.blockTimestamp)

return Context.blockTimestamp
}


/**
 * _setInit function that is used to make configuration changes after a configuration proposal passes
 * @param periodDuration
 * @param votingPeriodLength
 * @param gracePeriodLength
 * @param proposalDeposit
 * @param dilutionBound
 * @param voteThreshold
 */
function _setInit(
  _periodDuration: PeriodDuration,
  _votingPeriodLength: VotingPeriodLength,
  _gracePeriodLength: GracePeriodLength,
  _proposalDeposit: ProposalDeposit,
  _dilutionBound: DilutionBound,
  _voteThreshold: VoteThreshold
): u64 {
assert(_periodDuration > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
assert(_votingPeriodLength > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
assert(_votingPeriodLength <= MAX_VOTING_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH)
assert(_gracePeriodLength <= MAX_GRACE_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH)
assert(_dilutionBound > 0, ERR_DILUTIONBOUND_ZERO)
assert(_dilutionBound <= MAX_DILUTION_BOUND, ERR_DILUTIONBOUND_LIMIT)
assert(_voteThreshold <= 100, 'must be between 1 and 100')
assert(_voteThreshold > 0, 'must be between 0 and 100')

//set periodDuration
storage.set<i32>('periodDuration', _periodDuration)

//set votingPeriodLength
storage.set<i32>('votingPeriodLength', _votingPeriodLength)

//set gracePeriodLength
storage.set<i32>('gracePeriodLength', _gracePeriodLength)

//set proposalDeposit
storage.set<u128>('proposalDeposit', _proposalDeposit)

//set dilutionBound
storage.set<i32>('dilutionBound', _dilutionBound)

//set voteThreshold
storage.set<i32>('voteThreshold', _voteThreshold)

//set dao update time
storage.set<u64>('updated', Context.blockTimestamp)

return Context.blockTimestamp
}


/*********************/ 
/* UTILITY FUNCTIONS */
/*********************/

/**
 * Internal function that adds tokens to a user's holdings and increments the total tokens held in the community for that type
 * @param account
 * @param token
 * @param amount (in NEAR not yocto)
*/
function _addToBalance(account: AccountId, token: AccountId, amount: u128): void {
  if(_userTokenBalanceExists(account, token)){
    let index = getUserTokenBalanceIndex(account, token)
    let record = userTokenBalances[index]
    record.balance = u128.add(record.balance, amount)
    userTokenBalances[index] = record
  } else {
    userTokenBalances.push({user: account, token: token, balance: amount})
  }
}


/**
 * Internal function that increments the total tokens held in the community for that type
 * @param account
 * @param token
 * @param amount (in NEAR not yocto)
*/
function _addToTotalBalance(token: AccountId, amount: u128): void {
  let totalIndex = getUserTokenBalanceIndex(TOTAL, token)
  let totalRecord = userTokenBalances[totalIndex]
  totalRecord.balance = u128.add(totalRecord.balance, amount)
  userTokenBalances[totalIndex] = totalRecord
}


/**
 * Internal private function to ensure there is an existing token balance for a user
 * @param user
 * @param token
*/
function _userTokenBalanceExists(user: AccountId, token: AccountId): bool {
  let userTokenBalancesLength = userTokenBalances.length
  let i = 0
    while (i < userTokenBalancesLength) {
      if (userTokenBalances[i].user == user && userTokenBalances[i].token == token) {
        return true
      }
      i++
  }
  return false
}


/**
 * Internal function that subtracts tokens from a user's holdings and decrements the total tokens held in the community for that type
 * @param account
 * @param token
 * @param amount (in NEAR not yocto)
*/
function _subtractFromBalance(account: AccountId, token: AccountId, amount: u128): void {
  if(_userTokenBalanceExists(account, token)){
    let index = getUserTokenBalanceIndex(account, token)
    let record = userTokenBalances[index]
    record.balance = u128.sub(record.balance, amount)
    userTokenBalances[index] = record
  }
}

/**
 * Internal function that decrements the total tokens held in the community for that type
 * @param account
 * @param token
 * @param amount (in NEAR not yocto)
*/
function _subtractFromTotalBalance(token: AccountId, amount: u128): void {
  let totalIndex = getUserTokenBalanceIndex(TOTAL, token)
  let totalRecord = userTokenBalances[totalIndex]
  totalRecord.balance = u128.sub(totalRecord.balance, amount)
  userTokenBalances[totalIndex] = totalRecord
}


/**
 * Internal function that transfers tokens from one account to another
 * @param from
 * @param to
 * @param token
 * @param amount (in NEAR not yocto)
*/
function _internalTransfer(from: AccountId, to: AccountId, token: AccountId, amount: u128): void {
  assert(env.isValidAccountID(from), ERR_INVALID_ACCOUNT_ID)
  _subtractFromBalance(from, token, amount)
  _addToBalance(to, token, amount)
}


/**
 * Internal function that calculates the member's current share of the community fund (% of the fund based on the number of shares held)
 * @param balance
 * @param shares
 * @param totalShares
*/
function _fairShare(balance: u128, shares: u128, totalShares: u128): u128 {
  assert(u128.gt(totalShares, u128.Zero), ERR_GREATER_ZERO_TOTALSHARES)
  if(u128.eq(balance, u128.Zero)) { return u128.Zero }
  let prod = u128.mul(balance, shares)
  if(u128.eq(u128.div(prod, balance), shares)) { return u128.div(prod, totalShares) }
  return u128.mul(u128.div(balance, totalShares), shares)
}


/**
 * Internal function that determines whether the proposal has gone through the voting period and is now ready for processing
 * @param proposal
 * flags: [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration]
*/
function _votingPeriodPassed(proposal: Proposal): bool {
  
  // check that we've finished the voting/grace periods so it's ready for processing
  let firstAdd = proposal.sP + storage.getSome<i32>('votingPeriodLength') 
  assert(getCurrentPeriod() >= (firstAdd + storage.getSome<i32>('gracePeriodLength')), ERR_NOT_READY)
  
  // check to confirm it hasn't already been processed
  assert(proposal.f[1] == false, ERR_PROPOSAL_PROCESSED)
 
  return true
}


/**
 * Internal function that determines whether the proposal has passed or not
 * @param proposal
*/
function _didPass(proposal: Proposal): bool {

  // Threshold voting rule (threshold% of total vote)
  let voteThreshold = u128.from(storage.getSome<i32>('voteThreshold'))
  let totalShares = storage.getSome<u128>('totalShares')
  let totalLoot = storage.getSome<u128>('totalLoot')
  
  let totalVotes = u128.add(proposal.yV, proposal.nV)
  let achieved = u128.muldiv(totalVotes, u128.from('100'), totalShares)
  let didPass = proposal.yV > proposal.nV && u128.ge(achieved, voteThreshold)

  // check to see if we can speed up a failure vote by seeing if there is any chance number of outstanding votes exceeds no votes already cast
  let requiredVotes = getNeededVotes()
  if(u128.lt(u128.sub(totalShares, proposal.nV), requiredVotes)){
    didPass = false
  }

  // Make the proposal fail if the dilutionBound is exceeded 
  if(u128.lt(u128.mul(u128.add(totalShares, totalLoot), u128.from(storage.getSome<i32>('dilutionBound'))), u128.from(proposal.mT))) {
    didPass = false
  }
 
  // Make the proposal fail if the applicant is jailed
  // - for standard proposals, we don't want the applicant to get any shares/loot/payment
  // - for guild kick proposals, we should never be able to propose to kick a jailed member (or have two kick proposals active), so it doesn't matter
  if(members.contains(proposal.a)) {
    if(members.getSome(proposal.a).jailed != 0) {
      didPass = false
    }
  }

  //Make the proposal fail if the new total number of shares and loot exceeds the limit
  let firstAdd = u128.add(totalShares, totalLoot)
  let secondAdd = u128.add(proposal.sR, proposal.lR)
  if(u128.gt(u128.add(firstAdd, secondAdd), u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT))) {
    didPass = false
  }

  //Make the proposal fail if it is requesting more tokens as payment than the available fund balance
  if(u128.gt(proposal.pR, u128.from(getUserTokenBalance(GUILD, proposal.pT)))) {
    didPass = false
  }
  
  //Make the proposal fail if it would result in too many tokens with non-zero balance in guild bank
  let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
  if(u128.gt(proposal.tO, u128.Zero) && u128.eq(getUserTokenBalance(GUILD, proposal.tT), u128.Zero) && totalGuildBankTokens >= MAX_TOKEN_GUILDBANK_COUNT) {
    didPass = false
  }
  
  return didPass
}


/**
 * Internal function that is called to return the associated proposal deposit when actions are completed
 * @param to
*/
function _returnDeposit(to: AccountId): bool {
  assert(env.isValidAccountID(to), ERR_INVALID_ACCOUNT_ID)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  let transferred = _sT(proposalDeposit, depositToken, to)
  if(transferred) {
    return true
  } else {
    return false
  }
}


/**
 * Function that inititates call to internal function to ragequit
 * @param sharesToBurn
 * @param lootToBurn
*/
export function ragequit(sharesToBurn: u128, lootToBurn: u128): bool {
  assert(onlyMember(Context.predecessor), ERR_NOT_A_MEMBER)
  _ragequit(Context.predecessor, sharesToBurn, lootToBurn)
  return true
}


/**
 * internal ragequit function that allows a member to burn their shares/loot when they 
 * have major disagreements with direction community is going.  They are still members
 * but voting share and contribution to community fund decreases as they burn/withdraw
 * @param memberAddress
 * @param sharesToBurn
 * @param lootToBurn
*/
function _ragequit(memberAddress: AccountId, sharesToBurn: u128, lootToBurn: u128): void {

  let totalShares = storage.getSome<u128>('totalShares')
  let totalLoot = storage.getSome<u128>('totalLoot')
 
  let initialTotalSharesAndLoot = u128.add(totalShares, totalLoot)

  let member = members.getSome(memberAddress)

  assert(u128.ge(member.shares, sharesToBurn), ERR_INSUFFICIENT_SHARES)
  assert(u128.ge(member.loot, lootToBurn), ERR_INSUFFICIENT_LOOT)
  assert(canRageQuit(member.highestIndexYesVote), ERR_CANNOT_RAGEQUIT)

  let sharesAndLootToBurn = u128.add(sharesToBurn, lootToBurn)

  // burn shares and loot
  member.shares = u128.sub(member.shares, sharesToBurn)
  member.loot = u128.sub(member.loot, lootToBurn)

  members.set(memberAddress, member)

  // decrease contract balances of shares and loot (non-voting shares)
  totalShares = u128.sub(totalShares, sharesToBurn)
  storage.set('totalShares', totalShares)

  totalLoot = u128.sub(totalLoot, lootToBurn)
  storage.set('totalLoot', totalLoot)

  // determine appropriate portion of fund to return and adjust balances
  let approvedTokensLength = approvedTokens.length
  let i: i32 = 0
  while (i < approvedTokensLength) {
    let amountToRagequit = _fairShare(getUserTokenBalance(GUILD, approvedTokens[i]), sharesAndLootToBurn, initialTotalSharesAndLoot)
    if (u128.gt(amountToRagequit, u128.Zero)) {

      // transfer to user
      let transferred = _sT(amountToRagequit, approvedTokens[i], memberAddress)

      if(transferred) {
        _subtractFromBalance(memberAddress, approvedTokens[i], amountToRagequit)
        _subtractFromBalance(GUILD, approvedTokens[i], amountToRagequit)
        _subtractFromTotalBalance(approvedTokens[i], amountToRagequit)
      }

    }
  }
}


/**
 * Internal function to verify that a member can ragequit - last proposal they voted yes on must have been processed
 * otherwise they could potentially be taking away funds that were supposed to go to someone based on a community decision
 * @param highestIndexYesVote
*/
function canRageQuit(highestIndexYesVote: i32): bool {
  assert(highestIndexYesVote < proposals.length, ERR_PROPOSAL_NO)
  return proposals[highestIndexYesVote].f[1]
}

/**
 * Withdrawl function to effect withdrawl of a certain amount (<= fairshare) of a certain token to the logged in NEAR account
 * @param token
 * @param amount
 * @param to
*/
export function withdrawBalance(token: AccountId, amount: u128, to: AccountId): void {
  _withdrawBalance(token, amount, to)  
}

/**
 * Internal private function to effect withdrawl of a certain amount of a certain token
 * @param token
 * @param amount
 * @param to
*/
function _withdrawBalance(token: AccountId, amount: u128, to: AccountId): bool {
  assert(env.isValidAccountID(to), ERR_INVALID_ACCOUNT_ID)
  assert(to == Context.predecessor, 'not account that is withdrawing')
  assert(u128.ge(getUserTokenBalance(to, token), amount), ERR_INSUFFICIENT_BALANCE)

  let fairShare = getCurrentShare(to)
  assert(u128.le(amount, fairShare), 'asking to withdraw more than fair share of the fund')

  let transferred = _sT(amount, token, to)

  if(transferred) {
    _subtractFromBalance(to, token, amount)
    _subtractFromTotalBalance(token, amount)
    return true
  }
  return false
}

/**
 * Cancels a proposal before it has been sponsored.  Returns proposal deposit to proposer.
 * @param pI (proposal Id)
 * @param deposit (proposal deposit)
 * @param to
*/
// NOTE: requires that proposer cancels
export function cancelProposal(pI: i32, tribute: u128, loot: u128): Proposal {
  
  let proposal = proposals[pI]
  assert(proposal.p == Context.predecessor, 'not the proposer')
  assert(!proposal.f[0], ERR_ALREADY_SPONSORED)
  assert(!proposal.f[3], ERR_ALREADY_CANCELLED)
 
  // mark proposal as cancelled
  let f = proposal.f 
  f[3] = true; //cancelled
  proposal.f = f
  proposals[pI] = proposal

  // return proposal deposit
  let returned = _returnDeposit(proposal.p)

  if(returned){
    // return any shares/loot
    let totalSharesLoot = u128.add(tribute, loot)
    let secondTransfer = _sT(totalSharesLoot, proposal.tT, proposal.p)

    if(secondTransfer) {
    _subtractFromBalance(proposal.p, proposal.tT, totalSharesLoot)
    _subtractFromBalance(ESCROW, proposal.tT, totalSharesLoot)
    _subtractFromTotalBalance(proposal.tT, totalSharesLoot)
    }
    return proposal
  }
  return proposal
}


/**
 * Donation function that allows someone to be benevolent and contribute funds to the community's fund
 * @param contractId
 * @param token
 * @param amount
*/
export function makeDonation(contractId: AccountId, contributor: AccountId, token: AccountId, amount: u128): boolean {
  assert(env.isValidAccountID(contractId), ERR_INVALID_ACCOUNT_ID)
  assert(env.isValidAccountID(contributor), ERR_INVALID_ACCOUNT_ID)
  assert(tokenWhiteList.getSome(token), ERR_NOT_WHITELISTED)
  assert(u128.eq(Context.attachedDeposit, u128.mul(amount, u128.from('1000000000000000000000000'))), 'attached deposit must match donation amount')
  assert(u128.gt(amount, u128.Zero), 'contribution must be greater than zero')
  
  let donationId = contributions.length

  let contribution = new Donation()
  contribution.contributor = contributor
  contribution.donationId = donationId
  contribution.donation = amount
  contribution.contributed = Context.blockTimestamp
  contributions.push(contribution)
  
  let transferred = _sT(amount, token, contractId)

  if(transferred) {
    _addToBalance(GUILD, token, amount)
    _addToTotalBalance(token, amount)

    return true
  } else {
    return false
  }
}


/**
 * Ragekick function that forces a member to withdraw from the community.  After a member has been 
 * jailed as a result of a passing guild kick proposal and once all the proposals they have voted
 * YES on are processed, anyone can call the ragekick function to forcibly redeem the member's loot
 * for their proportional share of the guild's tokens.  Effectively same as calling ragequit themselves.
 * Member object is left intact; however member remains jailed, thus cannot submit proposals, vote, etc.
 * Effectively prevents them from doing anything within the community.
 * @param memberToKick
*/
export function ragekick(memberToKick: AccountId): bool {
 
  let member = members.getSome(memberToKick)

  assert(member.jailed != 0, ERR_IN_JAIL) //member must be in jail
  assert(u128.gt(member.loot, u128.Zero), ERR_HAVE_LOOT) // note - should be impossible for jailed member to have shares
  assert(canRageQuit(member.highestIndexYesVote), ERR_CANNOT_RAGEQUIT) // cannot ragequit until highest index proposal member voted YES on is processed

  _ragequit(memberToKick, u128.Zero, member.loot)
  return true
}


/**
 * Internal private function to determine whether there is an existing member proposal for a given applicant
 * @param applicant
*/
function _memberProposalPresent(applicant: AccountId): bool {
  let proposalsLength = proposals.length
  let i = 0
  while (i < proposalsLength) {
    if (proposals[i].a == applicant && proposals[i].f[6] == true) {
      return true
    }
    i++
  }
  return false
}


/**
 * Internal private function to determine the larger of two integers
 * @param x
 * @param y
*/
function _max(x: i32, y: i32): i32 {
  return x >= y ? x : y
}


/**
 * Internal private function to execute actions of a passed proposal
 * @param proposalIndex
 * @param proposal
*/
function _proposalPassed(proposalIndex: i32, proposal: Proposal): bool {
 
  // mark proposal as passed 
  let f = proposal.f
  f[2] = true //didPass
  proposal.f = f
  proposals[proposalIndex] = proposal

  if(members.contains(proposal.a)) {
    // if the applicant is already a member, add to their existing shares and loot
    let member = members.getSome(proposal.a)
    let newShares = u128.add(member.shares, proposal.sR)
    let newLoot = u128.add(member.loot, proposal.lR)

    members.set(proposal.a, new Member(
      member.delegateKey,
      newShares,
      member.delegatedShares,
      member.receivedDelegations,
      newLoot, 
      true,
      member.highestIndexYesVote,
      member.jailed,
      member.joined,
      Context.blockTimestamp,
      true,
      member.roles,
      member.reputation
      ))

  } else {
    // the applicant is a new member, create a new record for them

    // if the applicant address is already taken by a member's delegateKey, reset it to their member address
    if(memberAddressByDelegatekey.contains(proposal.a)){
      if(members.contains(memberAddressByDelegatekey.getSome(proposal.a))) {
        let memberToOverride = memberAddressByDelegatekey.getSome(proposal.a)
        memberAddressByDelegatekey.set(memberToOverride, memberToOverride)
    
        let member = members.getSome(memberToOverride)
  
        members.set(memberToOverride, new Member(
          memberToOverride,
          member.shares,
          member.delegatedShares,
          member.receivedDelegations,
          member.loot, 
          true,
          member.highestIndexYesVote,
          member.jailed,
          member.joined,
          Context.blockTimestamp,
          true,
          member.roles,
          member.reputation
          ))
      }
    }

    // use applicant address as delegateKey by default
    members.set(proposal.a, new Member(
      proposal.a, 
      proposal.sR, 
      u128.Zero, 
      u128.Zero, 
      proposal.lR, 
      true, 
      0, 
      0, 
      Context.blockTimestamp, 
      Context.blockTimestamp, 
      true,
      new Array<communityRole>(),
      new Array<reputationFactor>()
      ))

    let totalMembers = storage.getSome<u128>('totalMembers')
    totalMembers = u128.add(totalMembers, u128.from(1))
    storage.set('totalMembers', totalMembers)

    memberAddressByDelegatekey.set(proposal.a, proposal.a)
  }

  // mint new shares and loot
  let currentTotalShares = storage.getSome<u128>('totalShares')
  let newTotalShares = u128.add(currentTotalShares, proposal.sR)
  storage.set<u128>('totalShares', newTotalShares)

  let currentTotalLoot = storage.getSome<u128>('totalLoot')
  let newTotalLoot = u128.add(currentTotalLoot, proposal.lR)
  storage.set<u128>('totalLoot', newTotalLoot)

  // if the proposal tribute is the first tokens of its kind to make it into the guild bank, increment total guild bank tokens
  if(u128.eq(getUserTokenBalance(GUILD, proposal.tT), u128.Zero) && u128.gt(proposal.tO, u128.Zero)) {
    let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
    let newTotalGuildBankTokens = totalGuildBankTokens + 1
    storage.set('totalGuildBankTokens', newTotalGuildBankTokens)
  }

  // If commitment, move funds from bank to escrow
  if(proposal.f[7]){
    _internalTransfer(GUILD, ESCROW, proposal.pT, proposal.pR)
  }
  
  //make configuration changes if it's a configuration proposal
  if(proposal.f[10]){      
    _setInit(
      <i32>parseInt(proposal.configuration[0]), //periodDuration
      <i32>parseInt(proposal.configuration[1]), //votingPeriodLength
      <i32>parseInt(proposal.configuration[2]), //gracePeriodLength
      u128.from(parseInt(proposal.configuration[3])), //proposalDeposit
      <i32>parseInt(proposal.configuration[4]),  //dilutionBound
      <i32>parseInt(proposal.configuration[5]) //voteThreshold)
    )
  }

  //make role changes if it's a community role proposal
  if(proposal.f[12]){
    if(proposal.roleConfiguration.action == 'add'){
      assert(!roles.contains(proposal.roleConfiguration.roleName), 'role already exists, cannot add')
    
      let currentCommunityRoles = roles.getSome(Context.contractName)
      currentCommunityRoles.push(proposal.roleConfiguration)
      roles.set(Context.contractName, currentCommunityRoles)
    }
    if(proposal.roleConfiguration.action == 'edit'){
      let currentCommunityRoles = roles.getSome(Context.contractName)
      let i = 0
      while (i < currentCommunityRoles.length){
        if(currentCommunityRoles[i].roleName == proposal.roleConfiguration.roleName){
          currentCommunityRoles[i].roleName = proposal.roleConfiguration.roleName
          currentCommunityRoles[i].roleReward = proposal.roleConfiguration.roleReward
          currentCommunityRoles[i].roleStart = proposal.roleConfiguration.roleStart
          currentCommunityRoles[i].roleEnd = proposal.roleConfiguration.roleEnd
          currentCommunityRoles[i].roleDescription = proposal.roleConfiguration.roleDescription
          currentCommunityRoles[i].rolePermissions = proposal.roleConfiguration.rolePermissions
          currentCommunityRoles[i].roleParticulars = proposal.roleConfiguration.roleParticulars
          currentCommunityRoles[i].action = 'nil'
        }
      i++
      }
    }
    if(proposal.roleConfiguration.action == 'delete'){
      assert(roles.contains(proposal.roleConfiguration.roleName), 'role does not exist, cannot delete')
      let currentCommunityRoles = roles.getSome(Context.contractName)
      let j = 0
      while (j < currentCommunityRoles.length){
        if(currentCommunityRoles[j].roleName == proposal.roleConfiguration.roleName){
          currentCommunityRoles.splice(j)
          roles.set(Context.contractName, currentCommunityRoles)
          break
        }
      j++
      }
    }
  }

   //make reputation factor changes if it's a reputation factor proposal
   if(proposal.f[13]){
    if(proposal.reputationConfiguration.action == 'add'){
      assert(!reputationFactors.contains(proposal.reputationConfiguration.repFactorName), 'reputation factor already exists, cannot add')
    
      let currentCommunityRepFactors = reputationFactors.getSome(Context.contractName)
      currentCommunityRepFactors.push(proposal.reputationConfiguration)
      reputationFactors.set(Context.contractName, currentCommunityRepFactors)
    }
    if(proposal.reputationConfiguration.action == 'edit'){
      let currentCommunityRepFactors = reputationFactors.getSome(Context.contractName)
      let i = 0
      while (i < currentCommunityRepFactors.length){
        if(currentCommunityRepFactors[i].repFactorName == proposal.reputationConfiguration.repFactorName){
          currentCommunityRepFactors[i].repFactorPoints = proposal.reputationConfiguration.repFactorPoints
          currentCommunityRepFactors[i].repFactorStart = proposal.reputationConfiguration.repFactorStart
          currentCommunityRepFactors[i].repFactorEnd = proposal.reputationConfiguration.repFactorEnd
          currentCommunityRepFactors[i].repFactorDescription = proposal.reputationConfiguration.repFactorDescription
          currentCommunityRepFactors[i].repFactorFactors = proposal.reputationConfiguration.repFactorFactors
          currentCommunityRepFactors[i].repFactorActions = proposal.reputationConfiguration.repFactorActions
          currentCommunityRepFactors[i].action = 'nil'
        }
      i++
      }
    }
    if(proposal.reputationConfiguration.action == 'delete'){
      assert(reputationFactors.contains(proposal.reputationConfiguration.repFactorName), 'reputation factor does not exist, cannot delete')
      let currentCommunityRepFactors = reputationFactors.getSome(Context.contractName)
      let j = 0
      while (j < currentCommunityRepFactors.length){
        if(currentCommunityRepFactors[j].repFactorName == proposal.reputationConfiguration.repFactorName){
          currentCommunityRepFactors.splice(j)
          reputationFactors.set(Context.contractName, currentCommunityRepFactors)
          break
        }
      j++
      }
    }
  }

   //assign, delete, modify member roles
   if(proposal.f[14]){

    if(proposal.memberRoleConfiguration.action == 'assign'){
      assert(roles.contains(proposal.memberRoleConfiguration.roleName), 'role does not exist, cannot add')
    
      let currentMemberRoles = memberRoles.getSome(proposal.a)

       // check to see if member already has the role and modify it if needed    
      let i = 0
      let exists = false
      while (i < currentMemberRoles.length){
        if(currentMemberRoles[i].roleName == proposal.memberRoleConfiguration.roleName){
          currentMemberRoles[i].roleReward = proposal.memberRoleConfiguration.roleReward
          currentMemberRoles[i].roleStart = proposal.memberRoleConfiguration.roleStart
          currentMemberRoles[i].roleEnd = proposal.memberRoleConfiguration.roleEnd
          currentMemberRoles[i].roleDescription = proposal.memberRoleConfiguration.roleDescription
          currentMemberRoles[i].rolePermissions = proposal.memberRoleConfiguration.rolePermissions
          currentMemberRoles[i].roleParticulars = proposal.memberRoleConfiguration.roleParticulars
          currentMemberRoles[i].action = 'nil'
          exists = true
          break
        }
      i++
      }
      // add it if it does not currently exist
      if(!exists){
        currentMemberRoles.push(proposal.memberRoleConfiguration)
      }
    }

    if(proposal.memberRoleConfiguration.action == 'delete'){
      let currentMemberRoles = memberRoles.getSome(proposal.a)
      let j = 0
      while (j < currentMemberRoles.length){
        if(currentMemberRoles[j].roleName == proposal.memberRoleConfiguration.roleName){
          currentMemberRoles.splice(j)
          memberRoles.set(proposal.a, currentMemberRoles)
          break
        }
      j++
      }
    }
  }

  //give applicant the funds requested from escrow if not a commitment   
  if(!proposal.f[7]){ 
    if(u128.gt(proposal.pR, u128.Zero)){
      let transferred = _sT(proposal.pR, proposal.pT, proposal.a)

      if(transferred) {
        _subtractFromBalance(ESCROW, proposal.pT, proposal.pR)
        _subtractFromTotalBalance(proposal.pT, proposal.pR)
      }
    }
  }

  //move tribute from escrow to bank
  _internalTransfer(ESCROW, GUILD, proposal.tT, proposal.tO)

  // if the proposal spends 100% of guild bank balance for a token, decrement total guild bank tokens
  if(u128.eq(getUserTokenBalance(GUILD, proposal.pT), u128.Zero) && u128.gt(proposal.pR, u128.Zero)) {
    let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
    let newTotalGuildBankTokens = totalGuildBankTokens - 1
    storage.set('totalGuildBankTokens', newTotalGuildBankTokens)
  }

  return true
}


/**
 * Internal private function to determine if a proposal failed
 * @param proposal
*/
function _proposalFailed(proposal: Proposal): bool {
  //return all tokens to the proposer if not a commitment (not the applicant, because funds come from the proposer)
  if(!proposal.f[7]){
    let totalSharesAndLoot = u128.add(proposal.sR, proposal.lR)
    
    // transfer user's contribution back to them
    let withdrawn = _sT(totalSharesAndLoot, proposal.tT, proposal.p)

    if(withdrawn) {
      _subtractFromBalance(proposal.p, proposal.tT, totalSharesAndLoot)
      _subtractFromBalance(ESCROW, proposal.tT, totalSharesAndLoot)
      _subtractFromTotalBalance(proposal.tT, totalSharesAndLoot)
    
    return true
    }
  }
  return false
}


/**
 * Internal private function to transfer a NEAR amount to an account
 * @param amount (in yocto)
 * @param account
*/
function _nearTransfer(amount: u128, account: AccountId): bool {
  let promise = ContractPromiseBatch.create(account)
  .transfer(amount)
  return true
}


/**
 * Internal private function to transfer token amounts to an account
 * @param tO (amount being transferred in NEAR)
 * @param tT (type of token)
 * @param account (where it's being transferred to)
*/
function _sT(tO: u128, tT: AccountId, account: AccountId): bool {
  assert(env.isValidAccountID(account), ERR_INVALID_ACCOUNT_ID)
  let amountConvert = u128.mul(tO, u128.from('1000000000000000000000000'))

  // NEAR transfers
  if(tT == storage.getSome<string>('depositToken')) {
      let transferred = _nearTransfer(amountConvert, account)
      return transferred
  }
  // TODO: other token transfers
  //  else {
  //   // other token transfers
  //  
  //   return true
  // }
  return false
}

/**
 * Internal private function to transfer token amounts to an account
 * @param tO (amount being transferred in yocto)
 * @param tT (type of token)
 * @param account (where it's being transferred to)
*/
function _sTRaw(tO: u128, tT: AccountId, account: AccountId): bool {
  assert(env.isValidAccountID(account), ERR_INVALID_ACCOUNT_ID)

  // NEAR transfers
  if(tT == storage.getSome<string>('depositToken')) {
      let transferred = _nearTransfer(tO, account)
      return transferred
  }
  // TODO: other token transfers
  //  else {
  //   // other token transfers
  //  
  //   return true
  // }
  return false
}


/********************************/ 
/* GETTER FUNCTIONS             */
/********************************/

/**
 * returns community DAO init status
*/
export function getInit(): string | null {
  return storage.get<string>("init", "none")
}


/**
 * Returns current community configuration settings
*/
export function getInitSettings(): Array<Array<string>> {
  let settings = new Array<Array<string>>()
  //get Summoner
  let summoner = storage.getSome<string>("summoner")

  //get periodDuration
  let periodDuration = storage.getSome<i32>('periodDuration')

  //set votingPeriodLength
  let votingPeriodLength = storage.getSome<i32>('votingPeriodLength')

  //set gracePeriodLength
  let gracePeriodLength = storage.getSome<i32>('gracePeriodLength')

  //set proposalDeposit
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')

  //set dilutionBound
  let dilutionBound = storage.getSome<i32>('dilutionBound')

  //set vote threshold
  let voteThreshold = storage.getSome<i32>('voteThreshold')

  //set summoning Time
  let summoningTime = storage.getSome<u64>('summoningTime')
 
  settings.push([
    summoner, 
    periodDuration.toString(), 
    votingPeriodLength.toString(),
    gracePeriodLength.toString(),
    proposalDeposit.toString(),
    dilutionBound.toString(),
    voteThreshold.toString(),
    summoningTime.toString()
  ])

  return settings
}


/**
 * returns current community DAO owner (summoner)
*/
export function getSummoner(): string {
  return storage.getSome<string>("summoner")
}


/**
 * returns when the community DAO was summoned (setup)
*/
export function getSummonTime(): u64 {
  return storage.getSome<u64>("summoningTime")
}


/** returns current neededVotes for a proposal to pass
 * 
*/
export function getNeededVotes(): u128 {
  let voteThreshold = u128.from(storage.getSome<i32>('voteThreshold'))
  let totalShares = storage.getSome<u128>('totalShares')
  let neededVotes = u128.mul(totalShares, u128.div(voteThreshold, u128.from('100')))
  return neededVotes
}


/**
 * returns deposit token type
 */
export function getDepositToken(): string {
  return storage.getSome<string>("depositToken")
}


/**
 * returns current proposal deposit (in yocto)
*/
export function getProposalDeposit(): u128 {
  return storage.getSome<u128>("proposalDeposit")
}


/**
 * returns current period duration setting (defines how long - in blocks so ~1sec - 
 * the community bases its periods/time on)
*/
export function getPeriodDuration(): i32 {
  return storage.getSome<i32>("periodDuration")
}


/**
 * returns whether account called is currently a member of the community DAO
*/
export function getMemberStatus(member: AccountId): bool {
  if(members.get(member)){
    return true
  }
  return false
}


/**
 * returns number of shares (voting), the member has
*/
export function getMemberShares(member: AccountId): u128 {
  if(members.get(member) != null) {
    let shares = members.getSome(member).shares
    return shares
  }
  return u128.Zero
}


/**
 * returns the amount of loot (non-voting shares) a member has
*/
export function getMemberLoot(member: AccountId): u128 {
  if(members.get(member) != null) {
    let loot = members.getSome(member).loot
    return loot
  }
  return u128.Zero
}


/**
 * returns all the information stored on chain about a community DAO member
 * see the member data model for what that is
*/
export function getMemberInfo(member: AccountId): Array<Member> {
  let thisMember = new Array<Member>()
  if(members.contains(member)){
   let aMember = members.getSome(member)
   thisMember.push(aMember)
  }
  return thisMember
}


/**
 * returns current number of members in the community DAO
*/
export function getTotalMembers(): u128 {
  return storage.getSome<u128>('totalMembers')
}


/**
 * returns current period which is used in timing activities in the community DAO
*/
export function getCurrentPeriod(): i32 {
  let summonTime = storage.getSome<u64>('summoningTime') // blocktimestamp that dao was summoned
  let pd:u64 = <u64>storage.getSome<i32>('periodDuration') * 1000000000 // duration converted to nanoseconds for each period
  if(pd != 0) {
    let interim = Context.blockTimestamp - summonTime
    let result = interim / pd
    return <i32>result
  }
  return 0
}


/**
 * returns current set of proposal flags for given proposal
*/
export function getProposalFlags(pI: i32): bool[] {
  return proposals[pI].f
}


/**
 * returns user token balance for a given user and token type
*/
export function getUserTokenBalance(user: AccountId, token: AccountId): u128 {
  let userTokenBalanceLength = userTokenBalances.length
  let i : i32 = 0
  while (i < userTokenBalanceLength ) {
    if(userTokenBalances[i].user == user && userTokenBalances[i].token == token) {
      return userTokenBalances[i].balance
    }
    i++
  }
  return u128.Zero
}


/**
 * returns all balances for all tokens in the guild (community fund)
*/
export function getGuildTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  let approvedTokensLength = approvedTokens.length
  let i = 0
  while (i < approvedTokensLength) {
    let balance = getUserTokenBalance(GUILD, approvedTokens[i])
    balances.push({token: approvedTokens[i], balance: balance})
    i++
  }
  return balances
}


/**
 * returns all balances for all tokens in the escrow fund
*/
export function getEscrowTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  let approvedTokensLength = approvedTokens.length
  let i = 0
  while (i < approvedTokensLength) {
    let balance = getUserTokenBalance(ESCROW, approvedTokens[i])
    balances.push({token: approvedTokens[i], balance: balance})
    i++
  }
  return balances
}


/**
 * returns vote for a given memberaddress and proposal id - answers how someone voted on a certain proposal
*/
export function getMemberProposalVote(memberAddress: AccountId, pI: i32): string {
  let votesByMemberLength = votesByMember.length
  let i = 0
  while( i < votesByMemberLength ){
    if(votesByMember[i].user == memberAddress && votesByMember[i].pI == pI){
      if(votesByMember[i].vote != ''){
        return votesByMember[i].vote
      }
    }
    i++
  }
  return 'no vote yet'
}


/**
 * returns current fair share of the community fund for a member based on their holdings of shares/loot
*/
export function getCurrentShare(member: AccountId): u128 {
  let thisMember = members.getSome(member)
  let totalShares = storage.getSome<u128>('totalShares')
  let totalLoot = storage.getSome<u128>('totalLoot')
  let depositToken = storage.getSome<string>('depositToken')
  let totalSharesAndLoot = u128.add(totalShares, totalLoot)
  let fairShare = _fairShare(getUserTokenBalance(GUILD, depositToken), u128.add(thisMember.shares, thisMember.loot), totalSharesAndLoot)
  return fairShare
}


/**
 * returns all votes for a given proposal
*/
export function getProposalVotes(pI: i32): Array<Votes> {
  let yV = proposals[pI].yV
  let nV = proposals[pI].nV
  let voteArray = new Array<Votes>()
  voteArray.push({yes: yV, no: nV})
  return voteArray
}


/**
 * returns current number of approved tokens in use
*/
export function getTokenCount(): i32 {
  return approvedTokens.length
}


/**
 * returns total shares
*/
export function getTotalShares(): u128 {
  let totalShares = storage.getSome<u128>('totalShares')
  return totalShares
}


/**
 * returns total loot
*/
export function getTotalLoot(): u128 {
  let totalLoot = storage.getSome<u128>('totalLoot')
  return totalLoot
}


/**
 * returns the proposal index of a proposal - typically used to find it in the proposal vector
 * -1 indicates it is not found
*/
export function getProposalIndex(pI: i32): i32 {
  let proposalsLength = proposals.length
  let i = 0
    while (i < proposalsLength) {
      if (proposals[i].pI == pI) {
        return i
      }
      i++
    }
  return -1
}


/**
 * returns the index for a given donation id
*/
export function getDonationIndex(donationId: i32): i32 {
  let contributionsLength = contributions.length
  let i = 0
    while (i < contributionsLength) {
      if (contributions[i].donationId == donationId) {
        return i
      }
      i++
    }
  return -1
}


/**
 * returns index of a user's token balance 
 * -1 indicates not present
*/
export function getUserTokenBalanceIndex(user: AccountId, token: AccountId): i32 {
  let userTokenBalancesLength = userTokenBalances.length
  let i = 0
  if (userTokenBalancesLength != 0) {
    while (i < userTokenBalancesLength) {
      if (userTokenBalances[i].user == user && userTokenBalances[i].token == token) {
        return i
      }
      i++
    }
  }
  return -1
}


/**
 * returns current number of proposals 
*/
export function getProposalsLength(): i32 {
  return proposals.length
}


/**
 * returns current number of donations
*/
export function getDonationsLength(): i32 {
  return contributions.length
}


/**
 * returns the desired proposal
*/
export function getProposal(proposalId: i32): Proposal {
  let proposalIndex = getProposalIndex(proposalId)
  return proposals[proposalIndex]
}


/**
 * returns the desired donation
*/
export function getDonation(donationId: i32): Donation {
  let donationIndex = getDonationIndex(donationId)
  return contributions[donationIndex]
}


/**
 * returns index for a members delegation information
*/
export function getDelegationInfoIndex(member: AccountId, delegatee: AccountId): i32 {
  let allDelegations = delegation.getSome(member)
  let delegationsLength = allDelegations.length
  let i = 0
  while (i < delegationsLength){
    if (allDelegations[i].delegatedTo == delegatee){
      return i
    }
    i++
  }
  return -1
}


/**
 * returns delegation information for a given member
*/
export function getDelegationInfo(member: AccountId, delegatee: AccountId): Array<Array<string>> {
  let delegationIndex = getDelegationInfoIndex(member, delegatee)
  let delegationInfo = new Array<Array<string>>()
  let memberDelegationInfo = delegation.getSome(member)
  delegationInfo.push([memberDelegationInfo[delegationIndex].delegatedTo, memberDelegationInfo[delegationIndex].shares.toString()])
  return delegationInfo
}



/*****************
PROPOSAL FUNCTIONS
*****************/

/**
 * Submit a Member proposal - used to join a community DAO and be issued voting or non-voting shares
 * @param a // applicant
 * @param sR // sharesRequested (voting shares)
 * @param lR // lootRequested (non-voting shares)
 * @param tO // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tT // tributeToken (type of token)
 * @param pR // paymentRequested (amount of payment requested) - in yocto if NEAR
 * @param pT // paymentToken (desired token for payment)
 * @param roleNames // rolenames of roles to add to member
 * @param contractId
*/
export function submitMemberProposal (
    a: AccountId,
    sR: u128,
    lR: u128,
    tO: u128,
    tT: AccountId,
    roleNames: Array<string>, 
    contractId: AccountId
): bool {
  assert(u128.le(u128.add(sR, lR), u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT)), ERR_TOO_MANY_SHARES)
  assert(tokenWhiteList.getSome(tT), ERR_NOT_WHITELISTED)
  assert(env.isValidAccountID(a), ERR_INVALID_ACCOUNT_ID)
  assert(a != GUILD && a != ESCROW && a != TOTAL, ERR_RESERVED)
  assert(members.get(a) == null, 'already a member')
  assert(_memberProposalPresent(a) == false, 'member proposal already in progress')

  if(members.contains(a)) {
    assert(members.getSome(a).jailed == 0, ERR_JAILED)
  }
  
  if(u128.gt(tO, u128.Zero) && u128.eq(getUserTokenBalance(GUILD, tT), u128.Zero)) {
    let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
    assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, ERR_FULL_GUILD_BANK)
  }

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let contribution = u128.add(tO, lR)
  let totalAmount = u128.add(proposalDeposit, contribution)
  assert(u128.eq(Context.attachedDeposit, u128.mul(u128.add(contribution, proposalDeposit), u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(totalAmount, tT, contractId)

  if(transferred) {
    _addToBalance(Context.predecessor, tT, contribution)
    _addToBalance(ESCROW, tT, contribution)
    _addToTotalBalance(tT, contribution)

    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[6] = true // member proposal

    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)
  
    _submitProposal(
      a, 
      sR, 
      lR, 
      tO, 
      tT, 
      u128.Zero, 
      '', 
      f, 
      roleNames, 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
 
    return true
  }
return false
}



/**
 * Submit a Payout proposal - used to request payment for completed work as per an already approved funding commitment
 * @param a // applicant
 * @param sR // sharesRequested (voting shares)
 * @param lR // lootRequested (non-voting shares)
 * @param tO // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tT // tributeToken (type of token)
 * @param pR // paymentRequested (amount of payment requested) - in yocto if NEAR
 * @param pT // paymentToken (desired token for payment)
 * @param referenceIds // reference Ids
 * @param contractId
*/
export function submitPayoutProposal (
  a: AccountId,
  pR: u128,
  pT: AccountId,
  referenceIds: Array<GenericObject>,
  contractId: AccountId
): bool {
assert(tokenWhiteList.getSome(pT), ERR_NOT_WHITELISTED_PT)
assert(env.isValidAccountID(a), ERR_INVALID_ACCOUNT_ID)
assert(a != GUILD && a != ESCROW && a != TOTAL, ERR_RESERVED)

if(members.contains(a)) {
  assert(members.getSome(a).jailed == 0, ERR_JAILED)
}

// Funds transfers
let proposalDeposit = storage.getSome<u128>('proposalDeposit')
let depositToken = storage.getSome<string>('depositToken')
assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

let transferred = _sT(proposalDeposit, depositToken, contractId)

if(transferred) {
  let f = new Array<bool>(15) 
  f[11] = true // payout proposal

  _submitProposal(
    a, 
    u128.Zero, 
    u128.Zero, 
    u128.Zero, 
    '', 
    pR, 
    pT, 
    f, 
    new Array<string>(), 
    new Array<string>(), 
    new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
    new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
    new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
    referenceIds
    )

  return true
}
return false
}


/**
 * Submit a tribute proposal - used to increase voting shares by contributing more to the community fund
 * @param a // applicant
 * @param sR // sharesRequested (voting shares)
 * @param tO // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tT // tributeToken (type of token)
 * @param pR // paymentRequested (amount of payment requested) - in yocto if NEAR
 * @param pT // paymentToken (desired token for payment)
 * @param contractId
*/
export function submitTributeProposal (
  a: AccountId,
  sR: u128,
  tO: u128,
  tT: AccountId,
  contractId: AccountId
): bool {
assert(u128.le(sR, u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT)), ERR_TOO_MANY_SHARES)
assert(tokenWhiteList.getSome(tT), ERR_NOT_WHITELISTED)
assert(env.isValidAccountID(a), ERR_INVALID_ACCOUNT_ID)
assert(a != GUILD && a != ESCROW && a != TOTAL, ERR_RESERVED)

if(members.contains(a)) {
  assert(members.getSome(a).jailed == 0, ERR_JAILED)
}

if(u128.gt(tO, u128.Zero) && u128.eq(getUserTokenBalance(GUILD, tT), u128.Zero)) {
  let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
  assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, ERR_FULL_GUILD_BANK)
}

// Funds transfers
let proposalDeposit = storage.getSome<u128>('proposalDeposit')
let totalContribution = u128.add(proposalDeposit, tO)
assert(u128.eq(Context.attachedDeposit, u128.mul(totalContribution, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

let transferred = _sT(totalContribution, tT, contractId)

if(transferred) {
  _addToBalance(a, tT, tO)
  _addToBalance(ESCROW, tT, tO)
  _addToTotalBalance(tT, tO)

  let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
  f[9] = true // tribute proposal

  let references = new Array<GenericObject>()
  let defaultObject = new GenericObject('','')
  references.push(defaultObject)

  _submitProposal(
    a, 
    sR, 
    u128.Zero, 
    tO, 
    tT, 
    u128.Zero, 
    '', 
    f, 
    new Array<string>(), 
    new Array<string>(), 
    new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
    new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
    new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
    references    
    )

  return true
}
return false
}


/**
 * Submit a Funding Commitment proposal - used to promise funding for a given idea or project
 * @param applicant
 * @param paymentRequested in yocto if NEAR
 * @param paymentToken
 * @param contractId
*/
export function submitCommitmentProposal(
  applicant: AccountId, 
  paymentRequested: u128, 
  paymentToken: AccountId,
  referenceIds: Array<GenericObject>,
  contractId: AccountId
  ): bool {
  assert(tokenWhiteList.getSome(paymentToken), ERR_NOT_WHITELISTED_PT)
  assert(env.isValidAccountID(applicant), ERR_INVALID_ACCOUNT_ID)
  assert(applicant != GUILD && applicant != ESCROW && applicant != TOTAL, ERR_RESERVED)
  assert(u128.gt(paymentRequested, u128.Zero), 'funding request must be greater than zero')
  
  if(members.contains(applicant)) {
    assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
  }

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred) {
    let f = new Array<bool>(15) // [submitted, sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[7] = true // commitment

    _submitProposal(
      applicant, 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      paymentRequested, 
      paymentToken, 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      referenceIds
      )
    return true
  }
  return false
}


/**
 * Submit a Configuration proposal - used to change the foundational parameters of the community DAO
 * @param applicant
 * @param configuration
 * @param contractId
*/
export function submitConfigurationProposal(
  applicant: AccountId,
  configuration: Array<string>, 
  contractId: AccountId
  ): bool {
  assert(env.isValidAccountID(applicant), ERR_INVALID_ACCOUNT_ID)
  assert(applicant != GUILD && applicant != ESCROW && applicant != TOTAL, ERR_RESERVED)
  
  if(members.contains(applicant)) {
    assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
  }

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred) {
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[10] = true // configuration

    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      applicant, 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      configuration, 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
    return true
  }
  return false
}


/**
 * Submit an Opportunity proposal - used to propose a new opportunity
 * @param creator
 * @param contractId
*/
export function submitOpportunityProposal(
  creator: AccountId,
  contractId: AccountId
  ): bool {
  assert(env.isValidAccountID(creator), ERR_INVALID_ACCOUNT_ID)
  assert(creator != GUILD && creator != ESCROW && creator != TOTAL, ERR_RESERVED)
  
  if(members.contains(creator)) {
    assert(members.getSome(creator).jailed == 0, ERR_JAILED)
  }

 
  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred) {
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[8] = true // opportunity

    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      creator, 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
    return true
  }
  return false
}


/**
 * Submit a Guild Kick proposal - allows community to take a risk on new members.  Proposal to put a member in jail until all proposals they have voted YES
 * on have been processed.  Forces them to stay in the DAO and be party to any consequences of those proposals.  When a member is jailed, 100% of their 
 * shares are converted to loot so they lose ability to sponsor, vote on or be beneficiary (applicant) of any further proposals.
 * @param creator
 * @param depositToken
 * @param contractId
*/
export function submitGuildKickProposal(
  memberToKick: AccountId,
  contractId: AccountId
  ): bool {
    assert(members.contains(memberToKick), 'not a member')
    
    let member = members.getSome(memberToKick)
    assert(u128.gt(member.shares, u128.Zero) || u128.gt(member.loot, u128.Zero), ERR_SHAREORLOOT)
    assert(member.jailed == 0, ERR_JAILED)
  
    // Funds transfers
    let proposalDeposit = storage.getSome<u128>('proposalDeposit')
    let depositToken = storage.getSome<string>('depositToken')
    assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

    let transferred = _sT(proposalDeposit, depositToken, contractId)

    if(transferred) {
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[5] = true; // guild kick
    
    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      memberToKick, 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
    return true
  }
  return false
}


/**
 * Submit a Whitelist proposal - used to whitelist a new token
 * @param tokenToWhitelist
 * @param contractId
*/
export function submitWhitelistProposal(tokenToWhitelist: AccountId, depositToken: AccountId, contractId: AccountId): bool {
  assert(env.isValidAccountID(tokenToWhitelist), ERR_INVALID_ACCOUNT_ID)
  assert(!tokenWhiteList.getSome(tokenToWhitelist), ERR_ALREADY_WHITELISTED)
  assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_WHITELISTED)

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[4] = true; // whitelist
    
    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      '', 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      tokenToWhitelist, 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
    return true
  }
  return false
}


/**
 * Submit a Community Role proposal - used to propose addition, editing, deleting of community roles
 * @param roleName
 * @param roleReward
 * @param roleStart
 * @param roleEnd
 * @param rolePermissions
 * @param roleParticulars
 * @param roleDescription
 * @param action
 * @param contractId
*/
export function submitCommunityRoleProposal(
  roleName: string,
  roleReward: u128, 
  roleStart: u64,
  roleEnd: u64,
  rolePermissions: Array<string>,
  roleParticulars: Array<string>,
  roleDescription: string,
  action: string, // add, remove, edit, nil
  contractId: AccountId
  ): bool {
  assert(env.isValidAccountID(contractId), ERR_INVALID_ACCOUNT_ID)
  
  // Funds transfers (Proposal Deposit)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration,  payout, communityRole, reputationFactor, assignRole,]
    f[12] = true; // communityRole

    let newRole = new communityRole(
        roleName,
        roleReward,
        roleStart,
        roleEnd,
        rolePermissions,
        roleParticulars,
        roleDescription,
        action
        )
      
    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      '', 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      newRole,
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
    return true
  }
  return false
}


/**
 * Submit a Community Assign Role proposal - used to add or remove a role from a member
 * and submit custom role configuration for that member at the same time (or can use defaults)
 * @param member - who to assign role to (applicant)
 * @param roleName
 * @param roleReward
 * @param roleStart
 * @param roleEnd
 * @param rolePermissions
 * @param roleDescription
 * @param roleParticulars
 * @param action // assign or delete (assign will check and modify existing role configuration if it exists)
 * @param contractId
*/
export function submitAssignRoleProposal(
  member: AccountId,
  roleName: string,
  roleReward: u128, 
  roleStart: u64,
  roleEnd: u64,
  rolePermissions: Array<string>,
  roleParticulars: Array<string>,
  roleDescription: string,
  action: string, // add, remove, edit, nil
  contractId: AccountId
  ): bool {
  assert(env.isValidAccountID(contractId), ERR_INVALID_ACCOUNT_ID)
  
  // Funds transfers (Proposal Deposit)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration,  payout, communityRole, reputationFactor, assignRole,]
    f[14] = true; // assignRole

    let newMemberRoleConfiguration = new communityRole(
        roleName,
        roleReward,
        roleStart,
        roleEnd,
        rolePermissions,
        roleParticulars,
        roleDescription,
        action
    )
    
    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      member, 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      new reputationFactor('', u128.Zero, 0, 0, '', new Array<string>(), new Array<string>(), ''),
      newMemberRoleConfiguration,
      references
      )
    return true
  }
  return false
}


/**
 * Submit a Reputation Factor proposal - used to add, edit, delete a new reputation factor to the community 
 * that can then be assigned to people and used in calculating reputation score
 * @param repFactorName
 * @param repFactorPoints
 * @param repFactorStart
 * @param repFactorEnd
 * @param repFactorDescription
 * @param repFactorFactors
 * @param repFactorActions
 * @param action
 * @param contractId
*/
export function submitReputationFactorProposal(
  repFactorName: string, 
  repFactorPoints: u128, 
  repFactorStart: u64, 
  repFactorEnd: u64,
  repFactorDescription: string,
  repFactorFactors: Array<string>,
  repFactorActions: Array<string>,
  action: string, // add, edit, delete, nil
  contractId: AccountId
  ): bool {
  assert(env.isValidAccountID(contractId), ERR_INVALID_ACCOUNT_ID)
  
  // Funds transfers (Proposal Deposit)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let f = new Array<bool>(15) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    f[13] = true; // reputationFactor

    let newRepFactor = new reputationFactor(
        repFactorName,
        repFactorPoints,
        repFactorStart,
        repFactorEnd,
        repFactorDescription,
        repFactorFactors,
        repFactorActions,
        action
        )

    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)

    _submitProposal(
      '', 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      u128.Zero, 
      '', 
      f, 
      new Array<string>(), 
      new Array<string>(), 
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      newRepFactor,
      new communityRole('', u128.Zero, 0, 0, new Array<string>(), new Array<string>(), '', ''),
      references
      )
    return true
  }
  return false
}


/**
 * Internal private submit proposal function - builds the actual proposal
 * @param a // applicant
 * @param sR // sharesRequested (voting shares)
 * @param lR // lootRequested (non-voting shares)
 * @param tO // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tT // tributeToken (type of token)
 * @param pR // paymentRequested (amount of payment requested) - in yocto if NEAR
 * @param pT // paymentToken (desired token for payment)
 * @param f // flags [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, roleConfiguration, reputationConfiguration]
 * @param roleNames
 * @param configuration
 * @param roleConfiguration
 * @param reputationConfiguration
*/
function _submitProposal(
  a: AccountId,
  sR: u128,
  lR: u128,
  tO: u128,
  tT: AccountId,
  pR: u128,
  pT: AccountId,
  f: Array<bool>,
  roleNames: Array<string>,
  configuration: Array<string>,
  roleConfiguration: communityRole,
  reputationConfiguration: reputationFactor,
  memberRoleConfiguration: communityRole,
  referenceIds: Array<GenericObject>
): bool {
  let pI = proposals.length
  proposals.push(new Proposal(
    pI, // proposal Id
    a, // applicant
    Context.predecessor, // proposer
    '', // sponsor
    sR, // sharesRequested
    lR, // lootRequested
    tO, // tributeOffered
    tT, // tributeToken
    pR, // paymentRequested
    pT, // paymentToken
    0, // startingPeriod
    u128.Zero, // yesVotes
    u128.Zero, // noVotes
    f, // flags: [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, roleConfiguration, reputationConfiguration]
    u128.Zero, //the maximum # of total shares encountered at a yes vote on this proposal
    Context.blockTimestamp, // submission time
    0, // votingPeriod
    0, // gracePeriod
    roleNames, // rolenames
    0, // voteFinalized
    configuration, // configuration
    roleConfiguration, // roleconfiguration
    reputationConfiguration, // reputationConfiguration
    memberRoleConfiguration, // member specific role configuration
    referenceIds // references to other proposals
  ))
  
  votesByMember.push({user: Context.predecessor, pI: pI, vote: ''})
  
  return true
}


/**
 * Sponsor proposal - moves the proposal into the voting period.  Is done by a member once enough detail/discussion has taken place to facilitate voting.
 * @param pI // proposal index used to find the proposal
 * @param depositToken
 * @param contractId
*/
export function sponsorProposal(
  pI: i32, 
  depositToken: AccountId, 
  contractId: AccountId
  ): bool {
 
  assert(onlyDelegate(Context.predecessor), 'not a delegate')

  let proposalIndex = getProposalIndex(pI)
  let proposal = proposals[proposalIndex]

  assert(proposal.pI == pI, 'not right proposal')
  assert(env.isValidAccountID(proposal.p), 'invalid account ID and not proposed')
  assert(!proposal.f[0], 'already sponsored')
  assert(!proposal.f[3], 'proposal cancelled')

  // if a commitment proposal, ensure the funding commitment request could be fulfilled - 
  // i.e., is less than what is in the community fund
  if(proposal.f[7]) {
    //get guild token balances
    let balance = getUserTokenBalance(GUILD, proposal.pT)
    assert(u128.le(proposal.pR, balance), 'potential commitment must be less than what is in the community fund')
  }

  // collect proposal deposit from sponsor and store it in the contract until the proposal is processed
  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  assert(u128.eq(Context.attachedDeposit, u128.mul(proposalDeposit, u128.from('1000000000000000000000000'))), 'attached deposit not correct')

  let transferred = _sT(proposalDeposit, depositToken, contractId)

  if(transferred) {

    if(members.contains(proposal.a)){
      assert(members.getSome(proposal.a).jailed == 0, 'member jailed')
    }

    if(u128.gt(proposal.tO, u128.Zero) && u128.eq(getUserTokenBalance(GUILD, proposal.tT), u128.Zero)) {
      let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
      assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, 'guild bank full')
    }
  
    // Whitelist proposal
    if(proposal.f[4]) {
      assert(!tokenWhiteList.getSome(proposal.tT), 'already whitelisted')
      assert(!proposedToWhiteList.getSome(proposal.tT), 'whitelist proposed already')
      assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, 'can not sponsor more')
      proposedToWhiteList.set(proposal.tT, true)
    }

    //Guild Kick Proposal
    if (proposal.f[5]) {
      assert(!proposedToKick.getSome(proposal.a), 'already proposed to kick')
      proposedToKick.set(proposal.a, true)
    }

    // compute starting period for proposal
    let max = _max(
      getCurrentPeriod(), 
      proposals.length == 0 ? 0 : proposals.length == 1 ? proposals[proposalIndex].sP : proposals[proposalIndex - 1].sP
    )
    let sP = max + 1
    let vP = sP + storage.getSome<i32>('votingPeriodLength')
    let gP = sP + storage.getSome<i32>('votingPeriodLength') + storage.getSome<i32>('gracePeriodLength')

    let memberAddress = memberAddressByDelegatekey.getSome(Context.predecessor)

    let f = proposal.f //
    f[0] = true //sponsored

    proposal.f = f
    proposal.sP = sP
    proposal.s = memberAddress
    proposal.vP = vP
    proposal.gP = gP
    
    proposals[proposalIndex] = proposal

    return true
  }
  return false
}


/**
 * Submit Vote - the voting mechanism(s) that determine whether a proposal passes or not
 * @param pI // proposal index used to find the proposal
 * @param vote // yes or no
*/
export function submitVote(pI: i32, vote: string): bool {

  assert(onlyDelegate(Context.predecessor), ERR_NOT_DELEGATE)

  // ensures voting address has voting shares
  let memberAddress = memberAddressByDelegatekey.getSome(Context.predecessor)
  let member = members.getSome(memberAddress)

  // check that proposal exists by finding it's index in the proposal vector
  let proposalIndex = getProposalIndex(pI)
  assert(proposalIndex != -1, ERR_PROPOSAL_NO)
  
  let proposal = proposals[proposalIndex]
  
  // ensure it's a valid vote and that we are still in the voting period (between start and end times)
  assert(vote == 'yes' || vote=='no', ERR_VOTE_INVALID)
  assert(getCurrentPeriod() >= proposal.sP, ERR_VOTING_NOT_STARTED)
  assert(getCurrentPeriod() <= proposal.vP, ERR_VOTING_PERIOD_EXPIRED)
  
  // check to see if this member has already voted
  let existingVote = getMemberProposalVote(Context.predecessor, pI)
  assert(existingVote == 'no vote yet', ERR_ALREADY_VOTED)

  votesByMember.push({user: Context.predecessor, pI: pI, vote: vote})

  if(vote == 'yes') {
    let allVotingShares = u128.add(member.shares, member.receivedDelegations)
    let newyV = u128.add(proposal.yV, u128.sub(allVotingShares, member.delegatedShares))

    //set highest index (latest) yes vote - must be processed for member to ragequit
    if(proposalIndex > member.highestIndexYesVote) {
      member.highestIndexYesVote = proposalIndex
      members.set(memberAddress, member)
    }

    // set maximum of total shares encountered at a yes vote - used to bound dilution for yes voters. The dilution bound exists to 
    // prevent share based overpayment resulting from mass ragequit, and thus takes loot into account when calculating the anticipated dilution
    let newmT: u128 // maxtotalsharesandlootatyesvote
    let totalShares = storage.getSome<u128>('totalShares')
    let totalLoot = storage.getSome<u128>('totalLoot')

    if(u128.gt(u128.add(totalShares, totalLoot), proposal.mT)) {
      newmT = u128.add(totalShares, totalLoot)
    } else {
      newmT = proposal.mT
    }
    proposal.yV = newyV
    proposal.mT = newmT
    proposals[proposalIndex] = proposal
  }
  
  if (vote == 'no') {
    let allVotingShares = u128.add(member.shares, member.receivedDelegations)
    let newnV = u128.add(proposal.nV, u128.sub(allVotingShares, member.delegatedShares))
    proposal.nV = newnV
    proposals[proposalIndex] = proposal 
  }

  // if total vote after this vote is processed either for or against satisfies voting decision for pass/fail, then push proposal into
  // grace period.  Prevents a proposal from sitting in voting longer than necessary when the vote has already been decided.
  let updatedProposal = proposals[proposalIndex]
  let voteDecided = _didPass(updatedProposal)
  if(voteDecided){
    updatedProposal.vP = getCurrentPeriod()
    updatedProposal.gP = getCurrentPeriod() + storage.getSome<i32>('gracePeriodLength')
    updatedProposal.voteFinalized = Context.blockTimestamp
    proposals[proposalIndex] = updatedProposal
  }

  return true
}

/**
 * Process proposal - process a proposal that has gone through the voting period and return deposit to sponsor and proposer
 * @param pI // proposal index used to find the proposal
*/
export function processProposal(pI: i32): bool {

  // check to make sure the proposal is ready for processing
  let proposalIndex = getProposalIndex(pI)
  let proposal = proposals[proposalIndex]

  assert(_votingPeriodPassed(proposal), 'not ready for processing')
  
  // check to see if it's a whitelist proposal
  if(proposal.f[4]) {
    processWhitelistProposal(proposalIndex)
    return true
  }

  // check to see if it's a guildkick proposal
  if(proposal.f[5]){
    processGuildKickProposal(proposalIndex)
    return true
  }

  // another check to see that it's not a special proposal (not guildkick or whitelist)
  assert(!proposal.f[4] && !proposal.f[5], ERR_STANDARD_PROPOSAL)

  // mark proposal as processed
  let f = proposal.f
  f[1] = true; //processed
  proposal.f = f
  proposals[proposalIndex] = proposal

  // get outcome of the vote
  let didPass = _didPass(proposal)

  if(didPass){
    _proposalPassed(proposalIndex, proposal)
  } else {
    _proposalFailed(proposal)
  }
 
  _returnDeposit(proposal.s)
  _returnDeposit(proposal.p)

  return true
}


/**
 * Process WhiteList proposal - process a whitelist proposal that has gone through the voting period and return deposit to sponsor and proposer
 * @param pI // proposal index used to find the proposal
*/
function processWhitelistProposal(pI: i32): void {

  let proposalIndex = getProposalIndex(pI)
  let proposal = proposals[proposalIndex]

  assert(_votingPeriodPassed(proposal), 'not ready for processing')

  assert(proposal.f[4], ERR_WHITELIST_PROPOSAL)

  // mark as processed
  let f = proposal.f
  f[1] = true; //processed
  proposal.f = f
  proposals[proposalIndex] = proposal

  let didPass = _didPass(proposal)

  if(approvedTokens.length >= MAX_TOKEN_WHITELIST_COUNT) {
    didPass = false
  }

  if (didPass) {
    // mark as passed
    let f = proposal.f
    f[2] = true //didPass
    proposal.f = f
    proposals[proposalIndex] = proposal

    tokenWhiteList.set(proposal.tT, true)
    approvedTokens.push(proposal.tT)
  }

  proposedToWhiteList.set(proposal.tT, false)
 
  _returnDeposit(proposal.s)
  _returnDeposit(proposal.p)
  
}


/**
 * Process GuildKick proposal - process a guildkick proposal that has gone through the voting period and return deposit to sponsor and proposer
 * @param pI // proposal index used to find the proposal
*/
function processGuildKickProposal(pI: i32): void {

  let proposalIndex = getProposalIndex(pI)
  let proposal = proposals[proposalIndex]

  assert(_votingPeriodPassed(proposal), 'not ready for processing')
 
  assert(proposal.f[5], ERR_GUILD_PROPOSAL)

  //assign proposal 'processed' flag
  let f = proposal.f //
  f[1] = true //processed
  proposal.f = f
  proposals[proposalIndex] = proposal

  let didPass = _didPass(proposal)

  if(didPass) {
  
    //assign proposal 'didPass' flag
    let f = proposal.f
    f[2] = true //didPass
    proposal.f = f
    proposals[proposalIndex] = proposal

    let member = members.getSome(proposal.a)

    // reverse any existing share delegations
    let delegated = delegation.getSome(proposal.a)
    let i: i32 = 0
    while (i < delegated.length) {
      let delegatedOwner = members.getSome(delegated[i].delegatedTo) // get original owner to give delegations back to
      delegatedOwner.delegatedShares = u128.sub(delegatedOwner.delegatedShares, delegated[i].shares) // reduce delegated shares by amount that was delegated
      delegated[i].shares = u128.Zero // zeroize the delegation
      members.set(delegatedOwner.delegateKey, delegatedOwner) // update delegated member
      i++
    }

    delegation.set(proposal.a, delegated) // update kicked member's delegation tracking

    let updateMember = new Member(
      member.delegateKey,
      u128.Zero, // revoke all shares
      u128.Zero, // revoke all delegations
      u128.Zero, // revoke all received delegations
      u128.add(member.loot, member.shares), //transfer shares to loot
      true,
      member.highestIndexYesVote,
      proposalIndex,
      member.joined,
      Context.blockTimestamp,
      false,
      member.roles,
      member.reputation
      )

    members.set(proposal.a, updateMember)
     
    //transfer shares to loot
    let currentTotalShares = storage.getSome<u128>('totalShares')
    let newTotalShares = u128.sub(currentTotalShares, member.shares)
    storage.set<u128>('totalShares', newTotalShares)
    
    let currentTotalLoot = storage.getSome<u128>('totalLoot')
    let newTotalLoot = u128.add(currentTotalLoot, member.shares)
    storage.set<u128>('totalLoot', newTotalLoot)
  }

  proposedToKick.set(proposal.a, false)

  _returnDeposit(proposal.s)
  _returnDeposit(proposal.p)

}


/**
 * Leave - function that lets a member leave the community with their fair share of 
 * the community fund.  They have the option of taking a fractional share of what they 
 * are entitled to. The remaining will be donated to the community on their behalf 
 * (initiates donation).  If they are the last member, they do not have that option.  
 * Remaining funds will be transferred to them and the community will be dissolved 
 * completely.
 * @param contractId
 * @param accountId
 * @param share
 * @param remainingBalance
 * @param appOwner
*/
export function leave(contractId: AccountId, accountId: AccountId, share: u128, remainingBalance: u128, appOwner: AccountId): boolean {
  assert(env.isValidAccountID(accountId), ERR_INVALID_ACCOUNT_ID)
  assert(env.isValidAccountID(appOwner), ERR_INVALID_ACCOUNT_ID)
  assert(accountId == Context.predecessor, 'only the account owner can leave the community')
 
  let depositToken = storage.getSome<string>('depositToken')
 
  let fairShare = getCurrentShare(accountId)
  assert(u128.le(share, fairShare), 'asking to withdraw more than fair share of the fund')

  //retrieve member
  let member = members.getSome(accountId)
  
  // transfer user's fairShare back to them
  let withdrawn = _sT(share, depositToken, accountId)

  // transfer remaining contract balance (less fairshare already sent) to app owner
  // use _sTRaw as remaining will be in yocto
  let remaining = u128.sub(remainingBalance, u128.mul(share, u128.from('1000000000000000000000000')))
  let transfer = _sTRaw(remaining, depositToken, appOwner)

  if(withdrawn && transfer) {
    _subtractFromBalance(Context.predecessor, depositToken, share)
    _subtractFromBalance(GUILD, depositToken, share)
    _subtractFromTotalBalance(depositToken, share)

    // check for last member and make donation if applicable
    let numberOfMembers = getTotalMembers()

    if(u128.ne(numberOfMembers, u128.from(1))){
      makeDonation(contractId, accountId, depositToken, u128.sub(fairShare, share))
    }

    // remove shares from total shares
    let currentTotalShares = storage.getSome<u128>('totalShares')
    let newTotalShares = u128.sub(currentTotalShares, member.shares)
    storage.set<u128>('totalShares', newTotalShares)

    // remove loot from total loot
    let currentTotalLoot = storage.getSome<u128>('totalLoot')
    let newTotalLoot = u128.sub(currentTotalLoot, member.loot)
    storage.set<u128>('totalLoot', newTotalLoot)

    // remove share delegations
    if(delegation.contains(Context.predecessor)){
      let delegations = delegation.getSome(Context.predecessor)
      let i: i32 = 0
      while (i < delegations.length){
          // Remove received delegations from those this member delegated to
          let delegatedMember = members.getSome(delegations[i].delegatedTo)
          delegatedMember.receivedDelegations = u128.sub(delegatedMember.receivedDelegations, delegations[i].shares)
          members.set(delegations[i].delegatedTo, delegatedMember)
          i++
      }
      // delegation info is now empty (all delegations returned to owners) - thus delete the delegation info
      delegation.delete(Context.predecessor)
    }
      
    // delete member
    members.delete(accountId)
    
    return true
  } else {
    return false
  }
}


/********************************/ 
/* PROXY VOTING (DELEGATION)    */
/********************************/

/**
 * Delegate - function that lets a member delegate all or a portion of their voting shares to
 * another member
 * @param delegateTo
 * @param quantity
*/
export function delegate(delegateTo: string, quantity: u128): boolean {
  assert(env.isValidAccountID(delegateTo), ERR_INVALID_ACCOUNT_ID)
  assert(u128.gt(quantity, u128.Zero), 'no share quantity specified')
  assert(Context.predecessor == Context.sender, 'sender is not predecessor')

  //get current number of shares of person attempting to delegate
  let member = members.getSome(Context.predecessor)
  assert(u128.ge(member.shares, quantity), 'member does not have enough shares to delegate')

  //obtain Context.predecessor's map of vectors of existing delegations or start a new one
  if(delegation.contains(Context.predecessor)){
    let existingDelegations = delegation.getSome(Context.predecessor)
    let newDelegation = new delegationInfo(delegateTo, quantity)
    existingDelegations.push(newDelegation)
    delegation.set(Context.predecessor, existingDelegations)

    // add quantity shares to member's delegatedShares - used to reduce member's voting power 
    member.delegatedShares = u128.add(member.delegatedShares, quantity)
    members.set(Context.predecessor, member)

    // add quantity shares to the member receivedDelegations - tracks shares delegated to a member
    let delegate = members.getSome(delegateTo)
    delegate.receivedDelegations = u128.add(delegate.receivedDelegations, quantity)
    members.set(delegateTo, delegate)
    
  } else {
    let existingDelegations = new PersistentVector<delegationInfo>('ed')
    let newDelegation = new delegationInfo(delegateTo, quantity)
    existingDelegations.push(newDelegation)
    delegation.set(Context.predecessor, existingDelegations)

    // add quantity shares to member's delegatedShares - used to reduce member's voting power 
    member.delegatedShares = u128.add(member.delegatedShares, quantity)
    members.set(Context.predecessor, member)

    // add quantity shares to the member receivedDelegations - tracks shares delegated to a member
    let delegate = members.getSome(delegateTo)
    delegate.receivedDelegations = u128.add(delegate.receivedDelegations, quantity)
    members.set(delegateTo, delegate)
  }

 return true
}


/**
 * Undelegate - function that lets a member take back all the votes they had previously delegated
 * to another member
 * @param delegateFrom
 * @param quantity
*/
export function undelegate(delegateFrom: string, quantity: u128): boolean {
  assert(env.isValidAccountID(delegateFrom), ERR_INVALID_ACCOUNT_ID)
  assert(u128.gt(quantity, u128.Zero), 'quantity must be greater than zero')

  // get user's current delegations
  let delegations = delegation.getSome(Context.predecessor)
  let i: i32 = 0
  while (i < delegations.length){
    if(delegations[i].delegatedTo == delegateFrom && u128.gt(delegations[i].shares, u128.Zero)){
      assert(u128.le(quantity, delegations[i].shares), 'not enough shares delegated, lower quantity')
      let member = members.getSome(Context.predecessor)
     
      member.delegatedShares = u128.sub(member.delegatedShares, quantity)
      members.set(Context.predecessor, member)

      delegations[i].shares = u128.sub(delegations[i].shares, quantity)
      delegation.set(Context.predecessor, delegations)

      let delegatedMember = members.getSome(delegateFrom)
      delegatedMember.receivedDelegations = u128.sub(delegatedMember.receivedDelegations, quantity)
      members.set(delegateFrom, delegatedMember)
      break
    }
    i++
  }
  return true
}



/**************************************************/ 
/* FUNCTIONS FOR POSSIBLE FUTURE IMPLEMENTATION   */
/* (not currently accessible via the frontend)
/**************************************************/

/**
 * Function that allows someone to update their delegatekey
 * @param contractId
 * @param token
 * @param amount
*/
export function updateDelegateKey(newDelegateKey: AccountId): bool {

  assert(onlyShareholder(Context.predecessor), ERR_NOT_SHAREHOLDER)
  assert(env.isValidAccountID(newDelegateKey), ERR_INVALID_ACCOUNT_ID)

  if(newDelegateKey != Context.predecessor) {
    assert(!members.getSome(newDelegateKey).existing, ERR_NO_OVERWRITE_MEMBER)
    assert(!members.getSome(memberAddressByDelegatekey.getSome(newDelegateKey)).existing, ERR_NO_OVERWRITE_KEY)
  }

  let member = members.getSome(Context.predecessor)
  memberAddressByDelegatekey.set(member.delegateKey, '')
  memberAddressByDelegatekey.set(newDelegateKey, Context.predecessor)
  member.delegateKey = newDelegateKey

  members.set(member.delegateKey, member)
  return true
}