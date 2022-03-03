import { PersistentMap, env, Context, logging, storage, PersistentUnorderedMap, AVLTree } from 'near-sdk-as'

const didRegistry = new PersistentMap<string, string>('d')
const accountType = new PersistentMap<string, string>('t')
const aliasRegistry = new PersistentMap<string, string>('a')
const verificationRegistry = new PersistentMap<string, boolean>('v')
const whitelistedVerifiers = new PersistentMap<string, boolean>('w')
const aliasOwners = new PersistentMap<string, string>('o')
const roles = new PersistentUnorderedMap<string, AVLTree<string, Array<string>>>('e')

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
    whitelistedVerifiers.set(adminId, true)
    storage.set<string>('init', 'done')
}

function _assertAdmin(): void {
  assert(Context.sender == storage.getString(ADMIN_KEY), "Permission denied - not admin");
}

export function transferAdmin(accountId: string): boolean {
  _assertAdmin()
  assert(env.isValidAccountID(accountId), 'not a valid account')
  let currentAdmin:string = storage.get(ADMIN_KEY, '') as string
  storage.setString(ADMIN_KEY, accountId)
  whitelistedVerifiers.set(accountId, true)
  whitelistedVerifiers.delete(currentAdmin)

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

//DID Registry
//
// accountId: someaccount e.g. vitalpointai.near
// did: decentralized identifier e.g., did:key:z6Mkw1Mpfejq2R76AsQo2qJoAVaF6HH5nLDoHrKrsW5Wdnei

export function getDID(accountId: string) : string {
  const did = didRegistry.get(accountId)
  assert(did != null, 'no did registered for this near account')
  return did as string; // ! in TS asserts that the value is non-null, but it adds runtime check in AS so casting here does the trick.
}

export function getType(accountId: string) : string {
  const type = accountType.get(accountId)
  assert(type != null, 'account not registered, type not avail')
  return type as string
}

export function getAdmin(): string {
  return storage.getSome<string>(ADMIN_KEY)
}

export function getVerificationStatus(accountId: string): boolean {
  assert(verificationRegistry.contains(accountId), 'not present in verification registry')
  if(verificationRegistry.contains(accountId)){
    return verificationRegistry.getSome(accountId)
  }
  return false
}

export function hasDID(accountId: string) : bool {
  return didRegistry.contains(accountId);
}

// only the account itself can register itself
export function putDID(accountId: string, did: string, type: string): boolean {
  assert(Context.sender == Context.predecessor && Context.predecessor == accountId, 'only account owner can register or change their associated DID in the registry')
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(!didRegistry.contains(accountId), 'already registered a DID')
  didRegistry.set(accountId, did)
  accountType.set(accountId, type)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"putDID",
    "data":{
      "accountId":"${accountId}",
      "did":"${did}",
      "type":"${type}",
      "registered":${Context.blockTimestamp},
      "owner":"${Context.predecessor}"
    }}}`)

  return true
}


export function changeVerificationStatus(accountId: string, verified: boolean): boolean {
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(whitelistedVerifiers.contains(Context.predecessor), 'not an approved verifier')
  if(whitelistedVerifiers.contains(Context.predecessor)){
    verificationRegistry.set(accountId, verified)

    logging.log(`{"EVENT_JSON":{
      "standard":"nep171",
      "version":"1.0.0",
      "event":"changeVerificationStatus",
      "data":{
        "accountId":"${accountId}",
        "time":${Context.blockTimestamp},
        "verified":${verified},
        "changedBy":"${Context.predecessor}"
      }}}`)

    return true
  }
 return false
}

// only the account itself can remove a Role
// note that roleArray has a hardcoded 10 element limit to prevent gas issues
export function removeRole(contractId: string, accountId: string, role: string): boolean {
  assert(env.isValidAccountID(accountId), 'not a valid account')
  assert(Context.sender == Context.predecessor, 'only account owner can remove roles')
  if(roles.contains(Context.predecessor)){
    let list = roles.getSome(Context.predecessor)
    if(list.has(accountId)){
      let curRoles = list.getSome(accountId)
      for(let i = 0; i < curRoles.length; i++){
        if(curRoles[i] == role){
          curRoles.splice(i,0)
          list.set(accountId, curRoles)
          roles.set(Context.predecessor, list)
        }
      }
    }

    logging.log(`{"EVENT_JSON":{
      "standard":"nep171",
      "version":"1.0.0",
      "event":"removeRole",
      "data":{
        "contractId":"${contractId}",
        "accountId":"${accountId}",
        "role":"${role}",
        "time":${Context.blockTimestamp},
        "removedBy":"${Context.predecessor}"
      }}}`)

    return true
  }
  return false
}


// only the account itself can add a Role to itself (contract account)
// @param accountId - the account getting the role
// @param role - role being applied
export function addRole(accountId: string, roleArray: Array<string>): boolean {
  assert(env.isValidAccountID(accountId), 'not a valid account')
  assert(roleArray.length < 10, 'too many roles for this contract, 10 is limit to prevent gas issues')
  assert(Context.sender == Context.predecessor, 'only account owner can add roles')
  let newRole = new AVLTree<string, Array<string>>('r'+Context.predecessor)
  newRole.set(accountId, roleArray)
  roles.set(Context.predecessor, newRole)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"addRole",
    "data":{
      "contractId":"${Context.predecessor}",
      "accountId":"${accountId}",
      "role":${roleArray},
      "time":${Context.blockTimestamp},
      "addedBy":"${Context.predecessor}"
    }}}`)

  return true
}


export function addVerifier(accountId: string) : boolean {
  _assertAdmin()
  whitelistedVerifiers.set(accountId, true)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"addVerifier",
    "data":{
      "accountId":"${accountId}",
      "time":${Context.blockTimestamp},
      "whitelistedBy":"${Context.predecessor}"
    }}}`)

  return true
}


export function removeVerifier(accountId: string): boolean {
  _assertAdmin()
  whitelistedVerifiers.delete(accountId)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"removeVerifier",
    "data":{
    "accountId":"${accountId}",
    "time":${Context.blockTimestamp},
    "removedBy":"${Context.predecessor}"
  }}}`)

  return true
}


export function deleteDID(accountId: string): boolean {
  assert(Context.sender == Context.predecessor && Context.predecessor == accountId, 'only account owner can delete their DID from the registry')
  assert(didRegistry.contains(accountId), 'no did registered for this account')
  let did = getDID(accountId)
  didRegistry.delete(accountId)
  let type = accountType.getSome(accountId)
  accountType.delete(accountId)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"deleteDID",
    "data":{
      "accountId":"${accountId}",
      "did":"${did}",
      "type":"${type}",
      "time":${Context.blockTimestamp},
      "deletedBy":"${Context.predecessor}"
    }}}`)

  return true
}


// ALIAS and Definition Registry
// 
// alias: accountId +':'+ aliasName  e.g. vitalpointai.near:profileData
// definition: a StreamId of a Ceramic definition id e.g. kjzl6cwe1jw14bdsytwychcd91fcc7xibfj8bc0r2h3w5wm8t6rt4dtlrotl1ou
// definition contains its name, description, and schema

export function retrieveAlias(alias: string) : string {
  assert(aliasRegistry.contains(alias), 'alias is not registered')
  return aliasRegistry.getSome(alias)
}

export function hasAlias(alias: string) : bool {
  return aliasRegistry.contains(alias)
}

export function storeAlias(alias: string, definition: string, description: string): boolean {
  assert(!aliasRegistry.contains(alias), 'alias already registered')
  aliasRegistry.set(alias, definition)
  aliasOwners.set(Context.predecessor, alias)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"storeAlias",
    "data":{
      "alias":"${alias}",
      "time":${Context.blockTimestamp},
      "storedBy":"${Context.predecessor}",
      "definition":"${definition}",
      "description":"${description}"
    }}}`)

  return true
}

export function deleteAlias(alias: string): boolean {
  assert(aliasOwners.get(Context.predecessor) == alias, 'only alias owner can delete if from the registry')
  assert(aliasRegistry.contains(alias), 'alias is not registered')
  aliasRegistry.delete(alias)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"deleteAlias",
    "data":{
      "alias":"${alias}",
      "time":${Context.blockTimestamp},
      "deletedBy":"${Context.predecessor}"
    }}}`)

  return true
}