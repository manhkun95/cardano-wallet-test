const axios = require('axios');
const Cardano = require('cardano-wallet');
const { local } = require('./env.json')
const Bignumber = require('bignumber.js')

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

  async sendTx(signedTx, i, id, out) {
    console.log(i, signedTx);
    try {
      const { status, data } = await axios({
        method: 'post',
        url: `${local.bridgeUrl}/testnet/txs/signed`,
        data: { signedTx }
      });
      if (status === 200) {
        console.log(data);
        return [id, out];
      } else {
        throw new Error('has an Error when sendTX');
      }
    } catch (error) {
      console.log("ERRRRR:", error.message);
      if (i < 10) {
        return await this.sendTx(signedTx, i + 1, id, out)
      }

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

  // receiver pay for fee
  async sendMoney(privateKey, sender, receiver, amount) {
    this.getUtxos(sender).then(async (utxos) => {
      let inputs = [];
      for (let i = 0; i < utxos.length; i++) {
        const { txid, index, coin, address } = utxos[i];
        inputs.push({
          sender: address,
          pointer: { id: txid, index },
          value: coin
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
    const output = txBuilder.get_output_total().to_str();
    console.log(output);
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

    const id = txFinalizer.id().to_hex()
    console.log("transaction id: ", txFinalizer.id().to_hex());
    const signedTx = txFinalizer.finalize();
    const signedTxString = Buffer.from(signedTx.to_hex(), 'hex').toString('base64');

    console.log("ready to send transaction: ", Buffer.from(signedTx.to_hex(), 'hex').toString('base64'));

    const data = await this.sendTx(signedTxString, 0, id, ((output * 1000000) - 1168609).toString() )
    return data
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
// transaction.getUtxos('2cWKMJemoBajb7eesvEnLBupWBr6oH81TGYyH81dVWUvSX7TRvPdYb1NMXtfHpibnZiXr').then((utxos) => {
//   let inputs = [];
//   for (let i = 0; i < utxos.length; i++) {
//     const { txid, index, coin, address } = utxos[i];
//     inputs.push({
//       sender: address,
//       pointer: { id: txid, index },
//       value: coin
//     })
//   }
//   transaction.signedTx({ "2cWKMJemoBajb7eesvEnLBupWBr6oH81TGYyH81dVWUvSX7TRvPdYb1NMXtfHpibnZiXr": "d80f809e1ec4db79684c0defb55ee066fdee05d0fbc3cc76bd955f87c168e954d746a91e8975bc250eda862be14df0aabf0d7552f01898547698b3fef60bf4780380a0775103f2aefda3aff6bf7892eb3349fe2fbfea0fd4a6acc54f133fd614" }, inputs, '2cWKMJemoBakkdiHyY8Wh1xwB2yr1PDzatKrgmMJa5WBeQwm3xZ1bxPsjsCSZcTQ7LshK', 2000000);
// });

async function test() {
  const inputs1 = [];
  inputs1.push({
    sender: '2cWKMJemoBakpjUvY8RNWQvn6wJF8Fzg53JHLmdJgQMTpCrAiVFX2axTFfjrYD2iHczGd',
    pointer: { id: 'efb501004bebff4acf21072fe48cdb8332a3ea9bacec02f447ea0f9ae4ed3de2', index: 1 },
    value: "1334227058"
  })
  const inputs2 = [];

  const data = await transaction.signedTx({ "2cWKMJemoBakpjUvY8RNWQvn6wJF8Fzg53JHLmdJgQMTpCrAiVFX2axTFfjrYD2iHczGd": "00992d1208ce0029e31f0b6a5e8d3cd9b2beeafdd273673d5d3adf49c768e95491a49b8d6db0ceb9225bdbbdcdcb757c3dec0a3c3c3a6fae7a9122e23823d4461b4471ad1db174220c5047c0a16a3022140e8746db9cdba73a0c184aa54bcdf5" }, inputs1, '2cWKMJemoBakkdiHyY8Wh1xwB2yr1PDzatKrgmMJa5WBeQwm3xZ1bxPsjsCSZcTQ7LshK', 1000000);
  console.log(data);
  inputs2.push({
    sender: '2cWKMJemoBakpjUvY8RNWQvn6wJF8Fzg53JHLmdJgQMTpCrAiVFX2axTFfjrYD2iHczGd',
    pointer: { id: data[0], index: 1 },
    value: data[1]
  })
  transaction.signedTx({ "2cWKMJemoBakpjUvY8RNWQvn6wJF8Fzg53JHLmdJgQMTpCrAiVFX2axTFfjrYD2iHczGd": "00992d1208ce0029e31f0b6a5e8d3cd9b2beeafdd273673d5d3adf49c768e95491a49b8d6db0ceb9225bdbbdcdcb757c3dec0a3c3c3a6fae7a9122e23823d4461b4471ad1db174220c5047c0a16a3022140e8746db9cdba73a0c184aa54bcdf5" }, inputs2, '2cWKMJemoBakkdiHyY8Wh1xwB2yr1PDzatKrgmMJa5WBeQwm3xZ1bxPsjsCSZcTQ7LshK', 1000000);
}

test();

async function getBalance(transaction, address) {
  let balance = 0
  const listUtxo = await transaction.getUtxos(address)
  balance = listUtxo.reduce((accumulator, currentValue) => {
    return Bignumber(accumulator).plus(currentValue.coin)
  }, 0)
  console.log(balance.toString());
  return balance.toString()
}

// getBalance(transaction, '2cWKMJemoBajb7eesvEnLBupWBr6oH81TGYyH81dVWUvSX7TRvPdYb1NMXtfHpibnZiXr')
//   .catch(error => {
//   console.log("EEE", error);
// });

module.exports = Transaction;