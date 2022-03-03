import { 
  PersistentMap, 
  env, 
  Context, 
  logging, 
  u128, 
  storage, 
  base58,
  ContractPromiseBatch } from 'near-sdk-as'

const admins = new PersistentMap<string, boolean>('a')

const ADMIN_KEY = "ADMIN"

export function init(adminId: string): void {
  assert(storage.get<string>("init") == null, 'already initialized')
  _init(adminId)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"init",
    "data":{
      "adminId":"${adminId}",
      "adminSet":${Context.blockTimestamp},
      "accountId":"${adminId}"
    }}}`)

}

function _init(adminId: string): void {
    assert(env.isValidAccountID(adminId), "Invalid adminId")
    storage.setString(ADMIN_KEY, adminId)
    admins.set(adminId, true)
    storage.set<string>('init', 'done')
}

export function setContractToFund(publicKey: string, allowance: u128, contract: string, methods: Array<string>): void {
  _assertAdmin()
  assert(u128.le(allowance, u128.from('2')), 'allowance is too high')
  let promise = ContractPromiseBatch.create(Context.contractName)
  .add_access_key(base58.decode(publicKey), allowance, contract, methods)
  let admin = storage.getString(ADMIN_KEY) as string

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"setContractToFund",
    "data":{
      "contractPublicKey":"${publicKey}",
      "allowance":"${allowance}",
      "contract":"${contract}",
      "methods":${methods},
      "time":${Context.blockTimestamp},
      "admin":"${admin}"
    }}}`)
}

function _assertAdmin(): void {
  assert(Context.sender == storage.getString(ADMIN_KEY), "Permission denied - not admin");
}

export function transferAdmin(accountId: string): boolean {
  _assertAdmin()
  assert(env.isValidAccountID(accountId), 'not a valid account')
  let currentAdmin:string = storage.get(ADMIN_KEY, '') as string
  storage.setString(ADMIN_KEY, accountId)
  admins.set(accountId, true)
  admins.delete(currentAdmin)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"transferAdmin",
    "data":{
      "transferredFrom":"${currentAdmin}",
      "transferred":${Context.blockTimestamp},
      "transferredTo":"${accountId}"
    }}}`)

  return true
}