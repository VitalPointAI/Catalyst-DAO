import { Context, env, u128 } from 'near-sdk-as';
import { 
    ERR_INVALID_ACCOUNT_ID,
    ERR_RESERVED
 } from './dao-error-messages';
import {
    GUILD,
    ESCROW,
    TOTAL
} from './dao-types'


export function assertValidId(id: string): void {
  assert(env.isValidAccountID(id), ERR_INVALID_ACCOUNT_ID)
}

export function assertValidApplicant(id: string): void {
    assert(env.isValidAccountID(id), ERR_INVALID_ACCOUNT_ID)
    assert(id != GUILD && id != ESCROW && id != TOTAL, ERR_RESERVED)
}

export function isPositive(num: u128): boolean {
  return u128.gt(num, u128.Zero) == 1;
}

let predecessorId: string | null = null;

/**
 * Context.predecessor currently makes host call every time.
 * This function caches it so that you only pay the first time.
 * 
 */
export function predecessor(): string {
  if (predecessorId == null) {
    predecessorId = Context.predecessor;
  }
  return predecessorId as string;
}