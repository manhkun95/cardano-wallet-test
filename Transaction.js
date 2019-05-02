const axios = require('axios');
const Cardano = require('cardano-wallet');
const { local } = require('./env.json')

const PROTOCOL_MAGICS = { mainnet: 764824073, testnet: 1097911063 }

class Transaction {
  async getUtxos(address) {
    const { status, data } = await axios({
      method: 'get',
      url: `${local.bridgeUrl}/testnet/utxos/${address}`
    });
    if (status === 200) {
      console.log(data);
      return data;
    } else {
      throw new Error('has an Error when get utxos');
    }
  }

  async sendTx(signedTx) {
    const { status, data } = await axios({
      method: 'post',
      url: `${local.bridgeUrl}/testnet/utxos/${address}`,
      data: { signedTx }
    });
    if (status === 200) {
      console.log(data);
      return data;
    } else {
      throw new Error('has an Error when get utxos');
    }
  }

  getUnsignedTx(utxos, receiver, amount) {
    const fee_algorithm = Cardano.LinearFeeAlgorithm.default();
    let txBuilder = new Cardano.TransactionBuilder();

    const changeAddress = Cardano.Address.from_base58(utxos[0].sender);
    const outputPolicy = Cardano.OutputPolicy.change_to_one_address(changeAddress);

    const selectInputs = this.selectInputs(utxos, receiver, amount, fee_algorithm, outputPolicy);
    this.addTxInputs(txBuilder, selectInputs);
    this.addOutput(txBuilder, receiver, amount);
    this.addOutputPolicy(txBuilder, fee_algorithm, outputPolicy);
    console.log(txBuilder.estimate_fee(fee_algorithm).to_str())
    console.log(txBuilder.get_input_total().to_str())
    console.log(txBuilder.get_output_total().to_str())
    return { txBuilder, selectInputs };
  }

  sendMoney(privateKey, sender, receiver, amount) {
    this.getUtxos(sender).then((utxos) => {
      let inputs = [];
      for (let i = 0; i < utxos.length; i++) {
        const { cuId, cuOutIndex, cuCoins: { getCoin }, cuAddress } = utxos[i];
        inputs.push({
          sender: cuAddress,
          pointer: { id: cuId, index: cuOutIndex },
          value: getCoin
        })
      }
      const fee_algorithm = Cardano.LinearFeeAlgorithm.default();
      const fee = this.estimateFee(fee_algorithm, utxos, receiver, amount);
      const result = await this.signedTx({ sender: privateKey }, utxos, receiver, amount - fee);
      console.log(result);
    });

  }

  async signedTx(privateKeyObj, utxos, receiver, amount) {
    if (!utxos.length) {
      throw new Error('Don\'t have utxos!');
    }
    const { txBuilder, selectInputs } = this.getUnsignedTx(utxos, receiver, amount);
    const unsignedTx = txBuilder.make_transaction();
    const txFinalizer = new Cardano.TransactionFinalized(unsignedTx);
    const setting = Cardano.BlockchainSettings.from_json({
      protocol_magic: PROTOCOL_MAGICS.testnet
    });

    // sign Transaction
    selectInputs.forEach(selectInput => {

      const witness = Cardano.Witness.new_extended_key(
        setting,
        Cardano.PrivateKey.from_hex(privateKeyObj[selectInput.sender]),
        txFinalizer.id()
      );
      txFinalizer.add_witness(witness);
    });

    const signedTx = txFinalizer.finalize();
    console.log("ready to send transaction: ", Buffer.from(signedTx.to_hex(), 'hex').toString('base64'));
    return await sendTx(signedTx);
  }

  selectInputs(inputs, receiver, amount, fee_algorithm, outputPolicy) {
    const inputSelection = Cardano.InputSelectionBuilder.first_match_first();

    this.utxoToTxInput(inputSelection, inputs);
    this.addOutput(inputSelection, receiver, amount);

    const selectionResult = inputSelection.select_inputs(fee_algorithm, outputPolicy);

    const senderInputs = inputs.filter(input => (
      selectionResult.is_input(
        Cardano.TxoPointer.from_json(input.pointer)
      )
    ));
    return senderInputs;
  }

  addOutputPolicy(txBuilder, fee_algorithm, outputPolicy) {
    txBuilder.apply_output_policy(
      fee_algorithm,
      outputPolicy
    );
  }

  estimateFee(fee_algorithm, utxos, receiver, amount) {
    const temp_builder = new Cardano.TransactionBuilder();
    this.addTxInputs(temp_builder, utxos);
    this.addOutput(temp_builder, receiver, amount);
    return temp_builder.estimate_fee(fee_algorithm).lovelace();
  }

  addTxInputs(txBuilder, utxos) {
    utxos.forEach(utxo => {
      const pointer = Cardano.TxoPointer.from_json(utxo.pointer);
      const value = Cardano.Coin.from_str(utxo.value);
      txBuilder.add_input(pointer, value);
    });
  }

  addOutput(txBuilder, receiver, amount) {
    const txout = Cardano.TxOut.from_json({
      address: receiver,
      value: amount.toString()
    });
    txBuilder.add_output(txout);
  }

  utxoToTxInput(inputSelection, utxos) {
    utxos.forEach(utxo => {
      const txoPointer = Cardano.TxoPointer.from_json(utxo.pointer);
      const txOut = Cardano.TxOut.new(
        Cardano.Address.from_base58(utxo.sender),
        Cardano.Coin.from_str(utxo.value.toString()),
      );
      inputSelection.add_input(Cardano.TxInput.new(txoPointer, txOut));
    });
  }
}

const transaction = new Transaction();
transaction.getUtxos('2cWKMJemoBakUycfSxBSjvukHYk45qU1S7tmuE8uk68vC2qVjTB8zkpwcrevdoQyJGUNj').then((utxos) => {
  let inputs = [];
  for (let i = 0; i < utxos.length; i++) {
    const { cuId, cuOutIndex, cuCoins: { getCoin }, cuAddress } = utxos[i];
    inputs.push({
      sender: cuAddress,
      pointer: { id: cuId, index: cuOutIndex },
      value: getCoin
    })
  }
  transaction.signedTx({ "2cWKMJemoBakUycfSxBSjvukHYk45qU1S7tmuE8uk68vC2qVjTB8zkpwcrevdoQyJGUNj": "004342b541c0f14f7b090b0f465d051db1fc5c94d6b58c8660fc727199a88158e9397a0b3ca15adc03b1a1e900f1e03d0a835cdfab606b10a5ddce768c627ff2233ca61f9df87c74465f0b49877b305001d1982aabdc3bcd8a54b58909e8782c" }, inputs, '2cWKMJemoBahjEXTGWUh8mtfZMTrNRXZjPLUkrYa2E4YFR1duyEWsKXoUfYXjRoQkJw7Q', 1071688);
});

module.exports = Transaction;