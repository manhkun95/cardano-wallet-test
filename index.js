const Cardano = require("cardano-wallet");

const MNEMONICS = "uniform can obvious dry sadness abuse wet wife marriage employ tornado analyst";
const PASSWORD = "";
const PROTOCOL_MAGICS = { mainnet: 764824073, testnet: 1097911063 }

// to connect the wallet to mainnet
let settings = Cardano.BlockchainSettings.from_json({ protocol_magic: PROTOCOL_MAGICS.testnet });

// recover the entropy
let entropy = Cardano.Entropy.from_english_mnemonics(MNEMONICS);

// recover the wallet
let wallet = Cardano.Bip44RootPrivateKey.recover(entropy, PASSWORD);

console.log('masterkey:', wallet.key().to_hex());

// create a wallet account
let account = wallet.bip44_account(Cardano.AccountIndex.new(0 | 0x80000000));
let account_public = account.public();

// private key
let key_prv = account.address_key(false, Cardano.AddressKeyIndex.new(0));
// create an address
let key_pub = account_public.address_key(false, Cardano.AddressKeyIndex.new(0));
let address = key_pub.bootstrap_era_address(settings);

console.log("Address m/bip44/ada/'0/0/0", address.to_base58());

// assuming the xprv and the settings from the example above are available in this scope

const inputs = [
    { pointer: { id: "477ccef98d9ada15e4e6b7906301c720eaec0a98bb0fad91c7de02fa4ad50d52", index: 1 }, value: '100048' },
    // { pointer: { id: "9e63eb9cc2322f5f00bfb7953274d03683979e4118ae01eebe62360171b1419a", index: 1 }, value: '348170048' },
    // { pointer: { id: "0def10fc91ccf33498e45694b13ef8992ef3d4174cb34e9df827c75f7f913de8", index: 1 }, value: '100000000' }
];
const outputs = [
    { address: "2cWKMJemoBahvvHPYGJW3Y7Z21CyittjXddtVzELySKPVBiT38eAA9NJrUi3rpwMG7yYV", value: "50048" }
];

// the fee algorithm (i.e. the function to compute the fees of a transaction)
const fee_algorithm = Cardano.LinearFeeAlgorithm.default();
console.log('FEE:', fee_algorithm);

// let transaction_builder = new Cardano.TransactionBuilder();

// for (let index = 0; index < inputs.length; index++) {
//     const pointer = Cardano.TxoPointer.from_json(inputs[index].pointer);
//     const value = Cardano.Coin.from(inputs[index].value / 1000000, inputs[index].value % 1000000);
//     transaction_builder.add_input(pointer, value);
// }

// console.log("all inputs set...", transaction_builder.get_input_total().to_str());

// for (let index = 0; index < outputs.length; index++) {
//     const txout = Cardano.TxOut.from_json(outputs[index]);
//     console.log("txout", txout);
//     transaction_builder.add_output(txout);
// }

// console.log("all outputs set...", transaction_builder.get_output_total().to_str());

// const changeAddress = Cardano.Address.from_base58('37btjrVyb4KFjdxHNcXsq2dVkfnTCPdrhjaAeZXpjmWvATrAt7G7fPNMZQEAVAbjD3dRUFhGKZETzEDUKsd8kYaB5pDXhFwUpscANTW7DhkQbP3WDn');
// console.log('ADDRESS:', Cardano.Address.from_base58('37btjrVyb4KFjdxHNcXsq2dVkfnTCPdrhjaAeZXpjmWvATrAt7G7fPNMZQEAVAbjD3dRUFhGKZETzEDUKsd8kYaB5pDXhFwUpscANTW7DhkQbP3WDn'))

// const outputPolicy = Cardano.OutputPolicy.change_to_one_address(changeAddress);

// const inputSelection = Cardano.InputSelectionBuilder.first_match_first();

// for (let index = 0; index < inputs.length; index++) {
//     const txoPointer = Cardano.TxoPointer.from_json(inputs[index].pointer);
//     const txOut = Cardano.TxOut.new(
//         Cardano.Address.from_base58('37btjrVyb4KFjdxHNcXsq2dVkfnTCPdrhjaAeZXpjmWvATrAt7G7fPNMZQEAVAbjD3dRUFhGKZETzEDUKsd8kYaB5pDXhFwUpscANTW7DhkQbP3WDn'),
//         Cardano.Coin.from_str(inputs[index].value.toString()),
//       );
//     // const value = Cardano.Coin.from(inputs[index].value / 1000000, inputs[index].value % 1000000);
//     inputSelection.add_input(Cardano.TxInput.new(txoPointer, txOut));
// }

// const txOut = Cardano.TxOut.new(
//     Cardano.Address.from_base58(outputs[0].address),
//     Cardano.Coin.from_str(outputs[0].value),
//   );

// inputSelection.add_output(txOut);

// const selectionResult = inputSelection.select_inputs(fee_algorithm, outputPolicy);

// console.log(inputSelection);

// const senderInputs = inputs.filter(input => (
//     selectionResult.is_input(
//         Cardano.TxoPointer.from_json(input.pointer)
//     )
//   ));

// console.log('SENDER INPUT:', senderInputs);

// let transaction_builder = new Cardano.TransactionBuilder();
// for (let index = 0; index < inputs.length; index++) {
//     const pointer = Cardano.TxoPointer.from_json(inputs[index].pointer);
//     const value = Cardano.Coin.from(inputs[index].value / 1000000, inputs[index].value % 1000000);
//     transaction_builder.add_input(pointer, value);
// }

// console.log("all inputs set...", transaction_builder.get_input_total().to_str());

// for (let index = 0; index < outputs.length; index++) {
//     const txout = Cardano.TxOut.from_json(outputs[index]);
//     console.log("txout", txout);
//     transaction_builder.add_output(txout);
// }

// transaction_builder.apply_output_policy(
//     fee_algorithm,
//     outputPolicy
//   );

const esFee = estimateFee(inputs, '2cWKMJemoBahvvHPYGJW3Y7Z21CyittjXddtVzELySKPVBiT38eAA9NJrUi3rpwMG7yYV', 208170048)
console.log('ESFEE:', esFee);
let temp_builder = new Cardano.TransactionBuilder();
for (let index = 0; index < inputs.length; index++) {
    const pointer = Cardano.TxoPointer.from_json(inputs[index].pointer);
    const value = Cardano.Coin.from_str(inputs[index].value);
    temp_builder.add_input(pointer, value);
}

console.log("all inputs set...", temp_builder.get_input_total().to_str());

const fee0 = temp_builder.estimate_fee(fee_algorithm).lovelace();

console.log('FEE0:', fee0);

const txout = Cardano.TxOut.from_json({
    address: '2cWKMJemoBahvvHPYGJW3Y7Z21CyittjXddtVzELySKPVBiT38eAA9NJrUi3rpwMG7yYV',
    value: (648170048 - esFee).toString()
});
temp_builder.add_output(txout);

// for (let index = 0; index < outputs.length; index++) {
//     const txout = Cardano.TxOut.from_json(outputs[index]);
//     temp_builder.add_output(txout);
// }

const balance = temp_builder.get_balance(fee_algorithm);

console.log("BALANCE:", balance.value().to_str());

const fee = temp_builder.estimate_fee(fee_algorithm).lovelace();

console.log('FEE1:', fee);

// get balance
// check if < 0 => error
// minus fee
// reset output with fee
// apply_output_policy
// sendTransaction




// // verify the balance and the fees:
// const balance = transaction_builder.get_balance(fee_algorithm);
// console.log("BALANCE:", balance);
// console.log("ESTIMATE_FEE:", transaction_builder.estimate_fee(fee_algorithm).to_str());
// if (balance.is_negative()) {
//     console.error("not enough inputs, ", balance.value().to_str());
//     throw Error("Not enough inputs");
// } else {
//     if (balance.is_zero()) {
//         console.info("Perfect balance no dust");
//     } else {
//         console.warn("Loosing some coins in extra fees: ", balance.value().to_str());
//     }
// }

// // Warning: this function does not throw exception if the transaction is not
// // balanced. This is your job to make sure your transaction's inputs and outputs
// // and fees are balanced.
// let transaction = transaction_builder.make_transaction();

// console.log("unsigned transaction built", transaction);

// let transaction_finalizer = new Cardano.TransactionFinalized(transaction);

// console.log("transaction finalizer built", transaction_finalizer);

// for (let index = 0; index < inputs.length; index++) {
//     transaction_finalizer.sign(settings, key_prv);
//     console.log("signature ", index, "added");

// }

// // at this stage the transaction is ready to be sent
// const signed_transaction = transaction_finalizer.finalize();
// console.log("ready to send transaction: ", Buffer.from(signed_transaction.to_hex(), 'hex').toString('base64'));
// console.log(signed_transaction.to_json());
console.log(estimateFee(inputs, '2cWKMJemoBahvvHPYGJW3Y7Z21CyittjXddtVzELySKPVBiT38eAA9NJrUi3rpwMG7yYV', 208170048));

function estimateFee(utxos, receiver, amount) {
    const temp_builder = new Cardano.TransactionBuilder();
    for (let index = 0; index < utxos.length; index++) {
        const pointer = Cardano.TxoPointer.from_json(utxos[index].pointer);
        const value = Cardano.Coin.from_str(utxos[index].value);
        temp_builder.add_input(pointer, value);
    }
    const txout = Cardano.TxOut.from_json({
        address: receiver,
        value: amount.toString()
    });
    temp_builder.add_output(txout);
    return  temp_builder.estimate_fee(fee_algorithm).lovelace();
}

