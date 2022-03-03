@nearBindgen
export class logPutDID {
  constructor(
    public accountId: string,
    public did: string
  )
  {}
}

@nearBindgen
export class logDeleteDID {
    constructor(
        public accountId: string,
        public did: string,
        public memo: string
    )
    {}
}

@nearBindgen
export class logStoreAlias {
    constructor(
        public alias: string,
        public definition: string,
        public description: string
    )
    {}
}

@nearBindgen
export class logDeleteAlias {
    constructor(
        public owner: string,
        public alias: string,
        public memo: string
    )
    {}
}