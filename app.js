const KeyManage = require('./KeysDefine');
const Cardano = require('cardano-wallet');
const Transaction = require('./Transaction');

const keyManage = new KeyManage();
keyManage.recover('a85067101257914826a26ee80bed2d7ab9fa4faec455175e7837c62faa68e95493df38e2aa61769bd6fd3f2f12fe6d50aa92f67652c186a13c5c5bbfca76e06c74ff60b3bad1cb0f76d272535a542334ce15a1b24826249dd4e720e65477abd5', 0);

try {
    const address = keyManage.generateAddress(2);
    console.log("ADDRESS:", address);
} catch(error) {
    console.log(error);
}

// const hdPrivateKey = keyManage.generateHDPrivKey(0);

// function isValidAddress(address) {
//     try {
//         Cardano.Address.from_base58(address)
//         return true;
//     } catch (error) {
//         return false;
//     }
// }

// function checkHotwallet(keys) {
//     try {
//       Cardano.PrivateKey.from_hex(keys.masterKey);
//       Cardano.PrivateKey.from_hex(keys.hotwallet.private_key);
//       return true;
//     } catch(error) {
//       return false;
//     }
// }

// console.log(checkHotwallet({
//     masterKey: 'b8fb1cdb8ad1238a2934941b2fb80042f0b50c5e350dd2b4cb380887a375915aaee9ce30986f1b378b3f9900da6da1f8284e10ce5552a96a70757167921f48b3edf1149fa069424aea8b90b97c38c29dbc73af357e46df3cccacf42a3f78fd87', 
//     hotwallet: {
//         private_key: 'b8fb1cdb8ad1238a2934941b2fb80042f0b50c5e350dd2b4cb380887a375915aaee9ce30986f1b378b3f9900da6da1f8284e10ce5552a96a70757167921f48b3edf1149fa069424aea8b90b97c38c29dbc73af357e46df3cccacf42a3f78fd87'
//     }
// }));

// console.log(keyManage.cre)


// const transaction = new Transaction();
// transaction.getUtxos(address).then(utxo => {
//     console.log('UTXOS:', typeof utxo[0].cuCoins.getCoin);
// }).catch(error => {
//     console.log('ERROR:', error);
// })