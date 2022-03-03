@nearBindgen
export class registrationArgs {
  constructor(
    public accountId: string,
    public did: string,
    public type: string
)
{}
}

@nearBindgen
export class unregisterArgs {
  constructor(
    public accountId: string,
)
{}
}