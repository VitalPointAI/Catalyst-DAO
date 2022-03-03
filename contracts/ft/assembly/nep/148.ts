import { storage } from "near-sdk-as";

//NEP-148
@nearBindgen
export class FungibleTokenMetadata {

    constructor(
        public spec: string,
        public name: string,
        public symbol: string,
        public icon: string,
        public reference: string,
        public reference_hash: string,
        public decimals: u8) {
    }
}

export function ft_metadata_impl(): FungibleTokenMetadata {
    return storage.getSome<FungibleTokenMetadata>("metadata");
}