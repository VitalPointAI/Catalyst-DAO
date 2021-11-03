import {
  AccountId,
  TokenId
} from './types'

// Data Storage

import { PersistentMap } from "near-sdk-core"

/**token Id to account Id*/
export const tokenRegistry = new PersistentMap<TokenId, AccountId>('t')

@nearBindgen
export class Token {
  constructor (
    public id: string,
    public owner_id: string,
  )
  {}
}