const axios = require('axios');
const { local } = require('./env.json')

const currentBlockNumber = 912116;
const tableblock = [];

const getBlockPage = async (index) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/pages/${index ? `?page=${index}` : ''}`,
  });
  if (status === 200 && data.Right) {
    return data.Right;
  } else {
    throw new Error('Error when get block page!');
  }
}

const getSummaryBlock = async (blockHash) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/summary/${blockHash}`,
  });
  if (status === 200 && data.Right) {
    return data.Right;
  } else {
    throw new Error('Error when get block page!');
  }
}

const getTransaction = async (blockHash) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/txs/${blockHash}`,
  });
  if (status === 200 && data.Right) {
    return data.Right;
  } else {
    throw new Error('Error when get block page!');
  }
}



const scanData = async () => {
  const currentPage = parseInt(currentBlockNumber / 10);
  let nextBlockIndex = currentBlockNumber % 10 + 1;
  const newestPageData = await getBlockPage();
  for (let i = currentPage; i <= newestPageData[0]; i++) {
    // get data in current page
    let data;
    if (currentPage === newestPageData[0]) data = newestPageData;
    else data = await getBlockPage(i);
    const length = data[1].length;
    for (let j = nextBlockIndex; j < length; j++) {
      const { cbeBlkHash, cbeTotalSent } = data[1][length - j - 1];
      // Get Prev Hash
      const summary = await getSummaryBlock(cbeBlkHash);
      console.log('--------------------------------');
      console.log('PREV:', summary.cbsPrevHash);
      console.log('CURR:', cbeBlkHash);
      console.log('NEXT:', summary.cbsNextHash);
      // check is valid with prev Hash => if not revert => remove transaction in block => call scanData() again
      // Get list transaction in block
      let transactions;
      if (cbeTotalSent.getCoin === '0') transactions = ['rong'];
      else transactions = await getTransaction(cbeBlkHash);
      console.log('TRANS:', transactions);
      console.log('--------------------------------');

      tableblock.push(cbeBlkHash)
      // console.log(currentBlockHash);
    }
    nextBlockIndex = 0;
  }
  return newestPageData;
}

// // getNewestBlock().then(data => console.log(data));
// scanData().then(data => {
//   console.log('--------------------------');
//   let currentBlock = data[0] * 10 + data[1].length - 1;
//   console.log(currentBlock);
//   console.log('--------------------------');
// });


const getBlock = async (index) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/pages/${index ? `?page=${index}` : ''}`,
  });
  if (status === 200 && data.Right) {
    return data.Right;
  } else {
    throw new Error('Error when get block!');
  }
}

const getBlockHash = async (index) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/pages/${index ? `?page=${index}` : ''}`,
  });
  if (status === 200 && data.Right) {
    console.log(data.Right);
    return data.Right && data.Right[1] && data.Right[1][0] && data.Right[1][0].cbeBlkHash;
  } else {
    throw new Error('Error when get block!');
  }
}

const getBlockHeight = async () => {
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


const getBlockInfo = async (blockHash) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/summary/${blockHash}`,
  });
  if (status === 200 && data.Right) {
    return data.Right;
  } else {
    throw new Error('Error when get block!');
  }
}

const getTxsInBlock = async (blockHash) => {
  const { status, data } = await axios({
    method: 'get',
    url: `${local.explorerUrl}/api/blocks/txs/${blockHash}`,
  });
  if (status === 200 && data.Right) {
    return data.Right;
  } else {
    throw new Error('Error when get transaction in block!');
  }
}

getBlockHeight().then(data => console.log(data));