import { AVLTree, ContractPromiseBatch, PersistentMap, Context, u128, env, storage, logging } from 'near-sdk-as'
import { DaoModel } from './model';

const CODE = includeBytes('../../../build/release/catalystdao.wasm')

//const CODE_KEY = "CODE";

//const OWNER_KEY = "OWNER";


// export function init(ownerId: string): void {
//   assert(env.isValidAccountID(ownerId), "Invalid ownerId")
//   storage.setString(OWNER_KEY, ownerId)
//   logging.log(`${ownerId} now owner`)
// }

// export function setBinary(): void {
//   assert(Context.sender == storage.getString(OWNER_KEY), "Only owner can set binary");
//   env.input(10);
//   env.storage_write(String.UTF8.byteLength(CODE_KEY), <u64>changetype<usize>(CODE_KEY), U64.MAX_VALUE, 10, 11);
// }

let daos = new AVLTree<u32, DaoModel>('M')
let daoIndex = new PersistentMap<string, u32>('I')

export function getDaoList(start: i32, end: i32): Array<DaoModel> {
  assert (start >= 0 && end >= 0, "index ranges must be non negative")
  return daos.values(start as u32, end as u32)
}

export function getDaoListLength(): u32 {
  return daos.size
}

export function getDaoByAccount(accountId: string): DaoModel {
  const index = getDaoIndex(accountId);
  assert(index != -1, "No dao with this account")
  return daos.get(index) as DaoModel;
}

export function getDaoIndex(accountId: string): i32 {
  return daoIndex.contains(accountId) ? daoIndex.getSome(accountId) : -1
}

export function deleteDAO(accountId: string, beneficiary: string): ContractPromiseBatch {
  assert(env.isValidAccountID(accountId), 'not a valid account')
  assert(env.isValidAccountID(beneficiary), 'not a valid beneficiary account')

  // get DAO's index, ensuring it is in the daos vector
  let index = getDaoIndex(accountId)
  assert(index != -1, 'dao does not exist - can not delete')

  daos.delete(index)
  daoIndex.delete(accountId)
  
  // if we make it here, the DAO is effectively removed from our tracking mechanisms, so the account can be deleted with 
  // anything left in it going to the beneficiary address
  let promise = ContractPromiseBatch.create(accountId)
                                    .delete_account(beneficiary)
  
  return promise
}

export function createDAO(
  accountId: string,
  deposit: u128
): ContractPromiseBatch {
  assert(Context.attachedDeposit >= deposit, 'not enough deposit was attached') 
  assert(env.isValidAccountID(accountId), 'not a valid near account')
 
  let promise = ContractPromiseBatch.create(accountId)
    .create_account()
    .transfer(Context.attachedDeposit)
  
  // env.storage_read(String.UTF8.byteLength(CODE_KEY), <u64>changetype<usize>(CODE_KEY), 10);
  // env.promise_batch_action_deploy_contract(promise.id, U64.MAX_VALUE, 10); 
    .deploy_contract(Uint8Array.wrap(changetype<ArrayBuffer>(CODE)))
  
  // next index (location to store the new DAO) should be greater than any key in the tree
  let nextIndex = daos.size == 0 ? 0 : daos.max() + 1;
  daoIndex.set(accountId, nextIndex) 

  let newDaoModel = new DaoModel(accountId, Context.blockTimestamp, Context.predecessor)
  daos.set(nextIndex, newDaoModel)

  return promise
}

/**
 * 
 * Questions:
 * 
 * 1. Should there be a mimimum deposit required?
 * 2. Are accountId's subaccounts on DOA contract? If so then perhaps the accountId should be a prefix or full path
 * 3. Shouldn't the dao binary be upgradable? Or just redeploy this contract?
 * 
 * 
 * Comments:
 * 
 * 1. Should add a callback to promise incase of failure, e.g. a valid accountId but account exists or contract doesn't have permission.
 * 2. Should use a AvlTree if you want to maintain order of doas added.
 * 3. 
 */