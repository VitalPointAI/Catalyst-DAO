//@nearBindgen

const DEBUG = false;

import { Context, u128, PersistentDeque, PersistentVector, logging } from "near-sdk-as";
import { memberAddressByDelegatekey } from "./dao-models";

// ----------------------------------------------------------------------------
// this file contains models representing events emitted by the contract
// ----------------------------------------------------------------------------

/**
 *
 * Summon Complete
 * MUST trigger when summon completes.
 *
 * A summon contract that summons new DAO should trigger summonComplete event
 *
 * event SummonComplete(address indexed summoner, address[] tokens, uint256 summoningTime, uint256 periodDuration, uint256 votingPeriodLength, uint256 gracePeriodLength, uint256 proposalDeposit, uint256 dilutionBound, uint256 processingReward)
 *
 */

@nearBindgen
export class SummonCompleteEvent {
  summoner: string;
  tokens: Array<string>;
  summoningTime: u64;
  periodDuration: i32;
  votingPeriodLength: i32;
  gracePeriodLength: i32;
  proposalDeposit: u128;
  dilutionBound: i32;
}

// setup a queue for summon complete events
export const summonCompleteEvents = new PersistentDeque<SummonCompleteEvent>("sc");

/**
 * This function records summon complete events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param summoner
 * @param tokens
 * @param summoningTime
 * @param periodDuration
 * @param votingPeriodLength
 * @param gracePeriodLength
 * @param proposalDeposit
 * @param dilutionBound
 */
export function summonCompleteEvent(summoner: string, tokens: Array<string>, summoningTime: u64, periodDuration: i32, votingPeriodLength:i32, gracePeriodLength: i32, proposalDeposit: u128, dilutionBound: i32): void {
  DEBUG ? logging.log("[call] summonCompleteEvent(" + summoner + ", " + tokens.toString() + ", " + summoningTime.toString() + ", " + periodDuration.toString() + ")") : false;
  const summon = new SummonCompleteEvent();
  summon.summoner = summoner;
  summon.tokens = tokens;
  summon.summoningTime = summoningTime;
  summon.periodDuration = periodDuration;
  summon.votingPeriodLength = votingPeriodLength;
  summon.gracePeriodLength = gracePeriodLength;
  summon.proposalDeposit = proposalDeposit;
  summon.dilutionBound = dilutionBound;
  summonCompleteEvents.pushFront(summon);
}

/**
 *
 * DAO Update
 * MUST trigger when DAO settings are changed
 *
 */

@nearBindgen
export class DaoUpdateEvent {
  summoner: string;
  updated: u64;
  periodDuration: i32;
  votingPeriodLength: i32;
  gracePeriodLength: i32;
  proposalDeposit: u128;
  dilutionBound: i32;
}

// setup a queue for summon complete events
export const daoUpdateEvents = new PersistentDeque<DaoUpdateEvent>("du");

/**
 * This function records summon complete events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param summoner
 * @param updated
 * @param periodDuration
 * @param votingPeriodLength
 * @param gracePeriodLength
 * @param proposalDeposit
 * @param dilutionBound
 */
export function daoUpdateEvent(summoner: string, updated: u64, periodDuration: i32, votingPeriodLength:i32, gracePeriodLength: i32, proposalDeposit: u128, dilutionBound: i32): void {
  DEBUG ? logging.log("[call] daoUpdateEvent(" + summoner + ", " + updated.toString() + ", " + periodDuration.toString() + ")") : false;
  const update = new DaoUpdateEvent();
  update.summoner = summoner;
  update.updated = updated;
  update.periodDuration = periodDuration;
  update.votingPeriodLength = votingPeriodLength;
  update.gracePeriodLength = gracePeriodLength;
  update.proposalDeposit = proposalDeposit;
  update.dilutionBound = dilutionBound;
  daoUpdateEvents.pushFront(update);
}



/**
 *
 * Submit Proposal
 * MUST trigger when proposal is submitted.
 *
 *
 * event SubmitProposal(address indexed applicant, uint256 sharesRequested, uint256 lootRequested, uint256 tributeOffered, address tributeToken, uint256 paymentRequested, address paymentToken, string details, bool[6] flags, uint256 proposalId, address indexed delegateKey, address indexed memberAddress)
 *
 */

@nearBindgen
export class SPE {
  pI: i32;
  a: string;
  p: string;
  s: string;
  sR: u128;
  lR: u128;
  tO: u128;
  tT: string;
  pR: u128;
  pT: string;
  f: Array<bool>;
  dK: string;
  mA: string;
  pS: u64;
  vP: i32;
  gP: i32;
  sP: i32;
  yV: u128;
  nV: u128;
  voteFinalized: u64;

  constructor(
    pI: i32,
    a: string,
    p: string,
    s: string,
    sR: u128,
    lR: u128,
    tO: u128,
    tT: string,
    pR: u128,
    pT: string,
    f: Array<bool>,
    dK: string,
    mA: string,
    pS: u64,
    vP: i32,
    gP: i32,
    sP: i32,
    yV: u128,
    nV: u128,
    voteFinalized: u64
    
  ){
    this.pI = pI
    this.a = a
    this.p = p
    this.s = s
    this.sR = sR
    this.lR = lR
    this.tO = tO
    this.tT = tT
    this.pR = pR
    this.pT = pT
    this.f = f
    this.dK = dK
    this.mA = mA
    this.pS = pS
    this.vP = vP
    this.gP = gP
    this.sP = sP
    this.yV = yV
    this.nV = nV
    this.voteFinalized = voteFinalized
  }
}

// setup a queue for summon complete events
export const submitProposalEvents = new PersistentVector<SPE>("pe");

/**
 * This function records submit proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param proposalIdentifier //pI
 * @param applicant // a
 * @param proposer // p
 * @param sponsor //s
 * @param sharesRequested //sR
 * @param lootRequested //lR
 * @param tributeOffered //tO
 * @param tributeToken //tT
 * @param paymentRequested //pR
 * @param paymentToken //pT
 * @param flags / f
 * @param delegateKey //dK
 * @param memberAddress //mA
 * @param proposalSubmission //pS
 * @param votingPeriod //vP
 * @param gracePeriod //gP
 * @param yesVote //yV
 * @param noVote /nV
 * @param startingPeriod // sP
 * @param voteFinalized
 */
export function sPE(pI: i32, a: string, p: string, s: string, sR: u128, lR: u128, tO: u128, tT: string, pR: u128, pT: string, f: Array<bool>, dK: string, mA: string, pS: u64, vP: i32, gP: i32, sP: i32, yV: u128, nV: u128, voteFinalized: u64): void {
  DEBUG ? logging.log("[call] submitProposalEvent(" + a + ", " + sR.toString() + ", " + lR.toString() + ", " + tO.toString() + ")") : false;
  submitProposalEvents.push(new SPE(
    pI,
    a,
    p,
    s,
    sR,
    lR,
    tO,
    tT,
    pR,
    pT,
    f,
    dK,
    mA,
    pS,
    vP,
    gP,
    sP,
    yV,
    nV,
    voteFinalized
  ));
}

/**
 *
 * Sponsor Proposal
 * MUST trigger when proposal is sponsored
 *
 * event SponsorProposal(address indexed delegateKey, address indexed memberAddress, uint256 proposalId, uint256 proposalIndex, uint256 startingPeriod);
 *
 */

@nearBindgen
export class SponsorProposalEvent {
  delegateKey: string;
  memberAddress: string;
  proposalId: i32;
  startingPeriod: i32;
}

// setup a queue for summon complete events
export const sponsorProposalEvents = new PersistentDeque<SponsorProposalEvent>("sp");

/**
 * This function records sponsor proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param delegateKey
 * @param memberAddress
 * @param proposalId
 * @param startingPeriod
 */
export function sponsorProposalEvent(delegateKey: string, memberAddress: string, proposalId: i32, startingPeriod: i32): void {
  DEBUG ? logging.log("[call] sponsorProposalEvent(" + delegateKey + ", " + memberAddress + ", " + proposalId.toString() + ", " + ")") : false;
  const spProposal = new SponsorProposalEvent();
  spProposal.delegateKey = delegateKey;
  spProposal.memberAddress = memberAddress;
  spProposal.proposalId = proposalId;
  spProposal.startingPeriod = startingPeriod;
  sponsorProposalEvents.pushFront(spProposal);
}

/**
 *
 * Submit Vote
 * MUST trigger when vote is submitted
 *
 * event SubmitVote(uint256 proposalId, uint256 indexed proposalIndex, address indexed delegateKey, address indexed memberAddress, uint8 uintVote);
 *
 */

@nearBindgen
export class SubmitVoteEvent {
  proposalIdentifier: i32;
  delegateKey: string;
  memberAddress: string;
  vote: string;
}

// setup a queue for summon complete events
export const submitVoteEvents = new PersistentDeque<SubmitVoteEvent>("sv");

/**
 * This function records submit vote events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param proposalId
 * @param delegateKey
 * @param memberAddress
 * @param vote
 */
export function submitVoteEvent(proposalIdentifier: i32, delegateKey: string, memberAddress: string, vote: string): void {
  DEBUG ? logging.log("[call] submitVoteEvent(" + proposalIdentifier.toString() + ", " + ", " + delegateKey + ", " + memberAddress + ")") : false;
  const vote1 = new SubmitVoteEvent();
  vote1.proposalIdentifier = proposalIdentifier;
  vote1.delegateKey = delegateKey;
  vote1.memberAddress = memberAddress;
  vote1.vote = vote;
  submitVoteEvents.pushFront(vote1);
}

/**
 *
 * Process Proposal
 * MUST trigger when proposal is processed
 *
 * event ProcessProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
 *
 */

@nearBindgen
export class ProcessProposalEvent {
  proposalIndex: i32;
  didPass: bool;
}

// setup a queue for summon complete events
export const processProposalEvents = new PersistentDeque<ProcessProposalEvent>("pp");

/**
 * This function records process proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param proposalIndex
 * @param didPass
 */
export function processProposalEvent(proposalIndex: i32, didPass: bool): void {
  DEBUG ? logging.log("[call] processProposalEvent(" + proposalIndex.toString() + ", " + ", " + didPass.toString() + "") : false;
  const proposal = new ProcessProposalEvent();
  proposal.proposalIndex = proposalIndex;
  proposal.didPass = didPass;
  processProposalEvents.pushFront(proposal);
}

/**
 *
 * Process WhiteList Proposal
 * MUST trigger when white list proposal is processed
 *
 * event ProcessWhitelistProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
 *
 */

@nearBindgen
export class ProcessWhiteListProposalEvent {
  proposalIndex: i32;
  proposalId: i32;
  didPass: bool;
}

// setup a queue for summon complete events
export const processWhiteListProposalEvents = new PersistentDeque<ProcessWhiteListProposalEvent>("pwl");

/**
 * This function records process white list proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param proposalIndex
 * @param proposalId
 * @param didPass
 */
export function processWhiteListProposalEvent(proposalIndex: i32, proposalId: i32, didPass: bool): void {
  DEBUG ? logging.log("[call] processWhiteListProposalEvent(" + proposalIndex.toString() + ", " + proposalId.toString() + ", " + didPass.toString() + "") : false;
  const proposal = new ProcessWhiteListProposalEvent();
  proposal.proposalIndex = proposalIndex;
  proposal.proposalId = proposalId;
  proposal.didPass = didPass;
  processWhiteListProposalEvents.pushFront(proposal);
}

/**
 *
 * Process Guild Kick Proposal
 * MUST trigger when guild kick proposal is processed
 *
 * event ProcessGuildKickProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
 *
 */

@nearBindgen
export class ProcessGuildKickProposalEvent {
  proposalIndex: i32;
  didPass: bool;
}

// setup a queue for summon complete events
export const processGuildKickProposalEvents = new PersistentDeque<ProcessGuildKickProposalEvent>("gk");

/**
 * This function records process guild kick proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param proposalIndex
 * @param proposalId
 * @param didPass
 */
export function processGuildKickProposalEvent(proposalIndex: i32, didPass: bool): void {
  DEBUG ? logging.log("[call] processGuildKickProposalEvent(" + proposalIndex.toString() + ", " + ", " + didPass.toString() + "") : false;
  const proposal = new ProcessGuildKickProposalEvent();
  proposal.proposalIndex = proposalIndex;
  proposal.didPass = didPass;
  processGuildKickProposalEvents.pushFront(proposal);
}

/**
 *
 * Rage Quit
 * MUST trigger when rage quit occurs
 *
 * event Ragequit(address indexed memberAddress, uint256 sharesToBurn, uint256 lootToBurn);
 *
 */

@nearBindgen
export class RageQuitEvent {
  memberAddress: string;
  sharesToBurn: u128;
  lootToBurn: u128;
}

// setup a queue for summon complete events
export const rageQuitEvents = new PersistentDeque<RageQuitEvent>("rq");

/**
 * This function records process guild kick proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param memberAddress
 * @param sharesToBurn
 * @param lootToBurn
 */
export function rageQuitEvent(memberAddress: string, sharesToBurn: u128, lootToBurn: u128): void {
  DEBUG ? logging.log("[call] rageQuitEvent(" + memberAddress + ", " + sharesToBurn.toString() + ", " + lootToBurn.toString() + "") : false;
  const rage = new RageQuitEvent();
  rage.memberAddress = memberAddress;
  rage.sharesToBurn = sharesToBurn;
  rage.lootToBurn = lootToBurn;
  rageQuitEvents.pushFront(rage);
}

/**
 *
 * Tokens Collected
 * MUST trigger when token collection occurs
 *
 * event TokensCollected(address indexed token, uint256 amountToCollect);
 *
 */

@nearBindgen
export class TokensCollectedEvent {
  token: string;
  amountToCollect: u128;
}

// setup a queue for summon complete events
export const tokensCollectedEvents = new PersistentDeque<TokensCollectedEvent>("tc");

/**
 * This function records tokens collected events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param token
 * @param amountToCollect
 */
export function tokensCollectedEvent(token: string, amountToCollect: u128): void {
  DEBUG ? logging.log("[call] tokensCollectedEvent(" + token + ", " + amountToCollect.toString() + "") : false;
  const collection = new TokensCollectedEvent();
  collection.token = token;
  collection.amountToCollect = amountToCollect;
  tokensCollectedEvents.pushFront(collection);
}

/**
 *
 * Cancel Proposal
 * MUST trigger when a proposal is cancelled
 *
 * event CancelProposal(uint256 indexed proposalId, address applicantAddress);
 *
 */

@nearBindgen
export class CancelProposalEvent {
  proposalId: i32;
  applicantAddress: string;
}

// setup a queue for summon complete events
export const cancelProposalEvents = new PersistentDeque<CancelProposalEvent>("cp");

/**
 * This function records cancel proposal events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param proposalId
 * @param applicantAddress
 */
export function cancelProposalEvent(proposalId: i32, applicantAddress: string): void {
  DEBUG ? logging.log("[call] cancelProposalEvent(" + proposalId.toString() + ", " + applicantAddress + "") : false;
  const proposal = new CancelProposalEvent();
  proposal.proposalId = proposalId;
  proposal.applicantAddress = applicantAddress;
  cancelProposalEvents.pushFront(proposal);
}

/**
 *
 * Update Delegate Key
 * MUST trigger when a delegate key is updated
 *
 * event UpdateDelegateKey(address indexed memberAddress, address newDelegateKey);
 *
 */

@nearBindgen
export class UpdateDelegateKeyEvent {
  memberAddress: string;
  newDelegateKey: string;
}

// setup a queue for summon complete events
export const updateDelegateKeyEvents = new PersistentDeque<UpdateDelegateKeyEvent>("udk");

/**
 * This function records update delegate key events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param memberAddress
 * @param newDelegateKey
 */
export function updateDelegateKeyEvent(memberAddress: string, newDelegateKey: string): void {
  DEBUG ? logging.log("[call] updateDelegateKeyEvent(" + memberAddress + ", " + newDelegateKey + "") : false;
  const update = new UpdateDelegateKeyEvent();
  update.memberAddress = memberAddress;
  update.newDelegateKey = newDelegateKey;
  updateDelegateKeyEvents.pushFront(update);
}

/**
 *
 * Withdrawl
 * MUST trigger when a withdrawl is made
 *
 * event Withdraw(address indexed memberAddress, address token, uint256 amount);
 *
 */

@nearBindgen
export class WithdrawlEvent {
  memberAddress: string;
  token: string;
  amount: u128;
}

// setup a queue for withdrawl events
export const withdrawlEvents = new PersistentDeque<WithdrawlEvent>("w");

/**
 * This function records wtihdrawl events since NEAR doesn't currently support
 * an event model on-chain
 *
 * @param memberAddress
 * @param token
 * @param amount
 */
export function withdrawlEvent(memberAddress: string, token: string, amount: u128): void {
  DEBUG ? logging.log("[call] withdrawlEvent(" + memberAddress + ", " + token + ", " + amount.toString() + "") : false;
  const withdrawl = new WithdrawlEvent();
  withdrawl.memberAddress = memberAddress;
  withdrawl.token = token;
  withdrawl.amount = amount;
  withdrawlEvents.pushFront(withdrawl);
}