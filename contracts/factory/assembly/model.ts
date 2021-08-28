@nearBindgen
export class DaoModel {
  constructor (
    public contractId: string,
    public created: u64,
    public summoner: string
  )
  {}
}