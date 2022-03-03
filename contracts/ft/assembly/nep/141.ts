import { u128, Context, PersistentMap, logging, ContractPromise, env, storage } from "near-sdk-as";
import { AccountId, ERR_INSUFFICIENT_BALANCE, ERR_INVALID_ACCOUNT, ERR_INVALID_AMOUNT, XCC_GAS, XCC_RESOLVE_GAS } from "../misc/utils";


export const tokenRegistry = new PersistentMap<AccountId, u128>('t');

export function ft_transfer_internal_impl(sender_id: string, receiver_id: string, amount: string, memo: string | null): void {
    oneYocto();
    assert(env.isValidAccountID(receiver_id), ERR_INVALID_ACCOUNT);

    const convertedAmount = u128.from(amount); //TODO Check if amount is a valid number

    assert(sender_id != receiver_id, "Sender and receiver should be different");
    assert(convertedAmount > u128.Zero, ERR_INVALID_AMOUNT);

    const balanceOfSender = tokenRegistry.getSome(sender_id);
    assert(balanceOfSender >= convertedAmount, ERR_INSUFFICIENT_BALANCE)
    const balanceOfReceiver = tokenRegistry.get(receiver_id, u128.Zero)!;

    const new_balanceOfSender = u128.sub(balanceOfSender, convertedAmount)
    const new_balanceOfReceiver = u128.add(balanceOfReceiver, convertedAmount)

    tokenRegistry.set(sender_id, new_balanceOfSender);
    tokenRegistry.set(receiver_id, new_balanceOfReceiver);

    logging.log("Transfer " + amount + " from " + sender_id + " to " + receiver_id);

    if (memo) {
        logging.log("Memo: " + memo);
    }
}


@nearBindgen
export class FTT_CALL {
    sender_id: string;
    amount: string;
    msg: string;
}

@nearBindgen
export class FTT_CALLBACK {
    sender_id: string;
    receiver_id: string;
    amount: string;
}

export function ft_transfer_call_impl(receiver_id: string, amount: string, msg: string, memo: string | null): void {
    oneYocto();
    const sender_id = Context.predecessor;
    ft_transfer_internal_impl(sender_id, receiver_id, amount, memo);

    ContractPromise.create<FTT_CALL>(
        receiver_id,
        "ft_on_transfer",
        { sender_id, amount, msg },
        XCC_GAS
    ).then<FTT_CALLBACK>(
        Context.contractName,
        "ft_resolve_transfer",
        {
            sender_id, receiver_id, amount
        },
        XCC_RESOLVE_GAS
    ).returnAsResult();
}

// This function is implemented on the receiving contract.
// As mentioned, the `msg` argument contains information necessary for the receiving contract to know how to process the request. This may include method names and/or arguments. 
// Returns a value, or a promise which resolves with a value. The value is the
// number of unused tokens in string form. For instance, if `amount` is 10 but only 9 are
// needed, it will return "1".
export function ft_on_transfer_impl(sender_id: string, amount: string, msg: string): string {
    throw("not implemented");
}

export function ft_resolve_transfer_impl(sender_id: string, receiver_id: string, amount: string): string {
    const results = ContractPromise.getResults();
    assert(results.length == 1, "Cross contract chain should be 1");
    assert(Context.predecessor == Context.contractName, "Method ft_resolve_transfer is private");
    assert(!results[0].pending);
    let unusedAmount = "0";
    if (results[0].failed) {
        logging.log("Failed transaction, refund all");
        unusedAmount = amount;
    }
    else {
        unusedAmount = results[0].decode<string>(); //unused amount provided by on_transfer method
    }

    const amountConverted = u128.from(amount);
    let unusedAmountConverted = u128.from(unusedAmount);

    if (unusedAmountConverted > u128.Zero) {
        //check balance of receiver and get min value
        const receiver_balance = tokenRegistry.get(receiver_id, u128.Zero)!;
        if (u128.gt(unusedAmountConverted, receiver_balance)) {
            unusedAmountConverted = receiver_balance; //can't refund more than total balance
        }
        const usedAmount = u128.sub(amountConverted, unusedAmountConverted).toString();

        if (!tokenRegistry.contains(sender_id)) {
            logging.log("Refund not possible, account deleted");
            //todo reduce max supply
        }
        else {
            logging.log("Attached too much tokens, refund");
            ft_transfer_internal_impl(receiver_id, sender_id, unusedAmountConverted.toString(), null);

        }
        return usedAmount;
    }
    return amount;
}

export function ft_total_supply_impl(): string {
    return storage.getSome<string>("max_supply");
}

export function ft_balance_of_impl(account_id: string): string {
    const balance = tokenRegistry.get(account_id, u128.Zero)!;
    return balance.toString();
}

