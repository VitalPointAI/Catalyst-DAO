import { Context, logging, PersistentMap, u128 } from "near-sdk-as";
import { AccountId, get_account_storage_cost, sendNear } from "../misc/utils";
import { tokenRegistry } from "./141";

export const storageRegistry = new PersistentMap<AccountId, StorageBalance>('s');

@nearBindgen
export class StorageBalance {

    constructor(
        public total: string,
        public available: string) {
    }
}

@nearBindgen
export class StorageBalanceBounds {

    constructor(
        public min: string,
        public max: string) {
    }
}

export function storage_deposit_impl(account_id: string = Context.predecessor, registration_only: boolean = true): StorageBalance {
    logging.log('here')
    //oneYocto();
    logging.log('here1')
    const storage_bound = storage_balance_bounds_impl();
    logging.log('here2')
    const min_bound = u128.from(storage_bound.min);
    logging.log('here3')

    assert(Context.attachedDeposit >= min_bound, "Deposit too low to pay registration fee");

    const balance = storage_balance_of_impl(account_id);
    if (u128.from(balance.total) > u128.Zero) {
        logging.log("The account is already registered, refunding the deposit");
        sendNear(Context.predecessor, Context.attachedDeposit);
        return balance;
    }
    balance.total = min_bound.toString();
    balance.available = "0";
    storageRegistry.set(account_id, balance);

    if (Context.attachedDeposit > min_bound) {
        sendNear(Context.predecessor, u128.sub(Context.attachedDeposit, min_bound));
    }

    return balance;
}

export function storage_withdraw_impl(amount: string | null): StorageBalance {
    oneYocto();
    assert(storageRegistry.contains(Context.predecessor), "The account " + Context.predecessor + " is not registered");
    assert(amount == null || u128.from(amount) == u128.Zero, "The amount is greater than the available storage balance");
    return storage_balance_of_impl(Context.predecessor);
}

export function storage_unregister_impl(force: boolean = false): boolean {
    oneYocto();
    if (force) {
        tokenRegistry.delete(Context.predecessor);
        storageRegistry.delete(Context.predecessor);
        return true;
    } else {
        throw "This method can only be called with force = true. Warning: All tokens will be burned and are lost.";
    }
}


export function storage_balance_bounds_impl(): StorageBalanceBounds {
    const storage_cost = get_account_storage_cost();
    return new StorageBalanceBounds(storage_cost, storage_cost);
}


export function storage_balance_of_impl(account_id: string): StorageBalance {
    return storageRegistry.get(account_id, new StorageBalance("0", get_account_storage_cost()))!;
}