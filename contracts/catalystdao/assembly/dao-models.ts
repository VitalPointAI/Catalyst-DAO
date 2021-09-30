import { u128, AVLTree, PersistentMap, PersistentVector, PersistentUnorderedMap, logging } from 'near-sdk-as'
import { ERR_INSUFFICIENT_BALANCE, ERR_NOT_A_MEMBER, ERR_NOT_DELEGATE } from './dao-error-messages'
import { AccountId, GUILD, ESCROW, TOTAL } from './dao-types'
import { isPositive } from './utils'

export type RoleName = string
export type ContractId = string
export type ReputationFactorName = string
export type DonationId = u32
export type ProposalId = u32
export type Vote = string
export type Delegatee = string
export type Shares = i32
export type TokenName = string
export type Balance = u128

// Data Storage
/**donation Id to donations*/
export const contributions = new AVLTree<DonationId, Donation>('d')
/** proposal Id to proposal */
export const proposals = new AVLTree<ProposalId, Proposal>('p')
/** member to proposal to votes */
export const userVotes = new PersistentUnorderedMap<ProposalId, Vote>('uv')
export const votesByMember = new PersistentMap<AccountId, UserVoteMap>('v')
/** maps account to its Member model */
export const members = new PersistentMap<string, Member>('m') 
/** Maps account name to memberProposal */
export const memberProposals = new PersistentUnorderedMap<AccountId, Proposal>('mp')
// Roles Structures
/** roles assigned to member - member to roleName to role */
export const memberRoles = new PersistentUnorderedMap<AccountId, AVLTree<RoleName, communityRole>>('mr') 
/** roles defined by the community - map contractId to roleName to communityRole */
export const roles = new PersistentUnorderedMap<ContractId, AVLTree<RoleName, communityRole>>('c')
// Reputation Structures
/** roles assigned to member - member to roleName to role */
export const memberRepFactors = new PersistentUnorderedMap<AccountId, AVLTree<ReputationFactorName, reputationFactor>>('rf') 
/** reputation factors defined by the community - map contractId to repfactorname to reputationFactor */
export const reputationFactors = new PersistentUnorderedMap<ContractId, AVLTree<ReputationFactorName, reputationFactor>>('crf') 
/** map person delegating to delegation info */
export const memberDelegations = new PersistentMap<AccountId, DelegateeMap>('md')
/** maps token name to whether it is whitelisted or not */
export const tokenWhiteList = new PersistentMap<string, bool>('tw') 
/** maps token name to whether it has been proposed for white listing or not */
export const proposedToWhiteList = new PersistentMap<string, bool>('pw') 
/** maps user account to whether it has been proposed to kick or not */
export const proposedToKick = new PersistentMap<string, bool>('pk') 
/** maps account to delegate key */
export const memberAddressByDelegatekey = new PersistentMap<string, string>('md')
/** array of approvedtokens */
export const approvedTokens = new PersistentVector<AccountId>('a')
/** Map delegatee to shares */
export type DelegateeMap = AVLTree<Delegatee, DelegationInfo>
/** Maps proposalId to votes */
export type UserVoteMap = PersistentUnorderedMap<ProposalId, Vote>
/** Maps token name to balance */
//export type TokenBalanceMap = PersistentUnorderedMap<TokenName, Balance>
export const tokenBalances = new PersistentUnorderedMap<AccountId, PersistentMap<TokenName, Balance>>('tob')


@nearBindgen
export class TokenAccounting {
    constructor(
        
    ) {}

    private getTokenMap(account: AccountId, token: TokenName, balance: Balance = u128.Zero): PersistentMap<string, u128> {
        let exists = tokenBalances.contains(account)
        if (exists) {
            return tokenBalances.getSome(account)
            
        } else {
            let newTokenBalanceMap = new PersistentMap<string, u128>('tb' + account)
            newTokenBalanceMap.set(token, balance)
            return newTokenBalanceMap
        }
    }

    /** Sets a users balance for a token and creates inner map if not present. */
    add(account: AccountId, token: TokenName, balance: Balance = u128.Zero): void {
    let tokenMap = this.getTokenMap(account, token, balance);
    tokenMap.set(token, u128.add(tokenMap.get(token, u128.Zero) as u128, balance));
    tokenBalances.set(account, tokenMap);
    }

    sub(account: AccountId, token: TokenName, balance: Balance): void {
    let tokenMap = this.getTokenMap(account, token, balance);
    tokenMap.set(token, u128.sub(tokenMap.get(token, u128.Zero) as u128, balance));
    tokenBalances.set(account, tokenMap);
    }

    get(account: AccountId, token: TokenName): u128 {
    let tokenMap = tokenBalances.getSome(account);
    if (tokenMap == null) return u128.Zero;
    // Need the as below to tell the IDE that it won't return null
    return tokenMap.get(token, u128.Zero) as u128;
    }

    addContribution(account: AccountId, token: TokenName, balance: Balance): void {
    this.add(account, token, balance);
    this.add(GUILD, token, balance);
    this.add(TOTAL, token, balance);
    }

    transfer(from: AccountId, to: AccountId, token: string, balance: Balance): void {
    this.assertBalance(from, token, balance);
    this.sub(from, token, balance);
    this.add(to, token, balance);
    }

    hasBalanceFor(account: AccountId, token: TokenName, balance: Balance): boolean {
    const fromBalance = this.get(account, token);
    return u128.gt(fromBalance, balance) as boolean;
    }

    assertBalance(account: AccountId, token: TokenName, balance: Balance): void {
    assert(this.hasBalanceFor(account, token, balance), ERR_INSUFFICIENT_BALANCE)
    }

    exists(account: AccountId, token: TokenName): boolean {
    return u128.gt(this.get(account, token), u128.Zero) as boolean;
    }

    isZero(account: AccountId, token: TokenName): boolean {
    return !this.exists(account, token);
    }

    withdrawFromGuild(account: AccountId, token: TokenName, balance: Balance): void {
    this.sub(GUILD, token, balance);
    this.withdrawFromTotal(account, token, balance);
    }

    withdrawFromEscrow(account: AccountId, token: TokenName, balance: Balance): void {
    this.sub(ESCROW, token, balance);
    this.withdrawFromTotal(account, token, balance);
    }

    subtractFromEscrow(token: TokenName, balance: Balance): void {
    this.sub(ESCROW, token, balance);
    this.sub(TOTAL, token, balance);
    }

    withdrawFromTotal(account: AccountId, token: TokenName, balance:u128): void {
    this.sub(account, token, balance);
    this.sub(TOTAL, token, balance);
    }  

    addToEscrow(account: AccountId, token: TokenName, balance: Balance): void {
    this.add(account, token, balance);
    this.add(ESCROW, token, balance);
    this.add(TOTAL, token, balance);
    }

    addToGuild(token: TokenName, balance: Balance): void {
    this.add(GUILD, token, balance);
    this.add(TOTAL, token, balance);
    }
}

@nearBindgen
export class Votes {
    yes: u128;
    no: u128;
}

@nearBindgen
export class TokenBalanceMap {
    constructor(
        public token: string,
        public balance: u128
    )
    {}
}

@nearBindgen
export class UserVote {
    constructor(
        public proposalId: i32,
        public vote: string
    ){}
}

@nearBindgen
export class DelegationInfo {
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
    public roles: AVLTree<string, communityRole>, 
    /** reputation factors that currently make up member's reputation score */
    public reputation: AVLTree<string, reputationFactor>,
    )
    {}

    static getStatus(accountId: string): boolean {
        // bool is 0 | 1, boolean is false | true
        // contains returns bool so cast it to boolean to be able to return it.
        return members.contains(accountId) as boolean;
    }
  
    static get(accountId: string): Member {
        const member = members.get(accountId)
        assert(member!=null, ERR_NOT_A_MEMBER)
        // Need type assertion to make ts happy and not have runtime check for null
        return member as Member
    }

    static getDelegate(accountId: string): Member {
        assert(memberAddressByDelegatekey.contains(accountId), ERR_NOT_DELEGATE)
        return Member.get(accountId)
    }

    static getLoot(accountId: string): u128 {
        if (!members.contains(accountId)){
            return u128.Zero;
        }
        return this.get(accountId).loot;
    }

    static getShares(accountId: string): u128 {
        if (!members.contains(accountId)){
            return u128.Zero;
        }
        return this.get(accountId).shares;
    }

    hasShares(): boolean {
        return isPositive(this.shares)
    }

    hasLoot(): boolean {
        return isPositive(this.loot)
    }
}

@nearBindgen
export class Proposal {
  constructor(
    /** proposalId: frontend generated id to link record to proposal details */
    public proposalId: u32,
    /** applicant: the applicant who wishes to become a member - this key will be used for withdrawals (doubles as guild kick target for gkick proposals) */
    public applicant: AccountId,
    /** proposer: the account that submitted the proposal (can be non-member) */
    public proposer: AccountId,
    /** sponsor: the member that sponsored the proposal (moving it into the queue for voting and processing) */
    public sponsor: AccountId,
    /** sharesRequested: the # of shares the applicant is requesting */
    public sharesRequested: u128,
    /** lootRequested: the amount of loot the applicant is requesting */
    public lootRequested: u128,
    /** tributeOffered: amount of tokens offered as tribute */
    public tributeOffered: u128,
    /** tributeToken: tribute token contract reference (type of tribute token) */
    public tributeToken: AccountId,
    /** paymentRequested: amount of tokens requested as payment */
    public paymentRequested: u128,
    /** paymentToken: payment token contract reference (type of payment token) */
    public paymentToken: AccountId,
    /** startingPeriod: the period in which voting can start for this proposal */
    public startingPeriod: i32,
    /** yesVotes: the total number of YES votes for this proposal */
    public yesVotes: u128,
    /** noVotes: the total number of NO votes for this proposal */
    public noVotes: u128,
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
    public flags: Array<bool>, 
    /** the maximum # of total shares and loot encountered at a yes vote on this proposal */
    public maxTotalSharesAndLootAtYesVote: u128,
    /** proposalSubmitted: blockindex when proposal was submitted */
    public proposalSubmitted: u64,
    /** voting period */
    public votingPeriod: i32,
    /** grace period */
    public gracePeriod: i32,
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
