/**
 * This test demonstrates basic behavior of near-runner, making simple
 * function calls and view calls to the contract from
 * https://github.com/near-examples/rust-status-message
 *
 * Note that the same tests will be run on both a local sandbox environment and
 * on testnet by using the `test:sandbox` and `test:testnet` scripts in
 * package.json.
 */
 import path from 'path';
 import {Runner, toYocto} from 'near-runner';
 import { DaoModel } from '../contracts/factory/assembly';

 const TEN_NEAR = toYocto("10");
 
 describe(`Running on ${Runner.getNetworkFromEnv()}`, () => {
   let runner: Runner;
   jest.setTimeout(60_000);
 
   beforeAll(async () => {
     runner = await Runner.create(async ({root}) => ({
       contract: await root.createAndDeploy(
         'factory',
         path.join(__dirname, '..','build', 'release', 'factory.wasm'),
       ),
     }));
   });
 
   test('Doa list should be empty', async () => {
     await runner.run(async ({contract, root}) => {
       expect(await contract.view("getDaoListLength")).toBe(0);
       expect(await contract.view("getDaoIndex", {accountId: root})).toBe(-1);
     });
   });

   test('Can create a dao', async () => {
    await runner.run(async ({contract, root}) => {
      await root.call(contract, "createDAO", {
        accountId: root,
        deposit: TEN_NEAR
      }, {
        attachedDeposit: TEN_NEAR
      })
      expect(await contract.view("getDaoListLength")).toBe(1);
      const index = await contract.view("getDaoIndex", {accountId: root}) as number;
      expect(index).toBe(0);
      const daoList = await contract.view("getDaoList", {start: index, end: index}) as DaoModel[];
      expect(daoList[0].contractId).toBe(root.accountId);
    });
  });
 });
 