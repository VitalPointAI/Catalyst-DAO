  

import { Context, storage, AVLTree, u128, ContractPromiseBatch, PersistentMap } from "near-sdk-as"
import { 
  assertValidId,
  assertValidApplicant,
  predecessor, 
} from "./utils"
import { 
  AccountId, 
  PeriodDuration, 
  VotingPeriodLength, 
  GracePeriodLength, 
  ProposalDeposit, 
  DilutionBound,
  VoteThreshold,
  GUILD,
  ESCROW,
  TOTAL
} from './dao-types'
import { 
  members,
  memberAddressByDelegatekey,
  memberProposals,
  tokenWhiteList,
  communityRole,
  memberRoles,
  roles,
  reputationFactor,
  reputationFactors,
  memberRepFactors,
  Member,
  Proposal,
  proposals,
  proposedToWhiteList,
  proposedToKick,
  approvedTokens,
  Votes,
  TokenBalances,
  Donation,
  contributions,
  memberDelegations,
  DelegationInfo,
  GenericObject,
  TokenAccounting,
  accountVotes,
  affiliations,
  affiliationProposals,
  receivedDelegations,
  tokenBalances
 } from './dao-models'
import {
  ERR_DAO_ALREADY_INITIALIZED,
  ERR_INSUFFICIENT_BALANCE,
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
  ERR_NOT_A_MEMBER
} from './dao-error-messages'


let depositToken: string
const TokenClass = new TokenAccounting()

// *****************
// HARD-CODED LIMITS
// These numbers are quite arbitrary; they are small enough to avoid overflows
// when doing calculations with periods or shares, yet big enough to not limit 
// reasonable use cases.
// *****************
export const MAX_VOTING_PERIOD_LENGTH: i32 = 10**8 // maximum length of voting period
export const MAX_GRACE_PERIOD_LENGTH: i32 = 10**8 // maximum length of grace period
export const MAX_DILUTION_BOUND: i32 = 10**8 // maximum dilution bound
export const MAX_NUMBER_OF_SHARES_AND_LOOT: i32 = 10**8 // maximum number of shares that can be minted
export const MAX_TOKEN_WHITELIST_COUNT: i32 = 400 // maximum number of whitelisted tokens
export const MAX_TOKEN_GUILDBANK_COUNT: i32 = 400 // maximum number of tokens with non-zero balance in guildbank
export const MAX_DELEGATION_LIMIT: u32 = 10 // maximum number of delegations someone can do (prevent running out of gas when performing bulk undelegate actions)
export const ONE_NEAR = u128.from('1000000000000000000000000')
                                      
// ********************
// MODIFIERS
// ********************

/**
* Returns the owner (summoner) which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param owner 
*/
export function isOwner(summoner: AccountId): boolean {
  assertValidId(summoner)
  return summoner == storage.getSome<string>("summoner")
}

/**
* Returns the shareholder which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param shareholder
*/
export function onlyShareholder(shareholder: AccountId): boolean {
  assertValidId(shareholder)
  return Member.get(shareholder).hasShares()
}

/**
* Returns the member which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param member 
*/
export function onlyMember(member: AccountId): boolean {
  assertValidId(member)
  const _member = Member.get(member)
  return _member.hasShares() || _member.hasLoot()
}

/**
* Returns the delegate which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param delegate
*/
export function onlyDelegate(delegate: AccountId): boolean {
  assertValidId(delegate)
  return Member.getDelegate(delegate).hasShares()
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
 * @param _contribution
 * @param _contractId
 * @param _platformSupport
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
    _contribution: u128,
    _platformSupportPercent: u128,
    _platformAccount: AccountId,
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
  assertValidId(_contractId)
  assertValidId(_platformAccount)
  assert(u128.ge(Context.attachedDeposit, _contribution), 'attached deposit must match shares')
 
  depositToken = _approvedTokens[0]
  storage.set<string>('depositToken', depositToken)

  for (let i: i32 = 0; i < _approvedTokens.length; i++) {
    if(_approvedTokens[i] != 'Ⓝ' ){
    assertValidId(_approvedTokens[i])
    }
    if(tokenWhiteList.contains(_approvedTokens[i])) {
      assert(!tokenWhiteList.getSome(_approvedTokens[i]), ERR_DUPLICATE_TOKEN)
    } else {
      tokenWhiteList.set(_approvedTokens[i], true)
    }
    approvedTokens.push(_approvedTokens[i])
  }
  
  //set Summoner
  storage.set<string>('summoner', predecessor())
  
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

  //set platformSupport
  storage.set<u128>('platformSupportPercent', _platformSupportPercent)
  storage.set<AccountId>('platformAccount', _platformAccount)

  //set summoning Time
  storage.set<u64>('summoningTime', Context.blockTimestamp)

  //set initial Guild/Escrow/Total address balances
  TokenClass.add(GUILD, depositToken)
  TokenClass.add(ESCROW, depositToken)
  TokenClass.add(TOTAL, depositToken)
  storage.set<i32>('totalGuildBankTokens', 0)
  storage.set<u128>('totalShares', u128.Zero)
  storage.set<u128>('totalLoot', u128.Zero)
  storage.set<u128>('totalMembers', u128.Zero)

  // transfer summoner contribution to the community fund
  let transferred = _sTRaw(_contribution, depositToken, _contractId)
  
  if(transferred) {
    TokenClass.addContribution(predecessor(), depositToken, _contribution)
 
    // makes member object for summoner and puts it into the members storage
    members.set(predecessor(), 
      new Member(
        predecessor(), 
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
        new Array<communityRole>(),
        new Array<reputationFactor>()
        ))
    
    // initiate vote tracking
    let newVote = new PersistentMap<u32, string>('uv' + predecessor())
    newVote.set(0, '')
    accountVotes.set(predecessor(), newVote)
      
    let currentMembers = storage.getSome<u128>('totalMembers')
    storage.set('totalMembers', u128.add(currentMembers, u128.from(1)))

    memberAddressByDelegatekey.set(predecessor(), predecessor())

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
 * @param platformSupportPercent
 * @param platformAccount
 */
export function setInit(
  _periodDuration: PeriodDuration,
  _votingPeriodLength: VotingPeriodLength,
  _gracePeriodLength: GracePeriodLength,
  _proposalDeposit: ProposalDeposit,
  _dilutionBound: DilutionBound,
  _voteThreshold: VoteThreshold,
  _platformSupportPercent: u128,
  _platformAccount: AccountId,
): u64 {
  assert(isOwner(predecessor()), 'not the owner')
  return _setInit(
    _periodDuration,
    _votingPeriodLength,
    _gracePeriodLength,
    _proposalDeposit,
    _dilutionBound,
    _voteThreshold,
    _platformSupportPercent,
    _platformAccount
  )
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
  _voteThreshold: VoteThreshold,
  _platformSupportPercent: u128,
  _platformAccount: AccountId,
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

//set platformSupport
storage.set<u128>('platformSupportPercent', _platformSupportPercent)
storage.set<AccountId>('platformAccount', _platformAccount)

return Context.blockTimestamp
}


/*********************/ 
/* UTILITY FUNCTIONS */
/*********************/
/**
 * Internal function to initalize and assign default role to new member
 * @param applicant
*/
export function initializeDefaultMemberRoles(applicant: AccountId): void {
   
  let defaultPermissions = new Array<string>()
  defaultPermissions.push('read')
  
  const defaultMemberRole = new communityRole('member', u128.Zero, Context.blockTimestamp, 0, defaultPermissions, new Array<string>(), 'default member role', 'nil') // default role given to everyone
  
  let communitysRoles = new AVLTree<string, communityRole>('dcr')
  communitysRoles.set('default', defaultMemberRole)
  roles.set(Context.contractName, communitysRoles)

  // assign default member role
  let thisMemberRoles = new AVLTree<string, communityRole>('dmr' + applicant)
  thisMemberRoles.set('default', defaultMemberRole)
  memberRoles.set(predecessor(), thisMemberRoles)
}

/**
 * 
 * @param applicant
 */
export function initializeDefaultReputationFactors(applicant: AccountId): void {
  
  // create empty reputation factors holder
  const defRepFactor = new reputationFactor('', u128.Zero, Context.blockTimestamp, 0, 'default reputation factor', new Array<string>(), new Array<string>(), '' )
  
  let communityRepFactors = new AVLTree<string, reputationFactor>('crfs')
  communityRepFactors.set('default', defRepFactor)
  reputationFactors.set(Context.contractName, communityRepFactors)

  //assign default reputation factor
  let thisMemberRepFactors = new AVLTree<string, reputationFactor>('rf' + applicant)
  thisMemberRepFactors.set('default', defRepFactor)
  memberRepFactors.set(predecessor(), thisMemberRepFactors)
}


/**
 * Internal function that transfers tokens from one account to another
 * @param from
 * @param to
 * @param token
 * @param amount (in yocto)
*/
function _internalTransfer(from: AccountId, to: AccountId, token: AccountId, amount: u128): void {
  assertValidId(from)
  assertValidId(to)
  TokenClass.transfer(from, to, token, amount)
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
  //let firstAdd = proposal.startingPeriod + storage.getSome<i32>('votingPeriodLength') 
  //assert(getCurrentPeriod() >= (firstAdd + storage.getSome<i32>('gracePeriodLength')), ERR_NOT_READY)
  assert(getCurrentPeriod() > (proposal.gracePeriod + storage.getSome<i32>('gracePeriodLength')), ERR_NOT_READY)
  
  // check to confirm it hasn't already been processed
  assert(proposal.flags[1] == false, ERR_PROPOSAL_PROCESSED)
 
  return true
}

/**
 * Function to determine if we can bypass the rest of the voting period because threshold is met
 * @param proposal 
 * @returns 
 */
function _bypass(proposal: Proposal): bool {
  // check to see if we can speed up a failure vote by seeing if there is any chance number of outstanding votes exceeds no votes already cast
  let requiredVotes = getNeededVotes()
  if(u128.ge(proposal.yesVotes, requiredVotes) || u128.ge(proposal.noVotes, requiredVotes)){
    return true
  } else {
    return false
  }
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
  
  let totalVotes = u128.add(proposal.yesVotes, proposal.noVotes)
  let achieved = u128.muldiv(totalVotes, u128.from('100'), totalShares)
  let didPass = proposal.yesVotes > proposal.noVotes && u128.ge(achieved, voteThreshold)
  
  // Make the proposal fail if the dilutionBound is exceeded 
  if(u128.lt(u128.mul(u128.add(totalShares, totalLoot), u128.from(storage.getSome<i32>('dilutionBound'))), u128.from(proposal.maxTotalSharesAndLootAtYesVote))) {
    didPass = false
  }
 
  // Make the proposal fail if the applicant is jailed
  // - for standard proposals, we don't want the applicant to get any shares/loot/payment
  // - for guild kick proposals, we should never be able to propose to kick a jailed member (or have two kick proposals active), so it doesn't matter
  if(members.contains(proposal.applicant)) {
    if(members.getSome(proposal.applicant).jailed != 0) {
      didPass = false
    }
  }

  //Make the proposal fail if the new total number of shares and loot exceeds the limit
  let firstAdd = u128.add(totalShares, totalLoot)
  let secondAdd = u128.add(proposal.sharesRequested, proposal.lootRequested)
  if(u128.gt(u128.add(firstAdd, secondAdd), u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT))) {
    didPass = false
  }

  //Make the proposal fail if it is requesting more tokens as payment than the available fund balance
  if(u128.gt(proposal.paymentRequested, u128.Zero)){
    if(u128.gt(proposal.paymentRequested, u128.from(TokenClass.get(GUILD, proposal.paymentToken)))) {
      didPass = false
    }
  }
  
  //Make the proposal fail if it would result in too many tokens with non-zero balance in guild bank
  let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
  if(u128.gt(proposal.tributeOffered, u128.Zero) && u128.eq(TokenClass.get(GUILD, proposal.tributeToken), u128.Zero) && totalGuildBankTokens >= MAX_TOKEN_GUILDBANK_COUNT) {
    didPass = false
  }
  
  return didPass
}


/**
 * Internal function that is called to return the associated proposal deposit when actions are completed
 * @param to
*/
function _returnDeposit(to: AccountId): bool {
  assertValidId(to)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  let transferred = _sTRaw(proposalDeposit, depositToken, to)
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
  assert(onlyMember(predecessor()), ERR_NOT_A_MEMBER)
  _ragequit(predecessor(), sharesToBurn, lootToBurn)
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
    let amountToRagequit = _fairShare(TokenClass.get(GUILD, approvedTokens[i]), sharesAndLootToBurn, initialTotalSharesAndLoot)
    if (u128.gt(amountToRagequit, u128.Zero)) {

      // transfer to user
      let transferred = _sTRaw(amountToRagequit, approvedTokens[i], memberAddress)

      if(transferred) {
        TokenClass.withdrawFromGuild(memberAddress, approvedTokens[i], amountToRagequit)
      }

    }
  }
}


/**
 * Internal function to verify that a member can ragequit - last proposal they voted yes on must have been processed
 * otherwise they could potentially be taking away funds that were supposed to go to someone based on a community decision
 * @param highestIndexYesVote
*/
function canRageQuit(highestIndexYesVote: u32): bool {
  assert(highestIndexYesVote < proposals.size, ERR_PROPOSAL_NO)
  return proposals.getSome(highestIndexYesVote).flags[1]
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
  assertValidId(to)
  assert(to == predecessor(), 'not account that is withdrawing')
  TokenClass.assertBalance(to, token, amount)

  let fairShare = getCurrentShare(to)
  assert(u128.le(amount, fairShare), 'asking to withdraw more than fair share of the fund')

  let transferred = _sTRaw(amount, token, to)

  if(transferred) {
    TokenClass.withdrawFromTotal(to, token, amount)
    return true
  }
  return false
}

/**
 * Cancels a proposal before it has been sponsored.  Returns proposal deposit to proposer.
 * @param proposalId (proposal Id)
 * @param deposit (proposal deposit)
 * @param to
*/
// NOTE: requires that proposer cancels
export function cancelProposal(proposalId: u32, tribute: u128, loot: u128): Proposal {
  
  let proposal = proposals.getSome(proposalId)
  assert(proposal.proposer == predecessor(), 'not the proposer')
  assert(!proposal.flags[0], ERR_ALREADY_SPONSORED)
  assert(!proposal.flags[3], ERR_ALREADY_CANCELLED)
 
  // mark proposal as cancelled
  let flags = proposal.flags
  flags[3] = true; //cancelled
  proposal.flags = flags
  proposals.set(proposal.proposalId, proposal)

  if(flags[6]){
    memberProposals.delete(proposal.applicant)
  }

  // return proposal deposit
  let returned = _returnDeposit(proposal.proposer)

  if(returned){
    // return any shares/loot
    let totalSharesLoot = u128.add(tribute, loot)
    let secondTransfer = _sTRaw(totalSharesLoot, proposal.tributeToken, proposal.proposer)

    if(secondTransfer) {
      TokenClass.withdrawFromEscrow(proposal.proposer, proposal.tributeToken, totalSharesLoot)
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
  assertValidId(contractId)
  assertValidId(contributor)
  assert(tokenWhiteList.getSome(token), ERR_NOT_WHITELISTED)
  assert(u128.ge(Context.attachedDeposit, amount), 'attached deposit must match donation amount')
  assert(u128.gt(amount, u128.Zero), 'contribution must be greater than zero')
  
  let donationId = contributions.size

  let contribution = new Donation()
  contribution.contributor = contributor
  contribution.donationId = donationId
  contribution.donation = amount
  contribution.contributed = Context.blockTimestamp
  contributions.set(donationId, contribution)
  
  let transferred = _sTRaw(amount, token, contractId)

  if(transferred) {
    TokenClass.addToGuild(token, amount)

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
  return memberProposals.contains(applicant)
}


/**
 * Internal private function to determine whether there is an existing affiliation proposal for a given applicant
 * @param applicant
*/
function _affiliateProposalPresent(applicant: AccountId): bool {
  return affiliationProposals.contains(applicant)
}


/**
 * Internal private function to determine the larger of two integers
 * @param x
 * @param y
*/
function _max(x: u64, y: u64): u64 {
  return x >= y ? x : y
}


/**
 * Internal private function to execute actions of a passed proposal
 * @param proposalIndex
 * @param proposal
*/
function _proposalPassed(proposal: Proposal, platformPayment: u128): bool {
 
  // mark proposal as passed 
  let flags = proposal.flags
  flags[2] = true //didPass
  proposal.flags = flags
  proposals.set(proposal.proposalId, proposal)

  if(members.contains(proposal.applicant)) {
    // if the applicant is already a member, add to their existing shares and loot
    let member = members.getSome(proposal.applicant)
    let newShares = u128.add(member.shares, proposal.sharesRequested)
    let newLoot = u128.add(member.loot, proposal.lootRequested)
 
    members.set(proposal.applicant, new Member(
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
    if(memberAddressByDelegatekey.contains(proposal.applicant)){
      if(members.contains(memberAddressByDelegatekey.getSome(proposal.applicant))) {
        let memberToOverride = memberAddressByDelegatekey.getSome(proposal.applicant)
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

    members.set(proposal.applicant, new Member(
      proposal.applicant, 
      proposal.sharesRequested, 
      u128.Zero, 
      u128.Zero, 
      proposal.lootRequested, 
      true, 
      0, 
      0, 
      Context.blockTimestamp, 
      Context.blockTimestamp, 
      true,
      new Array<communityRole>(),
      new Array<reputationFactor>()
      ))
   
    // add link from member to proposal
   

    let totalMembers = storage.getSome<u128>('totalMembers')
    totalMembers = u128.add(totalMembers, u128.from(1))
    storage.set('totalMembers', totalMembers)
   
    memberAddressByDelegatekey.set(proposal.applicant, proposal.applicant)
  }

  // mint new shares and loot
  let currentTotalShares = storage.getSome<u128>('totalShares')
  let newTotalShares = u128.add(currentTotalShares, proposal.sharesRequested)
  storage.set<u128>('totalShares', newTotalShares)
 
  let currentTotalLoot = storage.getSome<u128>('totalLoot')
  let newTotalLoot = u128.add(currentTotalLoot, proposal.lootRequested)
  storage.set<u128>('totalLoot', newTotalLoot)
 
  // if the proposal tribute is the first tokens of its kind to make it into the guild bank, increment total guild bank tokens
  if(u128.eq(TokenClass.get(GUILD, proposal.tributeToken), u128.Zero) && u128.gt(proposal.tributeOffered, u128.Zero)) {
    let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
    let newTotalGuildBankTokens = totalGuildBankTokens + 1
    storage.set('totalGuildBankTokens', newTotalGuildBankTokens)
  }
  
  // If commitment, move funds from bank to escrow
  if(proposal.flags[7]){
    _internalTransfer(GUILD, ESCROW, proposal.paymentToken, proposal.paymentRequested)
  }
  
  //make configuration changes if it's a configuration proposal
  if(proposal.flags[10]){      
    _setInit(
      <i32>parseInt(proposal.configuration[0]), //periodDuration
      <i32>parseInt(proposal.configuration[1]), //votingPeriodLength
      <i32>parseInt(proposal.configuration[2]), //gracePeriodLength
      u128.from(proposal.configuration[3]), //proposalDeposit
      <i32>parseInt(proposal.configuration[4]),  //dilutionBound
      <i32>parseInt(proposal.configuration[5]), //voteThreshold)
      u128.from(proposal.configuration[6]), // platformFeePercent
      <AccountId>(proposal.configuration[7]) // platformAccount
    )
  }

  //make role changes if it's a community role proposal
  if(proposal.flags[12]){
    if(proposal.roleConfiguration.action == 'add'){
      //get contract roles
      let contractRoles = roles.getSome(Context.contractName)
      assert(!contractRoles.getSome(proposal.roleConfiguration.roleName), 'role already exists, cannot add')
      contractRoles.set(proposal.roleConfiguration.roleName, proposal.roleConfiguration)
      roles.set(Context.contractName, contractRoles)
    }
    if(proposal.roleConfiguration.action == 'edit'){
      let currentCommunityRoles = roles.getSome(Context.contractName)
      currentCommunityRoles.set(proposal.roleConfiguration.roleName, proposal.roleConfiguration)
      roles.set(Context.contractName, currentCommunityRoles)
    }
    if(proposal.roleConfiguration.action == 'delete'){
      let contractRoles = roles.getSome(Context.contractName)
      assert(contractRoles.getSome(proposal.roleConfiguration.roleName), 'role does not exist, cannot delete')
      contractRoles.delete(proposal.roleConfiguration.roleName)
      roles.set(Context.contractName, contractRoles)
    }
  }

   //make reputation factor changes if it's a reputation factor proposal
   if(proposal.flags[13]){
    if(proposal.reputationConfiguration.action == 'add'){
      let contractRepFactors = reputationFactors.getSome(Context.contractName)
      assert(!contractRepFactors.getSome(proposal.reputationConfiguration.repFactorName), 'reputation factor already exists, cannot add')
      contractRepFactors.set(proposal.reputationConfiguration.repFactorName, proposal.reputationConfiguration)
      reputationFactors.set(Context.contractName, contractRepFactors)
    }
    if(proposal.reputationConfiguration.action == 'edit'){
      let currentCommunityRepFactors = reputationFactors.getSome(Context.contractName)
      currentCommunityRepFactors.set(proposal.reputationConfiguration.repFactorName, proposal.reputationConfiguration)
      reputationFactors.set(Context.contractName, currentCommunityRepFactors)
    }
    if(proposal.reputationConfiguration.action == 'delete'){
      let contractRepFactors = reputationFactors.getSome(Context.contractName)
      assert(contractRepFactors.getSome(proposal.reputationConfiguration.repFactorName), 'reputation factor does not exist, cannot delete')
      contractRepFactors.delete(proposal.reputationConfiguration.repFactorName)
      reputationFactors.set(Context.contractName, contractRepFactors)
    }
  }

   //assign, delete, modify member roles
   if(proposal.flags[14]){

    if(proposal.memberRoleConfiguration.action == 'assign'){
      let contractRoles = roles.getSome(Context.contractName)
      assert(contractRoles.getSome(proposal.memberRoleConfiguration.roleName), 'role does not exist, cannot add')
      let currentMemberRoles = memberRoles.getSome(proposal.applicant)
      assert(!currentMemberRoles.getSome(proposal.memberRoleConfiguration.roleName), 'member already has this role')
      currentMemberRoles.set(proposal.memberRoleConfiguration.roleName, proposal.memberRoleConfiguration)
      memberRoles.set(proposal.applicant, currentMemberRoles)
    }
    if(proposal.memberRoleConfiguration.action == 'update'){
      let currentMemberRoles = memberRoles.getSome(proposal.applicant)
      assert(currentMemberRoles.getSome(proposal.memberRoleConfiguration.roleName), 'member already has this role')
      currentMemberRoles.set(proposal.memberRoleConfiguration.roleName, proposal.memberRoleConfiguration)
      memberRoles.set(proposal.applicant, currentMemberRoles)
    }
    if(proposal.memberRoleConfiguration.action == 'unassign'){
      let currentMemberRoles = memberRoles.getSome(proposal.applicant)
      assert(currentMemberRoles.getSome(proposal.memberRoleConfiguration.roleName), 'member does not have this role')
      currentMemberRoles.delete(proposal.memberRoleConfiguration.roleName)
      memberRoles.set(proposal.applicant, currentMemberRoles)
    }
  }

  //give applicant the funds requested from escrow if not a commitment or tribute proposal less platform fee  
  if(!proposal.flags[7] && !proposal.flags[9]){ 
    if(u128.gt(proposal.paymentRequested, u128.Zero)){

    let platformAccount = storage.getSome<AccountId>('platformAccount')
    let payoutAmount = u128.sub(proposal.paymentRequested, platformPayment)
      
    // figure out if payout proposal is related to a funding commitment - if so, transfer from Escrow, otherwise from Fund
      if(proposal.referenceIds.length == 0){
        // not related to a funding commitment - take from GUILD
        
        assert(TokenClass.hasBalanceFor(GUILD, proposal.paymentToken, proposal.paymentRequested), ERR_INSUFFICIENT_BALANCE)
        if(u128.gt(platformPayment, u128.Zero)){
          let depositToken = storage.getSome<string>('depositToken')
          let platformTransfer = _sTRaw(platformPayment, depositToken, platformAccount)
        }
    
        let transferred = _sTRaw(payoutAmount, proposal.paymentToken, proposal.applicant)

        if(transferred) {
          TokenClass.subtractFromGuild(proposal.paymentToken, proposal.paymentRequested)
        }
      } else {
    
        // is related to a funding commitment - take from ESCROW
        assert(TokenClass.hasBalanceFor(ESCROW, proposal.paymentToken, proposal.paymentRequested), ERR_INSUFFICIENT_BALANCE)
        if(u128.gt(platformPayment, u128.Zero)){
          let depositToken = storage.getSome<string>('depositToken')
          let platformTransfer = _sTRaw(platformPayment, depositToken, platformAccount)
        }
        let transferred = _sTRaw(payoutAmount, proposal.paymentToken, proposal.applicant)
        if(transferred) {
          TokenClass.subtractFromEscrow(proposal.paymentToken, proposal.paymentRequested)
        }
      }
    }
  }

  //move tribute from escrow to bank
  _internalTransfer(ESCROW, GUILD, proposal.tributeToken, proposal.tributeOffered)

  // if the proposal spends 100% of guild bank balance for a token, decrement total guild bank tokens
  if(u128.eq(TokenClass.get(GUILD, proposal.paymentToken), u128.Zero) && u128.gt(proposal.paymentRequested, u128.Zero)) {
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
  if(!proposal.flags[7]){    
    // transfer user's contribution (tribute) back to them
    
    let withdrawn = _sTRaw(proposal.tributeOffered, proposal.tributeToken, proposal.proposer)

    if(withdrawn) {
      TokenClass.withdrawFromEscrow(proposal.proposer, proposal.tributeToken, proposal.tributeOffered)
    
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
 * @param amount (amount being transferred in yocto)
 * @param token (type of token)
 * @param account (where it's being transferred to)
*/
function _sTRaw(amount: u128, token: AccountId, account: AccountId): bool {
  assertValidId(account)

  // NEAR transfers
  if(token == storage.getSome<string>('depositToken')) {
      let transferred = _nearTransfer(amount, account)
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
 * returns platform account 
 * @returns platform account
 */
export function getPlatformAccount(): string | null {
  return storage.get<AccountId>("platformAccount", "none")
}


/**
 * returns platform percentage
 * @returns 
 */
export function getPlatformPercentage(): u128 | null {
  return storage.get<u128>("platformSupportPercent", u128.Zero)
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

  //set platform Percent
  let platformPercent = storage.getSome<u128>('platformSupportPercent')
 
  settings.push([
    summoner, 
    periodDuration.toString(), 
    votingPeriodLength.toString(),
    gracePeriodLength.toString(),
    proposalDeposit.toString(),
    dilutionBound.toString(),
    voteThreshold.toString(),
    summoningTime.toString(),
    platformPercent.toString()
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
  let neededVotes = u128.muldiv(totalShares, voteThreshold, u128.from('100'))
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
export function getCurrentPeriod(): u64 {
  let summonTime = storage.getSome<u64>('summoningTime') // blocktimestamp that dao was summoned
  let pd = storage.getSome<i32>('periodDuration') as u64 * 1000000000 // duration converted to nanoseconds for each period
  if(pd != 0) {
    let interim = Context.blockTimestamp - summonTime
    let result = interim / pd
    return result
  }
  return 0
}


/**
 * returns current set of proposal flags for given proposal
*/
export function getProposalFlags(proposalId: u32): bool[] {
  return proposals.getSome(proposalId).flags
}


/**
 * returns all balances for all tokens in the guild (community fund)
*/
export function getGuildTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  let approvedTokensLength = approvedTokens.length
  let i = 0
  while (i < approvedTokensLength) {
    let balance = TokenClass.get(GUILD, approvedTokens[i])
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
    let balance = TokenClass.get(ESCROW, approvedTokens[i])
    balances.push({token: approvedTokens[i], balance: balance})
    i++
  }
  return balances
}


/**
 * returns vote for a given memberaddress and proposal id - answers how someone voted on a certain proposal
*/
export function getMemberProposalVote(memberAddress: AccountId, proposalId: u32): string {
  let exists = accountVotes.contains(memberAddress)
  if (exists){
    let allMembersVotes = accountVotes.getSome(memberAddress)
    let vote = allMembersVotes.get(proposalId, 'no vote yet') as string
    if(vote != ''){
      return vote
    }
    return 'no vote yet'
  } else {
    // initiate vote tracking
    let newVote = new PersistentMap<u32, string>('uv' + memberAddress)
    newVote.set(0, '')
    accountVotes.set(memberAddress, newVote)
    return 'no vote yet'
  }
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
  // ensure to subtract any delegated shares before calculating
  let fairShare = _fairShare(TokenClass.get(GUILD, depositToken), u128.add(thisMember.shares, thisMember.loot), totalSharesAndLoot)
  return fairShare
}

/**
 * returns remaining available delegates
 * @param member 
 * @returns 
 */
export function getRemainingDelegates(member: AccountId): u32 {
  if(memberDelegations.contains(member)){
    let count = memberDelegations.getSome(member).size
    return MAX_DELEGATION_LIMIT - count
  } else {
    return MAX_DELEGATION_LIMIT
  }
}


/**
 * returns all votes for a given proposal
*/
export function getProposalVotes(proposalId: u32): Array<Votes> {
  let yV = proposals.getSome(proposalId).yesVotes
  let nV = proposals.getSome(proposalId).noVotes
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
 * returns current number of proposals 
*/
export function getProposalsLength(): u32 {
  return proposals.size
}

/**
 * Get all Donations (within limit specified by start/end)
 * @param start 
 * @param end 
 * @returns Array of Donations
 */
export function getDonations(start: i32, end: i32): Array<Donation> {
  assert (start >= 0 && end >= 0, "index ranges must be non negative")
  return contributions.values(start as u32, end as u32)
}

/**
 * returns current number of donations
*/
export function getDonationsLength(): u32 {
  return contributions.size
}

/**
 * returns the desired donation
*/
export function getDonation(donationId: u32): Donation {
  return contributions.getSome(donationId)
}


/**
 * returns the desired proposal
*/
export function getProposal(proposalId: u32): Proposal {
  return proposals.getSome(proposalId)
}


/**
 * returns delegation information for a given member
*/
export function getDelegationInfo(member: AccountId, delegatee: AccountId): DelegationInfo {
  let allMemberDelegations = memberDelegations.getSome(member)
  return allMemberDelegations.getSome(delegatee)
}


/*****************
PROPOSAL FUNCTIONS
*****************/

/**
 * Submit a Member proposal - used to join a community DAO and be issued voting or non-voting shares
 * @param applicant // applicant
 * @param sharesRequested // sharesRequested (voting shares)
 * @param lootRequested // lootRequested (non-voting shares)
 * @param tributeOffered // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tributeToken // tributeToken (type of token)
 * @param roleNames // rolenames of roles to add to member
 * @param contractId
*/
export function submitMemberProposal (
    applicant: AccountId,
    sharesRequested: u128,
    lootRequested: u128,
    tributeOffered: u128,
    tributeToken: AccountId,
    roleNames: Array<string>, 
    contractId: AccountId
): bool {
  assert(u128.le(u128.add(sharesRequested, lootRequested), u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT)), ERR_TOO_MANY_SHARES)
  assert(tokenWhiteList.getSome(tributeToken), ERR_NOT_WHITELISTED)
  assertValidApplicant(applicant)
  assert(members.get(applicant) == null, 'already a member')
  assert(_memberProposalPresent(applicant) == false, 'member proposal already in progress')

  if(members.contains(applicant)) {
    assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
  }
  
  if(u128.gt(tributeOffered, u128.Zero) && u128.eq(TokenClass.get(GUILD, tributeToken), u128.Zero)) {
    let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
    assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, ERR_FULL_GUILD_BANK)
  }

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let totalAmount = u128.add(proposalDeposit, tributeOffered)
  assert(u128.ge(Context.attachedDeposit, totalAmount), 'attached deposit not correct')

  let transferred = _sTRaw(totalAmount, tributeToken, contractId)

  if(transferred) {
    TokenClass.addToEscrow(predecessor(), tributeToken, tributeOffered)


    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
    flags[6] = true // member proposal

    let references = new Array<GenericObject>()
    let defaultObject = new GenericObject('','')
    references.push(defaultObject)
  
    _submitProposal(
      applicant, 
      sharesRequested, 
      lootRequested, 
      tributeOffered, 
      tributeToken, 
      u128.Zero, 
      '', 
      flags, 
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
 * Submit an Affiliation proposal - used to connect communities with other communities
 * @param affiliateWith // Community one is requesting to affiliate this community with
 * @param affiliationFee // Fee that is required to be affiliated with the other community
 * @param affiliationToken // token used for the affiliation payment if required
 * @param contractId
*/
export function submitAffiliationProposal (
  affiliateWith: AccountId,
  affiliationFee: u128,
  affiliationToken: AccountId,
  contractId: AccountId
): bool {
assert(tokenWhiteList.getSome(affiliationToken), ERR_NOT_WHITELISTED)
assertValidApplicant(affiliateWith)

let allAffiliations = affiliations.getSome(Context.contractName)
assert(allAffiliations.get(affiliateWith) == null, 'already affiliated')

assert(_affiliateProposalPresent(Context.contractName) == false, 'affiliation proposal already in progress')

// don't allow an affiliation with an accountId we already know has bad reputation
if(members.contains(affiliateWith)) {
  assert(members.getSome(affiliateWith).jailed == 0, ERR_JAILED)
}

// Funds transfers
let proposalDeposit = storage.getSome<u128>('proposalDeposit')
let totalAmount = u128.add(proposalDeposit, affiliationFee)
assert(u128.ge(Context.attachedDeposit, totalAmount), 'attached deposit not correct')

let transferred = _sTRaw(totalAmount, affiliationToken, contractId)

if(transferred) {
  TokenClass.addToEscrow(predecessor(), affiliationToken, totalAmount)

  let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
  flags[15] = true // affiliation proposal

  let references = new Array<GenericObject>()
  let defaultObject = new GenericObject('','')
  references.push(defaultObject)

  _submitProposal(
    affiliateWith, 
    u128.Zero, 
    u128.Zero, 
    affiliationFee, 
    affiliationToken, 
    u128.Zero, 
    '', 
    flags, 
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
 * Submit a Payout proposal - used to request payment for completed work as per an already approved funding commitment
 * @param applicant // applicant
 * @param paymentRequested // paymentRequested (amount of payment requested) - in yocto if NEAR
 * @param paymentToken // paymentToken (desired token for payment)
 * @param referenceIds // reference Ids
 * @param contractId
*/
export function submitPayoutProposal (
  applicant: AccountId,
  paymentRequested: u128,
  paymentToken: AccountId,
  referenceIds: Array<GenericObject>,
  contractId: AccountId
): bool {
assert(tokenWhiteList.getSome(paymentToken), ERR_NOT_WHITELISTED_PT)
assertValidApplicant(applicant)

if(members.contains(applicant)) {
  assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
}

// Funds transfers
let proposalDeposit = storage.getSome<u128>('proposalDeposit')
let depositToken = storage.getSome<string>('depositToken')
assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

let transferred = _sTRaw(proposalDeposit, depositToken, contractId)

if(transferred) {
  
  let flags = new Array<bool>(16) 
  flags[11] = true // payout proposal

  _submitProposal(
    applicant, 
    u128.Zero, 
    u128.Zero, 
    u128.Zero, 
    '', 
    paymentRequested, 
    paymentToken, 
    flags, 
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
 * @param applicant // applicant
 * @param sharesRequested // sharesRequested (voting shares)
 * @param tributeOffered // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tributeToken // tributeToken (type of token)
 * @param contractId
*/
export function submitTributeProposal (
  applicant: AccountId,
  sharesRequested: u128,
  tributeOffered: u128,
  tributeToken: AccountId,
  contractId: AccountId
): bool {
assert(u128.le(sharesRequested, u128.from(MAX_NUMBER_OF_SHARES_AND_LOOT)), ERR_TOO_MANY_SHARES)
assert(tokenWhiteList.getSome(tributeToken), ERR_NOT_WHITELISTED)
assertValidApplicant(applicant)
if(members.contains(applicant)) {
  assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
}

if(u128.gt(tributeOffered, u128.Zero) && u128.eq(TokenClass.get(GUILD, tributeToken), u128.Zero)) {
  let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
  assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, ERR_FULL_GUILD_BANK)
}

// Funds transfers
let proposalDeposit = storage.getSome<u128>('proposalDeposit')
let totalContribution = u128.add(proposalDeposit, tributeOffered)
assert(u128.ge(Context.attachedDeposit, totalContribution), 'attached deposit not correct')

let transferred = _sTRaw(totalContribution, tributeToken, contractId)

if(transferred) {
  TokenClass.addToEscrow(applicant, tributeToken, tributeOffered)

  let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
  flags[9] = true // tribute proposal

  let references = new Array<GenericObject>()
  let defaultObject = new GenericObject('','')
  references.push(defaultObject)

  _submitProposal(
    applicant, 
    sharesRequested, 
    u128.Zero, 
    tributeOffered, 
    tributeToken, 
    u128.Zero, 
    '', 
    flags, 
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
  assertValidApplicant(applicant)
  assert(u128.gt(paymentRequested, u128.Zero), 'funding request must be greater than zero')
  
  if(members.contains(applicant)) {
    assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
  }

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred) {
    let flags = new Array<bool>(16) // [submitted, sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole]
    flags[7] = true // commitment

    _submitProposal(
      applicant, 
      u128.Zero, 
      u128.Zero, 
      u128.Zero, 
      '', 
      paymentRequested, 
      paymentToken, 
      flags, 
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
  assertValidApplicant(applicant)
 
  if(members.contains(applicant)) {
    assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
  }

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred) {
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
    flags[10] = true // configuration

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
      flags, 
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
  applicant: AccountId,
  contractId: AccountId
  ): bool {
  assertValidApplicant(applicant)
 
  if(members.contains(applicant)) {
    assert(members.getSome(applicant).jailed == 0, ERR_JAILED)
  }

 
  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred) {
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
    flags[8] = true // opportunity

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
      flags, 
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
    assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

    let transferred = _sTRaw(proposalDeposit, depositToken, contractId)

    if(transferred) {
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
    flags[5] = true; // guild kick
    
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
      flags, 
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
  assertValidId(tokenToWhitelist)
  assert(!tokenWhiteList.getSome(tokenToWhitelist), ERR_ALREADY_WHITELISTED)
  assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_WHITELISTED)

  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
    flags[4] = true; // whitelist
    
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
      flags, 
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
  assertValidId(contractId)
  
  // Funds transfers (Proposal Deposit)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration,  payout, communityRole, reputationFactor, assignRole,]
    flags[12] = true; // communityRole

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
      flags, 
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
  assertValidId(contractId)
  
  // Funds transfers (Proposal Deposit)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration,  payout, communityRole, reputationFactor, assignRole,]
    flags[14] = true; // assignRole

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
      flags, 
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
  assertValidId(contractId)
  
  // Funds transfers (Proposal Deposit)
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  let depositToken = storage.getSome<string>('depositToken')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)  

  if(transferred){
    let flags = new Array<bool>(16) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, payout, communityRole, reputationFactor, assignRole, affiliation]
    flags[13] = true; // reputationFactor

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
      flags, 
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
 * @param applicant // applicant
 * @param sharesRequested // sharesRequested (voting shares)
 * @param lootRequested // lootRequested (non-voting shares)
 * @param tributeOffered // tributeOffered (contribution to the community fund - 1 for 1 for voting shares if deposit token)
 * @param tributeToken // tributeToken (type of token)
 * @param paymentRequested // paymentRequested (amount of payment requested) - in yocto if NEAR
 * @param paymentToken // paymentToken (desired token for payment)
 * @param flags // flags [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, roleConfiguration, reputationConfiguration]
 * @param roleNames
 * @param configuration
 * @param roleConfiguration
 * @param reputationConfiguration
*/
function _submitProposal(
  applicant: AccountId,
  sharesRequested: u128,
  lootRequested: u128,
  tributeOffered: u128,
  tributeToken: AccountId,
  paymentRequested: u128,
  paymentToken: AccountId,
  flags: Array<bool>,
  roleNames: Array<string>,
  configuration: Array<string>,
  roleConfiguration: communityRole,
  reputationConfiguration: reputationFactor,
  memberRoleConfiguration: communityRole,
  referenceIds: Array<GenericObject>
): bool {
  let proposalId = proposals.size
  proposals.set(proposalId, new Proposal(
    proposalId, // proposal Id
    applicant, // applicant
    predecessor(), // proposer
    '', // sponsor
    sharesRequested, // sharesRequested
    lootRequested, // lootRequested
    tributeOffered, // tributeOffered
    tributeToken, // tributeToken
    paymentRequested, // paymentRequested
    paymentToken, // paymentToken
    0, // startingPeriod
    u128.Zero, // yesVotes
    u128.Zero, // noVotes
    flags, // flags: [sponsored, processed, didPass, cancelled, whitelist, guildkick, member, commitment, opportunity, tribute, configuration, roleConfiguration, reputationConfiguration]
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

  let newVote = new PersistentMap<u32, string>('uv' + predecessor())
  newVote.set(proposalId, '')
  accountVotes.set(predecessor(), newVote)

  if(flags[6]){
    memberProposals.set(applicant, 'yes')
  }
  
  return true
}


/**
 * Sponsor proposal - moves the proposal into the voting period.  Is done by a member once enough detail/discussion has taken place to facilitate voting.
 * @param proposalId // proposal index used to find the proposal
 * @param depositToken
 * @param contractId
*/
export function sponsorProposal(
  proposalId: u32, 
  depositToken: AccountId, 
  contractId: AccountId
  ): bool {
 
  assert(onlyDelegate(predecessor()), 'not a delegate')

  let proposal = proposals.getSome(proposalId)

  assertValidId(proposal.proposer)
  assert(!proposal.flags[0], 'already sponsored')
  assert(!proposal.flags[3], 'proposal cancelled')

  // if a commitment proposal, ensure the funding commitment request could be fulfilled - 
  // i.e., is less than what is in the community fund
  if(proposal.flags[7]) {
    //get guild token balances
    let balance = TokenClass.get(GUILD, proposal.paymentToken)
    assert(u128.le(proposal.paymentRequested, balance), 'potential commitment must be less than what is in the community fund')
  }

  // collect proposal deposit from sponsor and store it in the contract until the proposal is processed
  // Funds transfers
  let proposalDeposit = storage.getSome<u128>('proposalDeposit')
  assert(u128.ge(Context.attachedDeposit, proposalDeposit), 'attached deposit not correct')

  let transferred = _sTRaw(proposalDeposit, depositToken, contractId)

  if(transferred) {

    if(members.contains(proposal.applicant)){
      assert(members.getSome(proposal.applicant).jailed == 0, 'member jailed')
    }

    if(u128.gt(proposal.tributeOffered, u128.Zero) && u128.eq(TokenClass.get(GUILD, proposal.tributeToken), u128.Zero)) {
      let totalGuildBankTokens = storage.getSome<i32>('totalGuildBankTokens')
      assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, 'guild bank full')
    }
  
    // Whitelist proposal
    if(proposal.flags[4]) {
      assert(!tokenWhiteList.getSome(proposal.tributeToken), 'already whitelisted')
      assert(!proposedToWhiteList.getSome(proposal.tributeToken), 'whitelist proposed already')
      assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, 'can not sponsor more')
      proposedToWhiteList.set(proposal.tributeToken, true)
    }

    //Guild Kick Proposal
    if (proposal.flags[5]) {
      assert(!proposedToKick.getSome(proposal.applicant), 'already proposed to kick')
      proposedToKick.set(proposal.applicant, true)
    }

    // compute starting period for proposal
    let comparison: u64 = 0
    if(proposals.size == 0){
      comparison = 0
    }
    if(proposals.size == 1){
      let exists = proposals.containsKey(proposalId)
      if(exists){
        let prevProposalStartTime = proposals.getSome(proposalId)
        if(prevProposalStartTime.startingPeriod > 0){
          comparison = prevProposalStartTime.startingPeriod
          } else {
            comparison = getCurrentPeriod()
          }
      }
    }
    if(proposals.size > 1){
      let exists = proposals.containsKey(proposalId-1)
      if(exists){
        let prevProposalStartTime = proposals.getSome(proposalId-1)
        if(prevProposalStartTime.startingPeriod > 0){
        comparison = prevProposalStartTime.startingPeriod
        } else {
          comparison = getCurrentPeriod()
        }
      }
    }
    
    let max = _max(getCurrentPeriod(), comparison)
    let startingPeriod = (max) as u64
    // let votingPeriod = startingPeriod + storage.getSome<i32>('votingPeriodLength') as u64 
    // let gracePeriod = votingPeriod + storage.getSome<i32>('gracePeriodLength') as u64 
    let votingPeriod = startingPeriod // voting starts immediately after being sponsored
    let gracePeriod = (votingPeriod + storage.getSome<i32>('votingPeriodLength')) as u64 // start of voting period plus its length

    let memberAddress = memberAddressByDelegatekey.getSome(predecessor())

    let flags = proposal.flags //
    flags[0] = true //sponsored

    proposal.flags = flags
    proposal.startingPeriod = startingPeriod
    proposal.sponsor = memberAddress
    proposal.votingPeriod = votingPeriod
    proposal.gracePeriod = gracePeriod
    
    proposals.set(proposal.proposalId, proposal)

    return true
  }
  return false
}


/**
 * Submit Vote - the voting mechanism(s) that determine whether a proposal passes or not
 * @param proposalId // proposal id
 * @param vote // yes or no
*/
export function submitVote(proposalId: u32, vote: string): bool {

  assert(onlyDelegate(predecessor()), ERR_NOT_DELEGATE)

  // ensures voting address has voting shares
  let memberAddress = memberAddressByDelegatekey.getSome(predecessor())
  let member = members.getSome(memberAddress)

  // check that proposal exists by finding it's index in the proposal vector
  assert(proposals.containsKey(proposalId), ERR_PROPOSAL_NO)
  let proposal = proposals.getSome(proposalId)

  // ensure it's a valid vote and that we are still in the voting period (between start and end times)
  assert(vote == 'yes' || vote=='no', ERR_VOTE_INVALID)
  assert(getCurrentPeriod() >= proposal.startingPeriod, ERR_VOTING_NOT_STARTED)
  assert(getCurrentPeriod() <= proposal.gracePeriod, ERR_VOTING_PERIOD_EXPIRED)

  // check to see if this member has already voted
  let existingVote = getMemberProposalVote(predecessor(), proposalId)
  assert(existingVote == 'no vote yet', ERR_ALREADY_VOTED)
 
  let newVote = new PersistentMap<u32, string>('uv' + predecessor())
  newVote.set(proposalId, vote)
  accountVotes.set(predecessor(), newVote)

  if(vote == 'yes') {
    let allVotingShares = u128.add(member.shares, member.receivedDelegations)
    let newYesVotes = u128.add(proposal.yesVotes, u128.sub(allVotingShares, member.delegatedShares))

    //set highest index (latest) yes vote - must be processed for member to ragequit
    if(proposal.proposalId > <u32>member.highestIndexYesVote) {
      member.highestIndexYesVote = proposal.proposalId
      members.set(memberAddress, member)
    }

    // set maximum of total shares encountered at a yes vote - used to bound dilution for yes voters. The dilution bound exists to 
    // prevent share based overpayment resulting from mass ragequit, and thus takes loot into account when calculating the anticipated dilution
    let newMaxTotalSharesAndLootAtYesVote: u128 // maxtotalsharesandlootatyesvote
    let totalShares = storage.getSome<u128>('totalShares')
    let totalLoot = storage.getSome<u128>('totalLoot')

    if(u128.gt(u128.add(totalShares, totalLoot), proposal.maxTotalSharesAndLootAtYesVote)) {
      newMaxTotalSharesAndLootAtYesVote = u128.add(totalShares, totalLoot)
    } else {
      newMaxTotalSharesAndLootAtYesVote = proposal.maxTotalSharesAndLootAtYesVote
    }
    proposal.yesVotes = newYesVotes
    proposal.maxTotalSharesAndLootAtYesVote = newMaxTotalSharesAndLootAtYesVote
    proposals.set(proposal.proposalId, proposal)
  }
  
  if (vote == 'no') {
    let allVotingShares = u128.add(member.shares, member.receivedDelegations)
    let newnV = u128.add(proposal.noVotes, u128.sub(allVotingShares, member.delegatedShares))
    proposal.noVotes = newnV
    proposals.set(proposal.proposalId, proposal) 
  }

  // if total vote after this vote is processed either for or against satisfies voting decision for pass/fail, then push proposal into
  // grace period.  Prevents a proposal from sitting in voting longer than necessary when the vote has already been decided.
  let updatedProposal = proposals.getSome(proposalId)
  let voteDecided = _bypass(updatedProposal)
  if(voteDecided){
    updatedProposal.gracePeriod = getCurrentPeriod() // start graceperiod in next period
    updatedProposal.voteFinalized = Context.blockTimestamp
    proposals.set(updatedProposal.proposalId, updatedProposal)
  }

  return true
}

/**
 * Process proposal - process a proposal that has gone through the voting period and return deposit to sponsor and proposer
 * @param proposalId // proposal index used to find the proposal
*/
export function processProposal(proposalId: u32, platformPayment: u128): bool {

  // check to make sure the proposal is ready for processing
  let proposal = proposals.getSome(proposalId)

  assert(_votingPeriodPassed(proposal), 'not ready for processing')
  
  // check to see if it's a whitelist proposal
  if(proposal.flags[4]) {
    processWhitelistProposal(proposal.proposalId)
    return true
  }

  // check to see if it's a guildkick proposal
  if(proposal.flags[5]){
    processGuildKickProposal(proposal.proposalId)
    return true
  }

  // another check to see that it's not a special proposal (not guildkick or whitelist)
  assert(!proposal.flags[4] && !proposal.flags[5], ERR_STANDARD_PROPOSAL)

  // mark proposal as processed
  let flags = proposal.flags
  flags[1] = true //processed
  proposal.flags = flags
  proposals.set(proposal.proposalId, proposal)

  // get outcome of the vote
  let didPass = _didPass(proposal)
 
  if(didPass){
    _proposalPassed(proposal, platformPayment)
  } else {
    _proposalFailed(proposal)
  }

  _returnDeposit(proposal.sponsor)
  _returnDeposit(proposal.proposer)

  return true
}


/**
 * Process WhiteList proposal - process a whitelist proposal that has gone through the voting period and return deposit to sponsor and proposer
 * @param proposalId // proposal index used to find the proposal
*/
function processWhitelistProposal(proposalId: u32): void {
  let proposal = proposals.getSome(proposalId)

  assert(_votingPeriodPassed(proposal), 'not ready for processing')

  assert(proposal.flags[4], ERR_WHITELIST_PROPOSAL)

  // mark as processed
  let flags = proposal.flags
  flags[1] = true; //processed
  proposal.flags = flags
  proposals.set(proposal.proposalId, proposal)

  let didPass = _didPass(proposal)

  if(approvedTokens.length >= MAX_TOKEN_WHITELIST_COUNT) {
    didPass = false
  }

  if (didPass) {
    // mark as passed
    let flags = proposal.flags
    flags[2] = true //didPass
    proposal.flags = flags
    proposals.set(proposal.proposalId, proposal)

    tokenWhiteList.set(proposal.tributeToken, true)
    approvedTokens.push(proposal.tributeToken)
  }

  proposedToWhiteList.set(proposal.tributeToken, false)
 
  _returnDeposit(proposal.sponsor)
  _returnDeposit(proposal.proposer)
  
}


/**
 * Process GuildKick proposal - process a guildkick proposal that has gone through the voting period and return deposit to sponsor and proposer
 * @param proposalId // proposal index used to find the proposal
*/
function processGuildKickProposal(proposalId: u32): void {

  let proposal = proposals.getSome(proposalId)

  assert(_votingPeriodPassed(proposal), 'not ready for processing')
 
  assert(proposal.flags[5], ERR_GUILD_PROPOSAL)

  //assign proposal 'processed' flag
  let flags = proposal.flags //
  flags[1] = true //processed
  proposal.flags = flags
  proposals.set(proposal.proposalId, proposal)

  let didPass = _didPass(proposal)

  if(didPass) {
  
    //assign proposal 'didPass' flag
    let flags = proposal.flags
    flags[2] = true //didPass
    proposal.flags = flags
    proposals.set(proposal.proposalId, proposal)

    let member = members.getSome(proposal.applicant)

    // reverse any existing share delegations
    let allThisMembersDelegations = memberDelegations.getSome(proposal.applicant)
     let i: u32 = 0
     while (i < allThisMembersDelegations.size) {
      let dKey = allThisMembersDelegations.min()
      let delegation = allThisMembersDelegations.getSome(dKey)
      let delegatedOwner = members.getSome(delegation.delegatedTo) // get original owner to give delegations back to
      delegatedOwner.delegatedShares = u128.sub(delegatedOwner.delegatedShares, delegation.shares) // reduce delegated shares by amount that was delegated
      members.set(delegatedOwner.delegateKey, delegatedOwner) // update delegated member
      allThisMembersDelegations.delete(dKey)
      i++
    }

    memberDelegations.set(proposal.applicant, allThisMembersDelegations) // update kicked member's delegation tracking

    let updateMember = new Member(
      member.delegateKey,
      u128.Zero, // revoke all shares
      u128.Zero, // revoke all delegations
      u128.Zero, // revoke all received delegations
      u128.add(member.loot, member.shares), //transfer shares to loot
      true,
      member.highestIndexYesVote,
      proposal.proposalId,
      member.joined,
      Context.blockTimestamp,
      false,
      member.roles,
      member.reputation
      )

    members.set(proposal.applicant, updateMember)
     
    //transfer shares to loot
    let currentTotalShares = storage.getSome<u128>('totalShares')
    let newTotalShares = u128.sub(currentTotalShares, member.shares)
    storage.set<u128>('totalShares', newTotalShares)
    
    let currentTotalLoot = storage.getSome<u128>('totalLoot')
    let newTotalLoot = u128.add(currentTotalLoot, member.shares)
    storage.set<u128>('totalLoot', newTotalLoot)
  }

  proposedToKick.set(proposal.applicant, false)

  _returnDeposit(proposal.sponsor)
  _returnDeposit(proposal.proposer)

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
export function leave(contractId: AccountId, accountId: AccountId, share: u128, availableBalance: u128, appOwner: AccountId): boolean {
  assertValidId(accountId)
  assertValidId(appOwner)
 
  assert(accountId == predecessor(), 'only the account owner can leave the community')
 
  let depositToken = storage.getSome<string>('depositToken')
  
  let totalMembers = getTotalMembers()
  
  if(u128.eq(totalMembers, u128.from('1'))){
    // if last member, transfer remaining available contract balance to last member
    // use _sTRaw as remaining will be in yocto
    let transfer = _sTRaw(availableBalance, depositToken, accountId)
  } else {
    let fairShare = getCurrentShare(accountId)
    assert(u128.le(share, fairShare), 'asking to withdraw more than fair share of the fund')
    // transfer user's fairShare back to them
    let withdrawn = _sTRaw(share, depositToken, accountId)
    if(withdrawn) {
      TokenClass.withdrawFromGuild(predecessor(), depositToken, share)
    }
    // make donation if applicable
    if(u128.gt(u128.sub(fairShare, share), u128.Zero)){
      makeDonation(contractId, accountId, depositToken, u128.sub(fairShare, share))
    }
  }
  //retrieve member and make necessary changes
  let member = members.getSome(accountId)

  // remove shares from total shares
  let currentTotalShares = storage.getSome<u128>('totalShares')
  let newTotalShares = u128.sub(currentTotalShares, member.shares)
  storage.set<u128>('totalShares', newTotalShares)

  // remove loot from total loot
  let currentTotalLoot = storage.getSome<u128>('totalLoot')
  let newTotalLoot = u128.sub(currentTotalLoot, member.loot)
  storage.set<u128>('totalLoot', newTotalLoot)

  assert(_undelegateAll(predecessor()), 'problem restoring vote delegations')
  // delegation info is now empty (all delegations returned to owners) - thus delete the delegation info if it exists
  if(memberDelegations.contains(predecessor())){
    memberDelegations.delete(predecessor())
  }
  // delete member
  members.delete(accountId)
  storage.set<u128>('totalMembers', u128.sub(totalMembers, u128.from('1')))
    
  return true
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
  assertValidId(delegateTo)
  assert(u128.gt(quantity, u128.Zero), 'no share quantity specified')
  assert(predecessor() == Context.sender, 'sender is not predecessor')

  //get current number of shares of person attempting to delegate
  let member = members.getSome(predecessor())
  assert(u128.ge(member.shares, quantity), 'member does not have enough shares to delegate')
 
  //obtain predecessor()'s map of vectors of existing delegations or start a new one
  if(memberDelegations.contains(predecessor())){
    let existingDelegations = memberDelegations.getSome(predecessor())
    // check for max delegation limit
    assert(existingDelegations.size < MAX_DELEGATION_LIMIT, 'max delegation limit hit')
    let delegateeInfo = existingDelegations.get(delegateTo)
    if(delegateeInfo != null){
      let newDelegation = new DelegationInfo(delegateTo, u128.add(delegateeInfo.shares, quantity))
      existingDelegations.set(delegateTo, newDelegation)
    } else {
      let newDelegation = new DelegationInfo(delegateTo, quantity)
      existingDelegations.set(delegateTo, newDelegation)
    }
    memberDelegations.set(predecessor(), existingDelegations)

    if(receivedDelegations.contains(delegateTo)){
      let existingReceivedDelegations = receivedDelegations.getSome(delegateTo)
      let currentShares = existingReceivedDelegations.getSome(predecessor())
      existingReceivedDelegations.set(predecessor(), u128.add(currentShares, quantity))
      receivedDelegations.set(delegateTo, existingReceivedDelegations)
    } else {
      let newReceivedDelegations = new AVLTree<AccountId, u128>('rdg'+delegateTo)
      newReceivedDelegations.set(predecessor(), quantity)
      receivedDelegations.set(delegateTo, newReceivedDelegations)
    }
    // add quantity shares to member's delegatedShares - used to reduce member's voting power 
    member.delegatedShares = u128.add(member.delegatedShares, quantity)
    members.set(predecessor(), member)

    // add quantity shares to the member receivedDelegations - tracks shares delegated to a member
    let delegate = members.getSome(delegateTo)
    delegate.receivedDelegations = u128.add(delegate.receivedDelegations, quantity)
    members.set(delegateTo, delegate)
    
  } else {
    let existingDelegations = new AVLTree<string, DelegationInfo>('ed'+predecessor())
    let newDelegation = new DelegationInfo(delegateTo, quantity)
    existingDelegations.set(delegateTo, newDelegation)
    memberDelegations.set(predecessor(), existingDelegations)
    let newReceivedDelegations = new AVLTree<AccountId, u128>('rdg'+delegateTo)
    newReceivedDelegations.set(predecessor(), quantity)
    receivedDelegations.set(delegateTo, newReceivedDelegations)
    // add quantity shares to member's delegatedShares - used to reduce member's voting power 
    member.delegatedShares = u128.add(member.delegatedShares, quantity)
    members.set(predecessor(), member)
   
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
  assertValidId(delegateFrom)
  assert(u128.gt(quantity, u128.Zero), 'quantity must be greater than zero')

  // get user's current delegations
  if(memberDelegations.contains(predecessor())){
    let delegations = memberDelegations.getSome(predecessor())
    let delegatedTo = delegations.getSome(delegateFrom)
    assert(u128.gt(delegatedTo.shares, u128.Zero), 'member has no delegations')
    assert(u128.le(quantity, delegatedTo.shares), 'not enough shares delegated, lower quantity')
    let member = members.getSome(predecessor())
    member.delegatedShares = u128.sub(member.delegatedShares, quantity)
    members.set(predecessor(), member)

    delegatedTo.shares = u128.sub(delegatedTo.shares, quantity)
   
    delegations.set(delegateFrom, delegatedTo)
    
    if(delegations && delegations.size > 0){
      memberDelegations.set(predecessor(), delegations)
    } else {
      memberDelegations.delete(predecessor())
    }
    let delegatedMember = members.getSome(delegateFrom)
    delegatedMember.receivedDelegations = u128.sub(delegatedMember.receivedDelegations, quantity)
    members.set(delegateFrom, delegatedMember)
  }

  if(receivedDelegations.contains(delegateFrom)){
    let received = receivedDelegations.getSome(delegateFrom)
    let thisReceived = received.getSome(predecessor())
    let newQuantity = u128.sub(thisReceived, quantity)
    received.set(predecessor(), newQuantity)
    if(received && received.size > 0){
      receivedDelegations.set(delegateFrom, received)
    } else {
      receivedDelegations.delete(delegateFrom)
    }
  }
  
  return true
}


/**
 * Undelegate - function that lets a member take back all the votes they had previously delegated
 * to another member
 * @param delegateFrom
 * @param quantity
*/
function _undelegateAll(currentAccount: AccountId): boolean {
  assertValidId(currentAccount)

  // get user's current received delegations
  if(!receivedDelegations.contains(currentAccount)){
    // are no delegations so exit
    return true
  } else {
  let currentUserReceivedDelegations = receivedDelegations.getSome(currentAccount)
  let min = currentUserReceivedDelegations.min()
  let max = currentUserReceivedDelegations.max()
  let entries = currentUserReceivedDelegations.keys(min, max, true)
  let i = 0
  while (i < entries.length){
    //get account and amount delegated to it to return to owner
      let shares = currentUserReceivedDelegations.getSome(entries[i])
      let member = members.getSome(currentAccount)
      member.receivedDelegations = u128.sub(member.receivedDelegations, shares)
      members.set(currentAccount, member)
      let receivedFrom = members.getSome(entries[i])
      receivedFrom.delegatedShares = u128.sub(receivedFrom.delegatedShares, shares)
      members.set(entries[i], receivedFrom)
      i++
    }
    receivedDelegations.delete(currentAccount)
  }

  // delete received delegations from this user from everyone else
  // first, find out who this account delegated to
  if(memberDelegations.contains(currentAccount)){
    let delegations = memberDelegations.getSome(currentAccount)
    if(delegations.size == 0){
      return true
    }

    let min = delegations.min()
    let max = delegations.max()
    let entries = delegations.keys(min, max, true)
    let j = 0
    while (j < entries.length){
      let member = members.getSome(currentAccount)
      let shares = delegations.getSome(entries[j]).shares
      member.delegatedShares = u128.sub(member.delegatedShares, shares)
      members.set(currentAccount, member)
      let delegated = members.getSome(entries[j])
      delegated.receivedDelegations = u128.sub(delegated.receivedDelegations, shares)
      members.set(entries[j], delegated)
      j++
    }
    memberDelegations.delete(currentAccount)
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

  assert(onlyShareholder(predecessor()), ERR_NOT_SHAREHOLDER)
  assertValidId(newDelegateKey)

  if(newDelegateKey != predecessor()) {
    assert(!members.getSome(newDelegateKey).existing, ERR_NO_OVERWRITE_MEMBER)
    assert(!members.getSome(memberAddressByDelegatekey.getSome(newDelegateKey)).existing, ERR_NO_OVERWRITE_KEY)
  }

  let member = members.getSome(predecessor())
  memberAddressByDelegatekey.set(member.delegateKey, '')
  memberAddressByDelegatekey.set(newDelegateKey, predecessor())
  member.delegateKey = newDelegateKey

  members.set(member.delegateKey, member)
  return true
}