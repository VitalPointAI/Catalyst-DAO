import { 
  PersistentMap, 
  env, 
  Context, 
  logging, 
  u128, 
  storage, 
  base58, 
  PersistentUnorderedMap, 
  AVLTree, 
  ContractPromiseBatch,
  PersistentSet} from 'near-sdk-as'

const didRegistry = new PersistentMap<string, string>('d')
const accountType = new PersistentMap<string, string>('t')
const aliasRegistry = new PersistentMap<string, string>('a')
const admins = new PersistentSet<string>('m')
const verificationRegistry = new PersistentMap<string, boolean>('v')
const whitelistedVerifiers = new PersistentMap<string, boolean>('w')
const aliasOwners = new PersistentMap<string, string>('o')
const roles = new PersistentUnorderedMap<string, AVLTree<string, Array<string>>>('e')
const tiers = new PersistentMap<string, string>('y')

let SUPER_ADMIN_KEY = "SUPER_ADMIN"

export function init(adminId: string, fundingPublicKey: string, allowance: u128): void {
  assert(storage.get<string>("init") == null, 'already initialized')
  _init(adminId, fundingPublicKey, allowance)

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

function _init(adminId: string, fundingPublicKey: string, allowance: u128): void {
    assert(env.isValidAccountID(adminId), "Invalid adminId")
    if(admins.size == 0){
      storage.set<string>(SUPER_ADMIN_KEY, adminId)
      admins.add(adminId)
      whitelistedVerifiers.set(adminId, true)
      let promise = ContractPromiseBatch.create(Context.contractName)
      .add_access_key(
      base58.decode(fundingPublicKey), 
      allowance, 
      Context.contractName, 
      ['putDID','deleteDID','adjustKeyAllowance'])
      storage.set<string>('init', 'done')
    }
}

function _assertAdmin(): void {
  assert(admins.has(Context.predecessor), 'Permission denied - not admin')
}

export function addAdmin(accountId: string): boolean {
  _assertAdmin()
  assert(env.isValidAccountID(accountId), 'not a valid account')
  admins.add(accountId)
  whitelistedVerifiers.set(accountId, true)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"addAdmin",
    "data":{
      "addedBy":"${Context.predecessor}",
      "time":${Context.blockTimestamp},
      "adminAdded":"${accountId}"
    }}}`)

  return true
}

export function removeAdmin(accountId: string) : boolean {
  assert(Context.predecessor == storage.getSome<string>(SUPER_ADMIN_KEY), 'only super admin can remove admins')
  assert(env.isValidAccountID(accountId), 'not a valid account')
  assert(admins.has(accountId), 'cannot remove - not an admin')
  admins.delete(accountId)
  whitelistedVerifiers.delete(accountId)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"removeAdmin",
    "data":{
      "removedBy":"${Context.predecessor}",
      "time":${Context.blockTimestamp},
      "adminRemoved":"${accountId}"
    }}}`)
  
  return true
}

export function adjustKeyAllowance(fundingAccountPublicKey: string, newKeyAllowance: u128) : boolean {
  _deleteFundingKey(fundingAccountPublicKey)
  _addFundingKey(fundingAccountPublicKey, newKeyAllowance)
  return true
}

function _addFundingKey(fundingAccountPublicKey: string, keyAllowance: u128) : boolean {
  assert(Context.predecessor == Context.contractName, 'only contract can set a key on itself')
  let promise = ContractPromiseBatch.create(Context.contractName)
    .add_access_key(
      base58.decode(fundingAccountPublicKey), 
      keyAllowance, 
      Context.contractName, 
      ['putDID','deleteDID','adjustKeyAllowance'])

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"addFundingKey",
    "data":{
      "fundingAccountPublicKey":"${fundingAccountPublicKey}",
      "keyAllowance":"${keyAllowance}",
      "time":${Context.blockTimestamp}
    }}}`)

  return true
}

function _deleteFundingKey(fundingAccountPublicKey: string) : boolean {
  assert(Context.predecessor == Context.contractName, 'only contract can delete one of its own keys')
  let promise = ContractPromiseBatch.create(Context.contractName)
    .delete_key(base58.decode(fundingAccountPublicKey))

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"deleteFundingKey",
    "data":{
      "deletedFundingAccountPublicKey":"${fundingAccountPublicKey}",
      "time":${Context.blockTimestamp}
    }}}`)

  return true
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

export function getSuperAdmin(): string {
  return storage.getSome<string>(SUPER_ADMIN_KEY)
}

export function getAdmins(): Array<string> {
  return admins.values()
}

export function getVerificationStatus(accountId: string): boolean {
  assert(verificationRegistry.contains(accountId), 'not present in verification registry')
  if(verificationRegistry.contains(accountId)){
    return verificationRegistry.getSome(accountId)
  }
  return false
}

export function getIdVerificationStatus(id: string): boolean {
  assert(verificationRegistry.contains(id), 'not present in verification registry')
  if(verificationRegistry.contains(id)){
    return verificationRegistry.getSome(id)
  }
  return false
}

export function getTier(accountId: string): string {
  assert(tiers.contains(accountId), 'not tiered')
  if(tiers.contains(accountId)){
    return tiers.getSome(accountId)
  }
  return 'none'
}

export function getIdTier(id: string): string {
  assert(tiers.contains(id), 'not tiered')
  if(tiers.contains(id)){
    return tiers.getSome(id)
  }
  return 'none'
}

export function hasDID(accountId: string) : bool {
  return didRegistry.contains(accountId);
}


// only the account itself can register itself
export function putDID(accountId: string, did: string, type: string): boolean {
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

// only the account itself can register itself
export function putIdDID(id: string, did: string, type: string): boolean {
  assert(!didRegistry.contains(id), 'already registered a DID')
  didRegistry.set(id, did)
  accountType.set(id, type)

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"putIdDID",
    "data":{
      "id":"${id}",
      "did":"${did}",
      "type":"${type}",
      "registered":${Context.blockTimestamp},
      "owner":"${Context.predecessor}"
    }}}`)

  return true
}

export function deleteIdDID(id: string): boolean {
  assert(didRegistry.contains(id), 'no did registered for this id')
  let did = getDID(id)
  didRegistry.delete(id)
  let type = accountType.getSome(id)
  accountType.delete(id)
  if(verificationRegistry.contains(id)){
    verificationRegistry.delete(id)
  }

  logging.log(`{"EVENT_JSON":{
    "standard":"nep171",
    "version":"1.0.0",
    "event":"deleteIdDID",
    "data":{
      "accountId":"${id}",
      "did":"${did}",
      "type":"${type}",
      "time":${Context.blockTimestamp},
      "deletedBy":"${Context.predecessor}"
    }}}`)

  return true
}


export function deleteDID(accountId: string): boolean {
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(didRegistry.contains(accountId), 'no did registered for this account')
  let did = getDID(accountId)
  didRegistry.delete(accountId)
  let type = accountType.getSome(accountId)
  accountType.delete(accountId)
  if(verificationRegistry.contains(accountId)){
    verificationRegistry.delete(accountId)
  }

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


export function changeVerificationStatus(accountId: string, verified: boolean): boolean {
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(accountId != Context.predecessor, 'can not adjust own verification status')
  assert(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor), 'not an approved verifier or admin')
  if(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor)){
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

export function changeTier(accountId: string, tier: string): boolean {
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  assert(accountId != Context.predecessor, 'can not adjust own tier')
  assert(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor), 'not an approved verifier or admin')
  if(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor)){
    tiers.set(accountId, tier)

    logging.log(`{"EVENT_JSON":{
      "standard":"nep171",
      "version":"1.0.0",
      "event":"changeTier",
      "data":{
        "accountId":"${accountId}",
        "time":${Context.blockTimestamp},
        "tier":${tier},
        "changedBy":"${Context.predecessor}"
      }}}`)

    return true
  }
 return false
}

export function changeIdVerificationStatus(id: string, verified: boolean): boolean {
  assert(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor), 'not an approved verifier or admin')
  if(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor)){
    verificationRegistry.set(id, verified)

    logging.log(`{"EVENT_JSON":{
      "standard":"nep171",
      "version":"1.0.0",
      "event":"changeIdVerificationStatus",
      "data":{
        "id":"${id}",
        "time":${Context.blockTimestamp},
        "verified":${verified},
        "changedBy":"${Context.predecessor}"
      }}}`)

    return true
  }
 return false
}

export function changeIdTier(id: string, tier: string): boolean {
  assert(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor), 'not an approved verifier or admin')
  if(whitelistedVerifiers.contains(Context.predecessor) || admins.has(Context.predecessor)){
    tiers.set(id, tier)

    logging.log(`{"EVENT_JSON":{
      "standard":"nep171",
      "version":"1.0.0",
      "event":"changeIdTier",
      "data":{
        "accountId":"${id}",
        "time":${Context.blockTimestamp},
        "tier":${tier},
        "changedBy":"${Context.predecessor}"
      }}}`)

    return true
  }
 return false
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