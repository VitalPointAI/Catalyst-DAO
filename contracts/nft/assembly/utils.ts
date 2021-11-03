import { env, Context } from 'near-sdk-as'
import { AccountId, TokenId } from './types'
import {
    tokenRegistry
} from './model'

/******************/
/* ERROR MESSAGES */
/******************/

export const ERR_INVALID_AMOUNT = 'Allowance must be greater than zero'
export const ERR_INVALID_APPROVAL_ID = 'Approval id must be a number less than 2^53 to be JSON compatible'
export const ERR_INVALID_ACCOUNT = 'Account not found in registry'
export const ERR_NOT_OWNER = 'Permission Denied: calling account is not the token owner'
export const ERR_INVALID_ACCOUNT_ID = 'Not a valid NEAR account'
export const ERR_NOT_DIFFERENT = 'Permission Denied: cannot transfer to yourself'
export const ERR_NOT_SELF = 'Permission Denied: calling account is not this contract (self)'
export const ERR_INSUFFICIENT_BALANCE = 'Account does not have enough balance for this transaction'

export function assertValidId(id: AccountId): void {
    assert(env.isValidAccountID(id), ERR_INVALID_ACCOUNT_ID)
}

export function assertApprovalId(id: u64): void {
    assert(id < 10**53, ERR_INVALID_APPROVAL_ID)
}

export function isOwner(token_id: TokenId, caller_id: AccountId): void {
    let owner = tokenRegistry.get(token_id, null)
    assert(owner == caller_id, ERR_NOT_OWNER)
}

export function isSelf(): void {
    assert(predecessor() == Context.contractName, ERR_NOT_SELF)
}

export function assertIsDifferent(receiver: AccountId): void {
    assert(receiver != predecessor(), ERR_NOT_DIFFERENT)
}

/**
 * Context.predecessor currently makes host call every time.
 * This function caches it so that you only pay the first time.
 * 
 */
 let predecessorId: string | null = null;
 export function predecessor(): string {
    if (predecessorId == null) {
      predecessorId = Context.predecessor;
    }
    return predecessorId as string;
  }