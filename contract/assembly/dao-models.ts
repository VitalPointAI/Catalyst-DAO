import { u128, PersistentMap, PersistentVector } from 'near-sdk-as'
import { AccountId } from './dao-types'

// Data Storage
export const userTokenBalances = new PersistentVector<userTokenBalanceInfo>('u') //maps user to token to amount
export const votesByMember = new PersistentVector<UserVote>('v') // maps user to proposal to vote on that proposal
export const tokenWhiteList = new PersistentMap<string, bool>('tw') // maps token name to whether it is whitelisted or not
export const proposedToWhiteList = new PersistentMap<string, bool>('pw') // maps token name to whether it has been proposed for white listing or not
export const proposedToKick = new PersistentMap<string, bool>('pk') // maps user account to whether it has been proposed to kick or not
export const members = new PersistentMap<string, Member>('m') // maps account to its Member model
export const memberAddressByDelegatekey = new PersistentMap<string, string>('md') // maps account to delegate key
export const proposals = new PersistentVector<Proposal>('p') // array of proposals - use vector as provides index and length
export const contributions = new PersistentVector<Donation>('d') //array of donations - use vector as provides index and length
export const approvedTokens = new PersistentVector<AccountId>('a') // array of approvedtokens
export const delegation = new PersistentMap<string, PersistentVector<delegationInfo>>('di') // map person delegating to delegation info

// Roles Structures
export const memberRoles = new PersistentMap<string, Array<communityRole>>('mr') // roles assigned to member
export const roles = new PersistentMap<string, Array<communityRole>>('c') // roles defined by the community

// Reputation Structures
export const memberReputationFactors = new PersistentMap<string, Array<reputationFactor>>('mrf') // member reputation factors
export const reputationFactors = new PersistentMap<string, Array<reputationFactor>>('crf') // reputation factors defined by the community

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
    delegatedTo: string;
    shares: u128;

    constructor(
        delegatedTo: string,
        shares: u128
    ) {
        this.delegatedTo = delegatedTo;
        this.shares = shares;
    }
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
    keyName: string;
    valueSetting: string;

    constructor(
        keyName: string,
        valueSetting: string
    )
    {
        this.keyName = keyName;
        this.valueSetting = valueSetting;
    }
}

@nearBindgen
export class communityRole {
    roleName: string; // name of role
    roleReward: u128; // any reward associated with holding the role
    roleStart: u64; // start blocktimestamp of the role (1 block is ~ 1 second).
    roleEnd: u64; // end blocktimestamp of the role, 0 means never ending
    rolePermissions: Array<string>; // specific permissions this role has - probably list of method names
    roleParticulars: Array<string>; // role specific settings that we currently don't know about - like NFT token Ids (badges)
    roleDescription: string; // describes the role
    action: string; // add, update, delete, nil - actions used when proposal passes

    constructor(
        roleName: string,
        roleReward: u128,
        roleStart: u64,
        roleEnd: u64,
        rolePermissions: Array<string>,
        roleParticulars: Array<string>,
        roleDescription: string,
        action: string
    )
    {
        this.roleName = roleName;
        this.roleReward = roleReward;
        this.roleStart = roleStart;
        this.roleEnd = roleEnd;
        this.rolePermissions = rolePermissions;
        this.roleParticulars = roleParticulars;
        this.roleDescription = roleDescription;
        this.action = action
    }
}

@nearBindgen
export class reputationFactor {
    repFactorName: string; // name of reputation factor
    repFactorPoints: u128; // points associated with the rep factor
    repFactorStart: u64;// when rep factor stops (measured in blocks where 1 block is ~ 1 second).
    repFactorEnd: u64 // when rep factor stops (measured in blocks where 1 block is ~ 1 second). 0 means forever.  Suggest rep factor can diminish over time (or get stronger)
    repFactorDescription: string; // describes the reputation factor
    repFactorFactors: Array<string>; // miscellaneous array for additional specifications as needed
    repFactorActions: Array<string>; // array of method names that trigger the reputation action
    action: string; // add, update, delete, nil - actions used when proposal passes

    constructor(
        repFactorName: string,
        repFactorPoints: u128,
        repFactorStart: u64,
        repFactorEnd: u64,
        repFactorDescription: string,
        repFactorFactors: Array<string>,
        repFactorActions: Array<string>,
        action: string
    )
    {
        this.repFactorName = repFactorName;
        this.repFactorPoints = repFactorPoints;
        this.repFactorStart = repFactorStart;
        this.repFactorEnd = repFactorEnd;
        this.repFactorDescription = repFactorDescription;
        this.repFactorFactors = repFactorFactors;
        this.repFactorActions = repFactorActions;
        this.action = action
    }
}

@nearBindgen
export class Member {
    delegateKey: string; // the key responsible for submitting proposals and voting - defaults to member address unless updated
    shares: u128; // the # of voting shares assigned to this member
    delegatedShares: u128; // shares that have been delegated to other members
    receivedDelegations: u128; // shares that have been delegated to this member
    loot: u128; // the loot amount available to this member (combined with shares on ragequit)
    existing: bool; // always true once a member has been created
    highestIndexYesVote: i32; // highest proposal index # on which the member voted YES
    jailed: i32; // set to proposalIndex of a passing guild kick proposal for this member, prevents voting on and sponsoring proposals
    joined: u64; // timestamp of when became a member of the dao
    updated: u64; // timestamp of when member info was last updated
    active: bool; // is member currently active in the community (true) or have they left (false)
    roles: Array<communityRole>; //community roles member currently has
    reputation: Array<reputationFactor>; //reputation factors that currently make up member's reputation score

    constructor(
        delegateKey: string,
        shares: u128,
        delegatedShares: u128,
        receivedDelegations: u128,
        loot: u128,
        existing: bool,
        highestIndexYesVote: i32,
        jailed: i32,
        joined: u64,
        updated: u64,
        active: bool,
        roles: Array<communityRole>,
        reputation: Array<reputationFactor>
    )
    {
        this.delegateKey = delegateKey;
        this.shares = shares;
        this.delegatedShares = delegatedShares;
        this.receivedDelegations = receivedDelegations;
        this.loot = loot;
        this.existing = existing;
        this.highestIndexYesVote = highestIndexYesVote;
        this.jailed = jailed;
        this.joined = joined;
        this.updated = updated;
        this.active = active;
        this.roles = roles;
        this.reputation = reputation;
    }
}

@nearBindgen
export class Proposal {
    pI: i32; // proposalId: frontend generated id to link record to proposal details
    a: AccountId; // applicant: the applicant who wishes to become a member - this key will be used for withdrawals (doubles as guild kick target for gkick proposals)
    p: AccountId; // proposer: the account that submitted the proposal (can be non-member)
    s: AccountId; // sponsor: the member that sponsored the proposal (moving it into the queue for voting and processing)
    sR: u128; // sharesRequested: the # of shares the applicant is requesting
    lR: u128; // lootRequested: the amount of loot the applicant is requesting
    tO: u128; // tributeOffered: amount of tokens offered as tribute
    tT: AccountId; // tributeToken: tribute token contract reference (type of tribute token)
    pR: u128; // paymentRequested: amount of tokens requested as payment
    pT: AccountId; // paymentToken: payment token contract reference (type of payment token)
    sP: i32; // startingPeriod: the period in which voting can start for this proposal
    yV: u128; // yesVotes: the total number of YES votes for this proposal
    nV: u128; // noVotes: the total number of NO votes for this proposal
    f: Array<bool>; /* flags [
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
    mT: u128; // the maximum # of total shares and loot encountered at a yes vote on this proposal
    pS: u64; // proposalSubmitted: blockindex when proposal was submitted
    vP: i32; // voting period
    gP: i32; // grace period
    roleNames: Array<string>; // roles to assign to member
    voteFinalized: u64; //block timestamp of when vote was finalized
    configuration: Array<string>; //[periodDuration, votingPeriodLength, gracePeriodLength, proposalDeposit, dilutionBound]
    roleConfiguration: communityRole; // configuration changes to existing/add new roles
    reputationConfiguration: reputationFactor; //configuration changes to existing/add new reputation factors
    memberRoleConfiguration: communityRole; //member specific configuration changes to existing roles 
    referenceIds: Array<GenericObject>; // array of objects that correspond to other information such as proposals that this proposal references

    constructor (
        proposalIdentifier: i32,
        applicant: AccountId, 
        proposer: AccountId, 
        sponsor: AccountId,
        sharesRequested: u128, 
        lootRequested: u128,
        tributeOffered: u128, 
        tributeToken: AccountId, 
        paymentRequested: u128, 
        paymentToken: AccountId, 
        startingPeriod: i32, 
        yesVotes: u128, 
        noVotes: u128, 
        flags: Array<bool>, 
        maxTotalSharesAndLootAtYesVote: u128,
        proposalSubmission: u64, 
        votingPeriod: i32,
        gracePeriod: i32,
        roleNames: Array<string>,
        voteFinalized: u64,
        configuration: Array<string>,
        roleConfiguration: communityRole,
        reputationConfiguration: reputationFactor,
        memberRoleConfiguration: communityRole,
        referenceIds: Array<GenericObject>,
    )
    {
        this.pI = proposalIdentifier;
        this.a = applicant;
        this.p = proposer;
        this.s = sponsor;
        this.sR = sharesRequested;
        this.lR = lootRequested;
        this.tO = tributeOffered;
        this.tT = tributeToken;
        this.pR = paymentRequested;
        this.pT = paymentToken;
        this.sP = startingPeriod;
        this.yV = yesVotes;
        this.nV = noVotes;
        this.f = flags;
        this.mT = maxTotalSharesAndLootAtYesVote;
        this.pS = proposalSubmission;
        this.vP = votingPeriod;
        this.gP = gracePeriod;
        this.roleNames = roleNames;
        this.voteFinalized = voteFinalized;
        this.configuration = configuration;
        this.roleConfiguration = roleConfiguration;
        this.reputationConfiguration = reputationConfiguration;
        this.memberRoleConfiguration = memberRoleConfiguration;
        this.referenceIds = referenceIds;
    }
}