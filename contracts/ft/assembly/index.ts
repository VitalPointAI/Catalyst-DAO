import { Context } from "near-sdk-as";
import { init_token_impl } from "./misc/utils";
import { ft_transfer_call_impl, ft_on_transfer_impl, ft_resolve_transfer_impl, ft_total_supply_impl, ft_balance_of_impl, ft_transfer_internal_impl } from "./nep/141";
import { StorageBalance, storage_deposit_impl, storage_withdraw_impl, storage_unregister_impl, StorageBalanceBounds, storage_balance_bounds_impl, storage_balance_of_impl } from "./nep/145";
import { FungibleTokenMetadata, ft_metadata_impl } from "./nep/148";

//init
export function init_token(metadata: FungibleTokenMetadata, max_supply: string): void {
    init_token_impl(metadata, max_supply);
}

//CORE NEP-141
export function ft_transfer(receiver_id: string, amount: string, memo: string | null = null): void {
    oneYocto();
    ft_transfer_internal_impl(Context.predecessor, receiver_id, amount, memo);
}

export function ft_transfer_call(receiver_id: string, amount: string, msg: string, memo: string | null = null): void {
    ft_transfer_call_impl(receiver_id, amount, msg, memo);
}

export function ft_on_transfer(sender_id: string, amount: string, msg: string): string {
    return ft_on_transfer_impl(sender_id, amount, msg);
}

export function ft_resolve_transfer(sender_id: string, receiver_id: string, amount: string): string {
    return ft_resolve_transfer_impl(sender_id, receiver_id, amount);
}

export function ft_total_supply(): string {
    return ft_total_supply_impl();
}

export function ft_balance_of(account_id: string): string {
    return ft_balance_of_impl(account_id);
}


// STORAGE NEP-145
export function storage_deposit(account_id: string = Context.predecessor, registration_only: boolean = false): StorageBalance {
    return storage_deposit_impl(account_id, registration_only);
}

export function storage_withdraw(amount: string | null = null): StorageBalance {
    return storage_withdraw_impl(amount);
}

export function storage_unregister(force: boolean): boolean {
    return storage_unregister_impl(force);
}

export function storage_balance_bounds(): StorageBalanceBounds {
    return storage_balance_bounds_impl();
}

export function storage_balance_of(account_id: string): StorageBalance | null {
    return storage_balance_of_impl(account_id);
}

// METADATA NEP-148
export function ft_metadata(): FungibleTokenMetadata {
    return ft_metadata_impl();
}
