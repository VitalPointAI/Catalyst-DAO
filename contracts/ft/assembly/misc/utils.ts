import { Context, ContractPromiseBatch, storage, u128 } from 'near-sdk-as'
import { tokenRegistry } from '../nep/141'
import { FungibleTokenMetadata } from '../nep/148'

/******************/
/* ERROR MESSAGES */
/******************/

export const ERR_INVALID_AMOUNT = 'Allowance must be greater than zero'
export const ERR_INVALID_ACCOUNT = 'Account not found in registry'
export const ERR_INSUFFICIENT_BALANCE = 'Account does not have enough balance for this transaction'

export type AccountId = string

export const XCC_GAS: u64 = 35_000_000_000_000;
export const XCC_RESOLVE_GAS: u64 = 10_000_000_000_000;
export const ONE_NEAR: u128 = u128.from("1000000000000000000000000");

export function sendNear(recipient: string, amount: u128): void {
    ContractPromiseBatch.create(recipient).transfer(amount);
}

export function init_token_impl(metadata: FungibleTokenMetadata, max_supply: string): void {
    //assert(Context.predecessor == Context.contractName, "Only the contractowner can initialize the token")
    const init_state = storage.getPrimitive<bool>("i", false);
    assert(!init_state, "contract already initialized");
    storage.set("metadata", metadata);
    storage.set("max_supply", max_supply);
    storage.set("i", true);
    storage.set("creator", Context.predecessor)
    tokenRegistry.set(Context.predecessor, u128.from(max_supply));
    measure_account_storage_usage();
}

export function reset_token_impl(): void {
    assert(Context.predecessor == Context.contractName, "Only the contractowner can initialize the token")
    const init_state = storage.getPrimitive<bool>("i", false);
    assert(init_state, "contract is not initialized");
    storage.delete("metadata");
    storage.delete("max_supply");
    storage.delete("i");
    storage.delete("account_storage_usage")
}

function measure_account_storage_usage(): void {
    const initial_storage_usage = Context.storageUsage;
    tokenRegistry.set("a".repeat(64), u128.Max);
    storage.set("account_storage_usage", Context.storageUsage - initial_storage_usage);
    tokenRegistry.delete("a".repeat(64));
}

export function get_account_storage_cost(): string {
    return storage.getSome<u32>("account_storage_usage").toString();
}
