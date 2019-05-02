'use strict'
const Cardano = require('cardano-wallet');
const KeyManager = require('./KeysDefine')

class CardanoKeyManager {
  async generateHotWallet() {
    let masterKey;
    let hotwallet = {};
    const passphare = Math.floor(Math.random() * 100);
    const keyManager = new KeyManager();
    keyManager.new(passphare);

    // generate master key
    masterKey = keyManager.getMasterKey();

    // generate hotwallet
    hotwallet.private_key = keyManager.generateHDPrivKey()
    hotwallet.address = keyManager.generateHDAddress();
    hotwallet.hdkey_path = keyManager.getHDKeyPath();
    return {
      masterKey,
      hotwallet
    }
  }

  async genReceivedAddrForInvoice(masterKey, index) {
    const keyManager = new KeyManager();
    keyManager.recover(masterKey);
    let receivedKey = {}
    receivedKey.private_key = keyManager.generatePrivKey(index)
    receivedKey.address = keyManager.generateAddress(index)
    receivedKey.hdkey_path = keyManager.getPath()
    receivedKey.index = index
    return receivedKey
  }

  isValidAddress(address) {
    try {
      Cardano.Address.from_base58(address)
      return true;
    } catch (error) {
      return false;
    }
  }

  checkHotwallet(keys) {
    try {
      Cardano.PrivateKey.from_hex(keys.masterKey);
      Cardano.PrivateKey.from_hex(keys.hotwallet.private_key);
      return true;
    } catch(error) {
      return false;
    }
  }

  checkReceiveKey(keys) {
    try {
      Cardano.PrivateKey.from_hex(keys.private_key)
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = CardanoKeyManager
