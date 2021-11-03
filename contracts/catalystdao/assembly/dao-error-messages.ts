export const ERR_INSUFFICIENT_BALANCE = 'Account does not have enough balance for this transaction'
export const ERR_INVALID_ACCOUNT_ID = 'Account Id is not valid'
export const ERR_NOT_A_MEMBER = 'Not a current member'
export const ERR_DAO_ALREADY_INITIALIZED = 'DAO already initialized'
export const ERR_MUSTBE_GREATERTHAN_ZERO = 'Must be greater than zero'
export const ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH = "voting period length exceeds the limit"
export const ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH = "grace period length exceeds the limit"
export const ERR_DILUTIONBOUND_ZERO = "dilution bound cannot be zero"
export const ERR_DILUTIONBOUND_LIMIT = "dilution bound exceeds the limit"
export const ERR_APPROVEDTOKENS = "need at least one approved token"
export const ERR_TOO_MANY_TOKENS = "too many tokens"
export const ERR_PROPOSAL_DEPOSIT = "proposal deposit cannot be smaller than processing reward"
export const ERR_DUPLICATE_TOKEN = "duplicate approved token"
export const ERR_TOO_MANY_SHARES = "too many shares requested"
export const ERR_NOT_WHITELISTED = "tribute token is not whitelisted"
export const ERR_NOT_WHITELISTED_PT = "payment token is not whitelisted"
export const ERR_RESERVED = "applicant account cannot be reserved"
export const ERR_JAILED = "proposal applicant must not be jailed"
export const ERR_FULL_GUILD_BANK = "cannot submit more tribute proposals for new tokens - guildbank is full"
export const ERR_GREATER_ZERO_TOTALSHARES = "total shares must be greater than 0"
export const ERR_TRIBUTE_TRANSFER_FAILED = "tribute token transfer failed"
export const ERR_ALREADY_WHITELISTED = "cannot already have whitelisted the token"
export const ERR_TOO_MANY_WHITELISTED = "cannot submit more whitelist proposals"
export const ERR_SHAREORLOOT = "member must have at least one share or one loot"
export const ERR_NOT_DELEGATE = "unauthorized action - not a delegate"
export const ERR_PROPOSALDEPOSIT_TRANSFER_FAILED = "proposal deposit token transfer failed"
export const ERR_ALREADY_SPONSORED = "proposal has already been sponsored"
export const ERR_PROPOSAL_CANCELLED = "proposal has been cancelled"
export const ERR_WHITELIST_PROPOSED = "already proposed to whitelist"
export const ERR_CANNOT_SPONSOR_MORE = "cannot sponsor more whitelist proposals"
export const ERR_PROPOSED_KICK = "already proposed to kick"
export const ERR_PROPOSAL_NO = "proposal does not exist"
export const ERR_VOTE_INVALID = "vote must be yes or no"
export const ERR_ALREADY_VOTED = "member has already voted"
export const ERR_VOTING_PERIOD_EXPIRED = "proposal voting period has expired"
export const ERR_VOTING_NOT_STARTED = "voting period has not started"
export const ERR_NOT_READY = "proposal is not ready to be processed"
export const ERR_PROPOSAL_PROCESSED = "proposal already processed"
export const ERR_PREVIOUS_PROPOSAL = "previous proposal must be processed"
export const ERR_STANDARD_PROPOSAL = "must be a standard proposal"
export const ERR_WHITELIST_PROPOSAL = "must be a whitelist proposal"
export const ERR_FUNCTION_PROPOSAL = "must be a function proposal"
export const ERR_GUILD_PROPOSAL = "must be a guild kick proposal"
export const ERR_INSUFFICIENT_SHARES = "insufficient shares"
export const ERR_INSUFFICIENT_LOOT = "insufficient loot"
export const ERR_CANNOT_RAGEQUIT = "cannot ragequit until highest index proposal member voted YES on is processed"
export const ERR_HAVE_LOOT = "member must have some loot"
export const ERR_IN_JAIL = "member must be in jail"
export const ERR_MUST_MATCH = "tokens and amounts arrays must be matching lengths"
export const ERR_TOKEN_TRANSFER_FAILED = "token transfer failed"
export const ERR_NONZERO_BANK = "token to collect must have non-zero guild bank balance"
export const ERR_TOKEN_NOT_WHITELISTED = "token to collect must be whitelisted"
export const ERR_NO_TOKENS = "no tokens to collect"
export const ERR_ALREADY_CANCELLED = "proposal has already been cancelled"
export const ERR_ONLY_PROPOSER = "solely the proposer can cancel"
export const ERR_NOT_SHAREHOLDER = "not a shareholder"
export const ERR_NO_OVERWRITE_KEY = "cannot overwrite existing delegate keys"
export const ERR_NO_OVERWRITE_MEMBER = "cannot overwrite existing members"
export const ERR_NOT_RIGHT_PROPOSAL = "proposal identifiers do not match"
export const ERR_ALREADY_MEMBER = "already a member"
export const ERR_DUPLICATE_PROPOSAL = 'proposal already exists'