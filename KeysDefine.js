'use strict'

const Cardano = require("cardano-wallet");
const Mnemonic = require('bitcore-mnemonic')

const PROTOCOL_MAGICS = {mainnet: 764824073, testnet: 1097911063}
let settings = Cardano.BlockchainSettings.from_json({protocol_magic: PROTOCOL_MAGICS.testnet});

class KeyManager {
  new(passpharse = '', account_index = 0) {
    const mnemonic = new Mnemonic(Mnemonic.Words.English);
    const entropy = Cardano.Entropy.from_english_mnemonics(mnemonic.toString());
    this.wallet = Cardano.Bip44RootPrivateKey.recover(entropy, passpharse);
    this.account_index = account_index;
    this.account = this.wallet.bip44_account(Cardano.AccountIndex.new((0x80000000 + account_index) | 0x80000000));
  }

  recover(masterKey, account_index = 0) {
    this.wallet = Cardano.Bip44RootPrivateKey.new(Cardano.PrivateKey.from_hex(masterKey), Cardano.DerivationScheme.v2());
    this.account_index = account_index;
    this.account = this.wallet.bip44_account(Cardano.AccountIndex.new((account_index + account_index) | 0x80000000));
  }

  getMasterKey() {
    return this.wallet.key().to_hex();
  }

  generateHDPrivKey() {
    return this.account.key().to_hex();
  }

  generateHDPubKey() {
    return this.account.public().key().to_hex();
  }

  generateHDAddress() {
    return this.account.public().key().bootstrap_era_address(settings).to_base58();
  }

  getHDKeyPath() {
    return `m/bip44'/ada'/${this.account_index}'`
  }

  generatePrivKey(index = 0, change = 0) {
    return this.account.private().address_key(change === 1, Cardano.AddressKeyIndex.new(index)).to_hex();
  }

  generatePublicKey(index = 0, change = 0) {
    return this.account.public().address_key(change === 1, Cardano.AddressKeyIndex.new(index)).to_hex(); // change === 1: is internal
  }

  generateAddress(index = 0, change = 0) {
    const key_pub = this.account.public().address_key(change === 1, Cardano.AddressKeyIndex.new(index));
    return key_pub.bootstrap_era_address(settings).to_base58();
  }

  getPath(index = 0, change = 0) {
    return `m/bip44'/ada'/${this.account_index}'/${change}/${index}`
  }
}

module.exports = KeyManager;