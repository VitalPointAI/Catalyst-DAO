@nearBindgen
export class FTModel {
  constructor (
    public contractId: string,
    public created: u64,
    public creator: string,
    public status: string
  )
  {}
}