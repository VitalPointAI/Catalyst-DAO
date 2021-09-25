/**
 * This test demonstrates basic behavior of near-runner, making simple
 * function calls and view calls to the contract from
 * https://github.com/near-examples/rust-status-message
 *
 * Note that the same tests will be run on both a local sandbox environment and
 * on testnet by using the `test:sandbox` and `test:testnet` scripts in
 * package.json.
 */
import path from "path";
import { NearAccount, Runner } from "near-runner-jest";
import { NEAR, Gas } from "near-units";
import { DaoModel } from "../contracts/factory/assembly/model";
import * as fs from "fs/promises";

const TEN_NEAR = NEAR.parse("10 N");

async function deleteBinary(root: NearAccount, contract: NearAccount): Promise<void> {
  await root.call(contract, 'deleteBinary', {});
}

const runner = Runner.create(async ({ root }) => {
  const contract =  await root.createAndDeploy(
      "factory",
      path.join(__dirname, "..", "build", "release", "factory.wasm"),
      { method: "init", args: { ownerId: root } }
  );
  await root
    .createTransaction(contract)
    .functionCall(
      "setBinary",
      await fs.readFile(
        path.join(__dirname, "..", "build", "release", "catalystdao.wasm")
      )
    )
    .signAndSend();
  return {contract};
});

describe(`Running on ${Runner.getNetworkFromEnv()}`, () => {
  runner.test("Dao list should be empty", async ({ contract, root }) => {
    expect(await contract.view("getDaoListLength")).toBe(0);
    expect(await contract.view("getDaoIndex", { accountId: root })).toBe(-1);
    await deleteBinary(root, contract)
  });

  runner.test("Can create a dao", async ({ contract, root }) => {
    await root.call(
      contract,
      "createDAO",
      {
        accountId: root,
        deposit: TEN_NEAR,
      },
      {
        attachedDeposit: TEN_NEAR,
      }
    );
    expect(await contract.view("getDaoListLength")).toBe(1);
    const index = (await contract.view("getDaoIndex", {
      accountId: root,
    })) as number;
    expect(index).toBe(0);
    const daoList = (await contract.view("getDaoList", {
      start: index,
      end: index,
    })) as DaoModel[];
    expect(daoList[0].contractId).toBe(root.accountId);

    //need to remove binary since it's now too big do be deleted on testnet
    await deleteBinary(root, contract)
  });
});
