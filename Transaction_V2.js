const axios = require('axios');
const Cardano = require('cardano-wallet');
const { local } = require('./env.json')
const Bignumber = require('bignumber.js')

const feeAddressInitial = {
  publicAddress: '2cWKMJemoBakpjUvY8RNWQvn6wJF8Fzg53JHLmdJgQMTpCrAiVFX2axTFfjrYD2iHczGd',
  privateKey: '00992d1208ce0029e31f0b6a5e8d3cd9b2beeafdd273673d5d3adf49c768e95491a49b8d6db0ceb9225bdbbdcdcb757c3dec0a3c3c3a6fae7a9122e23823d4461b4471ad1db174220c5047c0a16a3022140e8746db9cdba73a0c184aa54bcdf5',
  utxos: undefined,
  balance: 0,
  currentBlock: -1
}

const PROTOCOL_MAGICS = { mainnet: 764824073, testnet: 1097911063 }

class Transaction {
  constructor() {
    this.feeData = feeAddressInitial
  }

  async getBlockHeight() {
    const { status, data } = await axios({
      method: 'get',
      url: `${local.explorerUrl}/api/blocks/pages/total`
    })
    if (status === 200 && data.Right) {
      return data.Right + 1
    } else {
      throw new Error('Error when get block!')
    }
  }

  async getBalance(address, utxos) {
    let balance = 0
    if (!utxos) {
      utxos = await this.cardanoApi.getUtxos(address)
    }
    balance = utxos.reduce((accumulator, currentValue) => {
      return Bignumber(accumulator).plus(currentValue.coin)
    }, 0)
    return balance.toString()
  }


  async getUtxos(address) {
    const { status, data } = await axios({
      method: 'get',
      url: `${local.bridgeUrl}/testnet/utxos/${address}`
    });
    if (status === 200) {
      return data;
    } else {
      throw new Error('has an Error when get utxos');
    }
  }

  async _getFeeData() {
    const blockHeight = await this.getBlockHeight();
    if (this.feeData.currentBlock < blockHeight) {
      this.feeData.currentBlock = blockHeight;
      this.feeData.utxos = await this.getUtxos(this.feeData.publicAddress);
      this.feeData.balance = await this.getBalance(this.feeData.publicAddress, this.feeData.utxos);
    }
    return this.feeData;
  }
  async sendMoney(privateKey, fromAddress, toAddress, amount) {
    const feeData = await this._getFeeData()
    console.log(feeData);
    if (fromAddress === feeData.publicAddress) {
      throw new Error('fromAddress must be not equal feeAddress')
    }
    const utxos = await this.getUtxos(fromAddress);
    const fee_algorithm = Cardano.LinearFeeAlgorithm.default();
    const feeAda = this._estimateFee(fee_algorithm, utxos, toAddress, amount, feeData.publicAddress, feeData.utxos, feeData.balance);
    console.log("FEE", feeAda);
    console.log("BALANCE", feeData.balance);
    const balanceSendBack = Bignumber(feeData.balance).minus(Bignumber(feeAda))
    console.log(balanceSendBack);
    if (balanceSendBack < 0) {
      throw new Error('feeData not enough')
    }
    const txBuilder = this._getUnsignedTx(utxos, toAddress, amount, feeData.publicAddress, feeData.utxos, balanceSendBack.toString())
    const unsignedTx = txBuilder.make_transaction();
    const txFinalizer = new Cardano.TransactionFinalized(unsignedTx)
    const setting = Cardano.BlockchainSettings.from_json({
      protocol_magic: PROTOCOL_MAGICS.testnet
    });

    // sign Transaction
    utxos.forEach(() => {
      const witness = Cardano.Witness.new_extended_key(
        setting,
        Cardano.PrivateKey.from_hex(privateKey),
        txFinalizer.id()
      );
      txFinalizer.add_witness(witness);
    });
    feeData.utxos.forEach(() => {
      const witness = Cardano.Witness.new_extended_key(
        setting,
        Cardano.PrivateKey.from_hex('00992d1208ce0029e31f0b6a5e8d3cd9b2beeafdd273673d5d3adf49c768e95491a49b8d6db0ceb9225bdbbdcdcb757c3dec0a3c3c3a6fae7a9122e23823d4461b4471ad1db174220c5047c0a16a3022140e8746db9cdba73a0c184aa54bcdf5'),
        txFinalizer.id()
      );
      txFinalizer.add_witness(witness);
    });

    console.log("transaction id: ", txFinalizer.id().to_hex());
    const signedTx = txFinalizer.finalize();
    const signedTxString = Buffer.from(signedTx.to_hex(), 'hex').toString('base64');

    console.log("ready to send transaction: ", Buffer.from(signedTx.to_hex(), 'hex').toString('base64'));

    // return { id: txFinalizer.id().to_hex(), signedTx: signedTxString }
  }
  _getUnsignedTx(utxos, toAddress, amount, feeAddress, feeUtxos, balanceSendBack) {
    const fee_algorithm = Cardano.LinearFeeAlgorithm.default();
    let txBuilder = new Cardano.TransactionBuilder();

    const changeAddress = Cardano.Address.from_base58(utxos[0].address);
    const outputPolicy = Cardano.OutputPolicy.change_to_one_address(changeAddress);
    this._addTxInputs(txBuilder, utxos);
    this._addOutput(txBuilder, toAddress, amount);

    if (feeAddress && feeUtxos && balanceSendBack) {
      this._addTxInputs(txBuilder, feeUtxos);
      this._addOutput(txBuilder, feeAddress, balanceSendBack);
    }

    this._addOutputPolicy(txBuilder, fee_algorithm, outputPolicy);
    return txBuilder;
  }

  _addOutputPolicy(txBuilder, fee_algorithm, outputPolicy) {
    txBuilder.apply_output_policy(
      fee_algorithm,
      outputPolicy
    );
  }

  _estimateFee(fee_algorithm, utxos, receiver, amount, feeAddress, utxosFeeAddress, balanceFeeAddress) {
    const temp_builder = new Cardano.TransactionBuilder();
    this._addTxInputs(temp_builder, utxos);
    this._addOutput(temp_builder, receiver, amount);

    if (feeAddress && utxosFeeAddress && balanceFeeAddress) {
      this._addTxInputs(temp_builder, utxosFeeAddress);
      this._addOutput(temp_builder, feeAddress, balanceFeeAddress);
    }

    const fee = temp_builder.estimate_fee(fee_algorithm);
    return Bignumber(fee.to_str()).multipliedBy(1000000).toString();
  }

  _addTxInputs(txBuilder, utxos) {
    utxos.forEach(utxo => {
      const pointer = Cardano.TxoPointer.from_json({
        id: utxo.txid,
        index: utxo.index
      });
      const value = Cardano.Coin.from_str(utxo.coin);
      txBuilder.add_input(pointer, value);
    });
  }

  _addOutput(txBuilder, receiver, amount) {
    const txout = Cardano.TxOut.from_json({
      address: receiver,
      value: amount.toString()
    });
    txBuilder.add_output(txout);
  }
}

const transactionZ = new Transaction();

const testData = {
  priv: '68e9f45c830479253d1e941dd6bf2b93eb0042cf0a1511ed64eb64b0c368e954b0dc56d5e1612f568ef6c3c5f7fabd96d8ae7bdf3e0ad8c47c010cd9459cc5b7c30454b862fb6305382a3340386768062d1e2ef1f32004a867c926390d7b2f93',
  pub: '2cWKMJemoBahooVbkiNtGArVwWYryUk9okwY5Zrz7ksgU7ALq8kY1sRD9YoMrhw6Vthpd',
  to: '2cWKMJemoBajK195n1KRQx1FvCfWtREm67qy9MDxJrHKqvgLzy7kvnpABSUfgHp5MENm8',
  amount: '1000000'
}
transactionZ.sendMoney(testData.priv, testData.pub, testData.to, testData.amount);

module.exports = Transaction;