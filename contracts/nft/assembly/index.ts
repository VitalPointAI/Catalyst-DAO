import { AVLTree, ContractPromise, ContractPromiseBatch, PersistentMap, Context, u128, env, storage, logging } from 'near-sdk-as'
import { approvedTokens } from '../../catalystdao/assembly/dao-models';
import { AccountId, TokenId } from './types'
import { 
  Token,
  tokenRegistry
 } from './model';
import {
  ERR_INVALID_ACCOUNT,
  ERR_INVALID_APPROVAL_ID,
  ERR_NOT_OWNER,
  assertValidId,
  assertApprovalId,
  assertIsDifferent,
  isOwner,
  isSelf,
  predecessor,
} from './utils'

/******************/
/* CORE NEP-171   */
/******************/

/******************/
/* CHANGE METHODS */
/******************/

/**
* No return value
* Transfers a token from current owner to new owner 
* @param receiver_id // valid NEAR account receiving the token
* @param token_id // the token to transfer
* @param approval_id // optional - used if expected approval ID from Approval Management
* @param memo // optional - for use cases that may benefit from indexing or providing info on the transfer
*/
export function nft_transfer(
  receiver_id: AccountId,
  token_id: TokenId,
  approval_id: u64 | null,
  memo: string | null
) : void {
  oneYocto()
  isOwner(token_id, predecessor())
  assertValidId(receiver_id)
  if(approval_id){
    assertApprovalId(approval_id)
  }
  assertIsDifferent(receiver_id)
  
  _nft_transfer(receiver_id, token_id, approval_id, memo)
}


/**
* Returns true if token is successfully transferred from the sender's account
* Transfer token and call on a receiver contract.  A successful outcome ends in a
* callback on the NFT contract at the method nft_resolve_transfer
* @param receiver_id // valid NEAR account receiving the token
* @param token_id // the token to transfer
* @param approval_id // optional - used if expected approval ID from Approval Management
* @param memo // optional - for use cases that may benefit from indexing or providing info on the transfer
* @param msg // info needed by the receiving contract to properly handle the transfer.
*               Can be both a function call and parameters to pass to that function.
*/
export function nft_transfer_call(
  receiver_id: AccountId,
  token_id: TokenId,
  approval_id: u64 | null,
  memo: string | null,
  msg: string
) : boolean {
  oneYocto()
  isOwner(token_id, predecessor())
  assertValidId(receiver_id)
  if(approval_id){
    assertApprovalId(approval_id)
  }
  assertIsDifferent(receiver_id)
  
  return _nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
}


/****************/
/* VIEW METHODS */
/****************/

/**
* Returns the token with given id token_id or null if no such token
* @param token_id // the token to transfer
*/

export function nft_token(token_id: TokenId): Token | null {
  return _getNFTToken(token_id: TokenId)
}

/******************/
/* IMPLEMENTATION */
/******************/

function _nft_transfer(
  receiver_id: string,
  token_id: string,
  approval_id: u64 | null,
  memo: string | null
) : void {

}

function _nft_transfer_call(
  receiver_id: string,
  token_id: string,
  approval_id: u64 | null,
  memo: string | null,
  msg: string
) : boolean {
  return ContractPromise.returnAsResult()
}

function _getNFTToken(tokenId: TokenId) : TokenId | null {
  return tokenRegistry.get(tokenId, null)
}