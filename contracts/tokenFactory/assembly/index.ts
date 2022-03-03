import { AVLTree, ContractPromiseBatch, PersistentMap, Context, u128, env } from 'near-sdk-as'
import { FTModel } from './model';

const CODE = includeBytes('../../../build/release/ft.wasm')

let allTokens = new AVLTree<u32, FTModel>('t')
let allTokensIndex = new PersistentMap<string, u32>('i')

export function getTokenList(start: i32, end: i32): Array<FTModel> {
  assert (start >= 0 && end >= 0, "index ranges must be non negative")
  return allTokens.values(start as u32, end as u32)
}

export function getTokenListLength(): u32 {
  return allTokens.size
}

export function getTokensByAccount(accountId: string): FTModel {
  const index = getTokenIndex(accountId);
  assert(index != -1, "No token with this account")
  return allTokens.get(index) as FTModel;
}

export function getTokenIndex(accountId: string): i32 {
  return allTokensIndex.contains(accountId) ? allTokensIndex.getSome(accountId) : -1
}

export function createToken(
  accountId: string,
  deposit: u128
): ContractPromiseBatch {
  assert(Context.attachedDeposit >= deposit, 'not enough deposit was attached') 
  assert(env.isValidAccountID(accountId), 'not a valid near account')
 
  let promise = ContractPromiseBatch.create(accountId)
    .create_account()
    .transfer(Context.attachedDeposit)
    .deploy_contract(Uint8Array.wrap(changetype<ArrayBuffer>(CODE)))
  
  // next index (location to store the new Token) should be greater than any key in the tree
  let nextIndex = allTokens.size == 0 ? 0 : allTokens.max() + 1;
  allTokensIndex.set(accountId, nextIndex) 

  let newTokenModel = new FTModel(accountId, Context.blockTimestamp, Context.predecessor, 'active')
  allTokens.set(nextIndex, newTokenModel)

  return promise
}