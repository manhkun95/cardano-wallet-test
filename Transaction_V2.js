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
    console.log('BLOCK HEIGHT:', blockHeight);
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
    const feeAlgorithm = Cardano.LinearFeeAlgorithm.default();

    const balanceAddrSend = await this.getBalance(fromAddress, utxos);

    let outputPolicy;
    console.log("FROM:", fromAddress);
    console.log("UTXOS:", utxos);
    console.log("BALANCE SEND", balanceAddrSend);
    console.log("AMOUNT", amount)
    console.log(balanceAddrSend < amount)
    if (Bignumber(balanceAddrSend).isLessThan(Bignumber(amount))) {
      throw new Error('Not enough monney to send')
    }

    const changeAddress = Cardano.Address.from_base58(feeData.publicAddress);
    outputPolicy = Cardano.OutputPolicy.change_to_one_address(changeAddress);

    const feeAda = await this._estimateFee(feeAlgorithm, outputPolicy, fromAddress, utxos, balanceAddrSend, toAddress, amount, feeData.utxos);
    console.log("FEE ESTIMATE", feeAda);
    console.log("BALANCE", feeData.balance);
    const txBuilder = this._getUnsignedTx(feeAlgorithm, outputPolicy, fromAddress, utxos, balanceAddrSend, toAddress, amount, feeData.utxos)
    const unsignedTx = txBuilder.make_transaction();

    const { txid, signedTx } = await this._signedTx(unsignedTx, utxos, privateKey, feeData.utxos, feeData.privateKey);

    await this._sendTx(signedTx, 0);
    this.feeData.utxos = [{
      txid: txid,
      index: 2,
      address: '2cWKMJemoBakpjUvY8RNWQvn6wJF8Fzg53JHLmdJgQMTpCrAiVFX2axTFfjrYD2iHczGd',
      coin: Bignumber(feeData.balance).minus(Bignumber(feeAda))
    }]
    const blockHeight = await this.getBlockHeight();
    console.log('BLOCK HEIGHT SEND:', blockHeight);
    this.feeData.currentBlock = blockHeight;
    return;
    // return { id: txFinalizer.id().to_hex(), signedTx: signedTxString }
  }

  async simpleSendMonney(privateKey, fromAddress, toAddress, amount) {
    const utxos = await this.getUtxos(fromAddress);
    const feeAlgorithm = Cardano.LinearFeeAlgorithm.default();
    const balanceAddrSend = await this.getBalance(fromAddress, utxos);

    let outputPolicy;
    if (Bignumber(balanceAddrSend).isLessThan(Bignumber(amount))) {
      throw new Error('Not enough monney!');
    } else if (Bignumber(balanceAddrSend).isGreaterThan(Bignumber(amount))) {
      const changeAddress = Cardano.Address.from_base58(fromAddress);
      outputPolicy = Cardano.OutputPolicy.change_to_one_address(changeAddress);
    }
    const feeAda = await this._estimateFee(feeAlgorithm, outputPolicy, fromAddress, utxos, balanceAddrSend, toAddress, amount);

    const txBuilder = this._getUnsignedTx(feeAlgorithm, outputPolicy, fromAddress, utxos, balanceAddrSend, toAddress, Bignumber(amount).minus(feeAda).toString())
    const unsignedTx = txBuilder.make_transaction();

    const { txid, signedTx } = await this._signedTx(unsignedTx, utxos, privateKey);

    await this._sendTx(signedTx, 0);
  }

  async _signedTx(unsignedTx, utxos, privateKey, utxosFee, privateKeyFee) {
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
    if (utxosFee) {
      utxosFee.forEach(() => {
        const witness = Cardano.Witness.new_extended_key(
          setting,
          Cardano.PrivateKey.from_hex(privateKeyFee),
          txFinalizer.id()
        );
        txFinalizer.add_witness(witness);
      });
    }
    const txid = txFinalizer.id().to_hex();
    console.log("transaction id: ", txFinalizer.id().to_hex());
    const signedTx = txFinalizer.finalize();
    const signedTxString = Buffer.from(signedTx.to_hex(), 'hex').toString('base64');
    console.log("ready to send transaction: ", Buffer.from(signedTx.to_hex(), 'hex').toString('base64'));
    return { txid, signedTx: signedTxString };
  }

  async _sendTx(signedTx, i) {
    console.log(i + '==========');
    try {
      const { status, data } = await axios({
        method: 'post',
        url: `${local.bridgeUrl}/testnet/txs/signed`,
        data: { signedTx }
      });
      if (status === 200) {
        console.log(data);
        return data;
      } else {
        throw new Error('has an Error when sendTX');
      }
    } catch (error) {
      console.log("ERRRRR:", error.message);
      if (i < 10) {
        return await this._sendTx(signedTx, i + 1)
      }

    }
  }

  _getUnsignedTx(feeAlgorithm, outputPolicy, fromAddress, utxos, balanceAddrSend, toAddress, amount, feeUtxos) {
    let txBuilder = new Cardano.TransactionBuilder();

    this._addTxInputs(txBuilder, utxos);
    this._addOutput(txBuilder, toAddress, amount);

    if (feeUtxos) {
      this._addTxInputs(txBuilder, feeUtxos);
      if (Bignumber(balanceAddrSend).isGreaterThan(Bignumber(amount))) {
        this._addOutput(txBuilder, fromAddress, Bignumber(balanceAddrSend).minus(amount).toString());
      }
    }

    if (outputPolicy) {
      this._addOutputPolicy(txBuilder, feeAlgorithm, outputPolicy);
    }

    console.log('FEE REAL:', txBuilder.estimate_fee(feeAlgorithm).to_str());

    return txBuilder;
  }

  _addOutputPolicy(txBuilder, feeAlgorithm, outputPolicy) {
    txBuilder.apply_output_policy(
      feeAlgorithm,
      outputPolicy
    );
  }

  _estimateFee(feeAlgorithm, outputPolicy, fromAddress, utxos, balanceAddrSend, toAddress, amount, feeUtxos) {
    const tempBuilder = new Cardano.TransactionBuilder();
    this._addTxInputs(tempBuilder, utxos);
    this._addOutput(tempBuilder, toAddress, amount);

    if (feeUtxos) {
      this._addTxInputs(tempBuilder, feeUtxos);
      if (Bignumber(balanceAddrSend).isGreaterThan(Bignumber(amount))) {
        this._addOutput(tempBuilder, fromAddress, Bignumber(balanceAddrSend).minus(amount).toString());
      }
    }

    if (outputPolicy) {
      this._addOutputPolicy(tempBuilder, feeAlgorithm, outputPolicy);
    }

    const fee = tempBuilder.estimate_fee(feeAlgorithm);
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

  _addOutput(txBuilder, toAddress, amount) {
    const txout = Cardano.TxOut.from_json({
      address: toAddress,
      value: amount.toString()
    });
    txBuilder.add_output(txout);
  }
}

const transactionZ = new Transaction();

const testData = {
  priv: '68e9f45c830479253d1e941dd6bf2b93eb0042cf0a1511ed64eb64b0c368e954b0dc56d5e1612f568ef6c3c5f7fabd96d8ae7bdf3e0ad8c47c010cd9459cc5b7c30454b862fb6305382a3340386768062d1e2ef1f32004a867c926390d7b2f93',
  pub: '2cWKMJemoBahooVbkiNtGArVwWYryUk9okwY5Zrz7ksgU7ALq8kY1sRD9YoMrhw6Vthpd',
  to: '2cWKMJemoBaher6QBtwmfiNSyodDW8XkcY3SXqL7b3kc1FzdgHjRZGgCcJT3JmUL1Hazb',
  amount: '5000000'
}

const testData2 = {
  priv: '4859243e8d674069f4bd66e308d2f15104a6ce50b8477faf5a6455b7bf68e95454f9268f8a886f5c586c52728ed2bf74069724e45b47c8431f3d8f8dd5aecd2acb555aa96d6455d8668660be0e4ae692afa09e1f734ea9c9b091fb579590472d',
  pub: '2cWKMJemoBakcz7NANgsSMT7Ab3TFapZNSiLpYsynR4KEWUxLmjMPRkNHXFoxAAoBwnqC',
  to: '2cWKMJemoBaheyHX9sDt85Br6JEEBczBDDKHi6a5Z7pEYjgoUmHRfVKuYCH3mnsisSTD7',
  amount: '5000000'
}
transactionZ.sendMoney(testData.priv, testData.pub, testData.to, testData.amount).then(() => {
  // transactionZ.sendMoney(testData2.priv, testData2.pub, testData2.to, testData2.amount)
});

// transactionZ.simpleSendMonney(testData2.priv, testData2.pub, testData2.to, testData2.amount)

// transactionZ.sendMoney(testData2.priv, testData2.pub, testData2.to, testData2.amount)
module.exports = Transaction;