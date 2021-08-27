import { u128, PersistentMap, PersistentVector } from 'near-sdk-as'
import { AccountId } from './dao-types'

// Data Storage
/** maps user to token to amount */
export const userTokenBalances = new PersistentVector<userTokenBalanceInfo>('u') 
/** maps user to proposal to vote on that proposal */
export const votesByMember = new PersistentVector<UserVote>('v') 
/** maps token name to whether it is whitelisted or not */
export const tokenWhiteList = new PersistentMap<string, bool>('tw') 
/** maps token name to whether it has been proposed for white listing or not */
export const proposedToWhiteList = new PersistentMap<string, bool>('pw') 
/** maps user account to whether it has been proposed to kick or not */
export const proposedToKick = new PersistentMap<string, bool>('pk') 
/** maps account to its Member model */
export const members = new PersistentMap<string, Member>('m') 
/** maps account to delegate key */
export const memberAddressByDelegatekey = new PersistentMap<string, string>('md') 
/** array of proposals - use vector as provides index and length */
export const proposals = new PersistentVector<Proposal>('p') 
/**array of donations - use vector as provides index and length */
export const contributions = new PersistentVector<Donation>('d') 
/** array of approvedtokens */
export const approvedTokens = new PersistentVector<AccountId>('a') 
/** map person delegating to delegation info */
export const delegation = new PersistentMap<string, PersistentVector<delegationInfo>>('di') 

// Roles Structures
/** roles assigned to member */
export const memberRoles = new PersistentMap<string, Array<communityRole>>('mr') 
/** roles defined by the community */
export const roles = new PersistentMap<string, Array<communityRole>>('c') 

// Reputation Structures
/** member reputation factors */
export const memberReputationFactors = new PersistentMap<string, Array<reputationFactor>>('mrf') 
/** reputation factors defined by the community */
export const reputationFactors = new PersistentMap<string, Array<reputationFactor>>('crf') 

@nearBindgen
export class Votes {
    yes: u128;
    no: u128;
}

@nearBindgen
export class UserVote {
    user: string;
    pI: i32;
    vote: string;
}

@nearBindgen
export class userTokenBalanceInfo {
    user: string;
    token: string;
    balance: u128;
}

@nearBindgen
export class delegationInfo {
    constructor(
        public delegatedTo: string,
        public shares: u128
    ) {}
}

@nearBindgen
export class TokenBalances {
    token: string;
    balance: u128;
}

@nearBindgen
export class Donation {
    contributor: string;
    donation: u128;
    contributed: u64;
    donationId: i32;
}

@nearBindgen
export class GenericObject {
    constructor(
        public keyName: string,
        public valueSetting: string
    ){}
}

@nearBindgen
export class communityRole {
  constructor(
    /** name of role */
    public roleName: string,
    /** any reward associated with holding the role */
    public roleReward: u128,
    /** start blocktimestamp of the role (1 block is ~ 1 second). */
    public roleStart: u64,
    /** end blocktimestamp of the role, 0 means never ending */
    public roleEnd: u64,
    /** specific permissions this role has - probably list of method names */
    public rolePermissions: Array<string>,
    /** role specific settings that we currently don't know about - like NFT token Ids (badges) */
    public roleParticulars: Array<string>,
    /** describes the role */
    public roleDescription: string,
    /** add, update, delete, nil - actions used when proposal passes */
    public action: string,
  ){}

}

@nearBindgen
export class reputationFactor {
  constructor(
    /** name of reputation factor */
    public repFactorName: string,
    /** points associated with the rep factor */
    public repFactorPoints: u128,
    /** when rep factor stops (measured in blocks where 1 block is ~ 1 second). */
    public repFactorStart: u64,
    /** when rep factor stops (measured in blocks where 1 block is ~ 1 second). 0 means forever.  Suggest rep factor can diminish over time (or get stronger) */
    public repFactorEnd: u64,
    /** describes the reputation factor */
    public repFactorDescription: string,
    /** miscellaneous array for additional specifications as needed */
    public repFactorFactors: Array<string>,
    /** array of method names that trigger the reputation action */
    public repFactorActions: Array<string>,
    /** add, update, delete, nil - actions used when proposal passes */
    public action: string,

    )
    {}
}

@nearBindgen
export class Member {
  constructor(
    /** the key responsible for submitting proposals and voting - defaults to member address unless updated */
    public delegateKey: string,
    /** the # of voting shares assigned to this member */
    public shares: u128,
    /** shares that have been delegated to other members */
    public delegatedShares: u128,
    /** shares that have been delegated to this member */
    public receivedDelegations: u128,
    /** the loot amount available to this member (combined with shares on ragequit) */
    public loot: u128,
    /** always true once a member has been created */
    public existing: bool,
    /** highest proposal index # on which the member voted YES */
    public highestIndexYesVote: i32,
    /** set to proposalIndex of a passing guild kick proposal for this member, prevents voting on and sponsoring proposals */
    public jailed: i32,
    /** timestamp of when became a member of the dao */
    public joined: u64,
    /** timestamp of when member info was last updated */
    public updated: u64,
    /** is member currently active in the community (true) or have they left (false) */
    public active: bool,
    /** community roles member currently has */
    public roles: Array<communityRole>, 
    /** reputation factors that currently make up member's reputation score */
    public reputation: Array<reputationFactor>,
    )
    {}
}

@nearBindgen
export class Proposal {
  constructor(
    /** proposalId: frontend generated id to link record to proposal details */
    public pI: i32,
    /** applicant: the applicant who wishes to become a member - this key will be used for withdrawals (doubles as guild kick target for gkick proposals) */
    public a: AccountId,
    /** proposer: the account that submitted the proposal (can be non-member) */
    public p: AccountId,
    /** sponsor: the member that sponsored the proposal (moving it into the queue for voting and processing) */
    public s: AccountId,
    /** sharesRequested: the # of shares the applicant is requesting */
    public sR: u128,
    /** lootRequested: the amount of loot the applicant is requesting */
    public lR: u128,
    /** tributeOffered: amount of tokens offered as tribute */
    public tO: u128,
    /** tributeToken: tribute token contract reference (type of tribute token) */
    public tT: AccountId,
    /** paymentRequested: amount of tokens requested as payment */
    public pR: u128,
    /** paymentToken: payment token contract reference (type of payment token) */
    public pT: AccountId,
    /** startingPeriod: the period in which voting can start for this proposal */
    public sP: i32,
    /** yesVotes: the total number of YES votes for this proposal */
    public yV: u128,
    /** noVotes: the total number of NO votes for this proposal */
    public nV: u128,
    /* flags [
                            0: sponsored, 
                            1: processed, 
                            2: didPass, 
                            3: cancelled, 
                            4: whitelist, 
                            5: guildkick, 
                            6: member, 
                            7: commitment, 
                            8: opportunity, 
                            9: tribute, 
                            10: configuration, 
                            11: payout, 
                            12: communityRole, 
                            13: reputationFactor, 
                            14: assignRole
                        ]
                        */
    public f: Array<bool>, 
    /** the maximum # of total shares and loot encountered at a yes vote on this proposal */
    public mT: u128,
    /** proposalSubmitted: blockindex when proposal was submitted */
    public pS: u64,
    /** voting period */
    public vP: i32,
    /** grace period */
    public gP: i32,
    /** roles to assign to member */
    public roleNames: Array<string>,
    /** block timestamp of when vote was finalized */
    public voteFinalized: u64,
    /** [periodDuration, votingPeriodLength, gracePeriodLength, proposalDeposit, dilutionBound] */
    public configuration: Array<string>,
    /** configuration changes to existing/add new roles */
    public roleConfiguration: communityRole,
    /** configuration changes to existing/add new reputation factors */
    public reputationConfiguration: reputationFactor,
    /** member specific configuration changes to existing roles  */
    public memberRoleConfiguration: communityRole,
    /** array of objects that correspond to other information such as proposals that this proposal references */
    public referenceIds: Array<GenericObject>,
    )
    {}
}