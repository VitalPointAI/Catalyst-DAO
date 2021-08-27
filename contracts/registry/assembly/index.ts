import { PersistentMap, env, Context } from 'near-sdk-as'

const didRegistry = new PersistentMap<string, string>('d')
const aliasRegistry = new PersistentMap<string, string>('a')

//DID Registry
//
// accountId: someaccount e.g. vitalpointai.near
// did: decentralized identifier e.g., did:key:z6Mkw1Mpfejq2R76AsQo2qJoAVaF6HH5nLDoHrKrsW5Wdnei

export function getDID(accountId: string) : string {
  //assert(env.isValidAccountID(accountId), 'not a valid near account') // Isn't this guarded at insertion?
  const did = didRegistry.get(accountId);
  assert(did != null, 'no did registered for this near account')
  return did as string; // ! in TS asserts that the value is non-null, but it adds runtime check in AS so casting here does the trick.
}

export function hasDID(accountId: string) : bool {
  return didRegistry.contains(accountId);
}

export function putDID(accountId: string, did: string): bool {
  assert(Context.sender == Context.predecessor, 'only account owner can register or change their associated DID in the registry')
  assert(env.isValidAccountID(accountId), 'not a valid near account')
  didRegistry.set(accountId, did) // Any validation needed on the DID?
  return true
}

export function deleteDID(accountId: string): bool {
  assert(Context.sender == Context.predecessor, 'only account owner can delete their DID from the registry')
  //assert(env.isValidAccountID(accountId), 'not a valid NEAR account') // again not needed
  didRegistry.delete(accountId)
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

export function storeAlias(alias: string, definition: string): bool {
  assert(!aliasRegistry.contains(alias), 'alias already registered')
  aliasRegistry.set(alias, definition)
  return true
}

export function deleteAlias(owner: string, alias: string): bool {
  assert(owner == Context.predecessor, 'only alias owner can delete if from the registry')
  assert(aliasRegistry.contains(alias), 'alias is not registered')
  aliasRegistry.delete(alias)
  return true
}