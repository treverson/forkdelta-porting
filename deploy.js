#!/usr/bin/env node


var program = require("commander");

/*
program
	.version('0.0.1')
	.option('-a'. 'Account to deploy the contract with.')
	.parse(process.argv); */

const fs = require("fs");
const Web3 = require("web3");
const async = require("async");

web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

let etherDeltaAbi = JSON.parse(fs.readFileSync('./smart_contract/etherdelta.sol.json', 'utf8'));
let etherDeltaByteCode = fs.readFileSync('./smart_contract/etherdelta.sol.bytecode', 'utf8');

let fixedTokenByteCode = fs.readFileSync('./smart_contract/fixedToken.sol.bytecode', 'utf8');
let fixedTokenAbi = JSON.parse(fs.readFileSync('./smart_contract/fixedToken.sol.json', 'utf8'));

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

/* Functionality for deploying an arbitrary token with a fixed supply. Suitable for testing. */
function deployToken(symbol, name, owner, callback) {
	var fixedsupplytokenContract = new web3.eth.Contract(fixedTokenAbi);
	var fixedsupplytoken = fixedsupplytokenContract.deploy({
		data: '0x' + fixedTokenByteCode,
		arguments: [symbol, name]
	})
	.send({
		from: owner,
		gas: '4700000'
	})
	.on('receipt', function(receipt) {
		fixedsupplytokenContract.options.address = receipt.contractAddress;
		callback(null, {
			contract: fixedsupplytokenContract,
			receipt: receipt,
			symbol: symbol,
			name: name,
			owner: owner
		})
	})
	.on('error', function(err, receipt) {
		callback(err, {
			contract: fixedsupplytokenContract,
			receipt: receipt,
			symbol: symbol,
			name: name,
			owner: owner
		})
	});
}

/* Transfer an ERC20 token owned by an account. Better callback handling. */
function transferTokens(tokenContract, from, to, amount, callback) {
	tokenContract.methods.transfer(to, amount)
	.send({
		from: from,
		gas: '4700000'
	})
	.on('receipt', function(receipt) {
		callback(null, receipt);
	})
	.on ('error', function(err, receipt) {
		callback(err, receipt);
	});
}



web3.eth.personal.getAccounts()
.then(function(accts) {
	var mapped = web3.utils._.zip(accts.slice(0, config.tokens.length), config.tokens);

	async.map(mapped, (item, callback) => {
		var acct = item[0];
		var tokenInfo = item[1];
		deployToken(tokenInfo.symbol, tokenInfo.name, acct, callback);
	}, (err, results) => {
		if (typeof err !== 'undefined')
			console.error(err);
		results.forEach((result) => {
			var toTransfer = web3.utils._.filter(accts, (acct) => {return acct != result.owner});
			console.log(toTransfer);
			async.map(toTransfer, (acct, callback) => {
				transferTokens(result.contract, result.owner, acct, 10000, callback);
			}, (err, transferReceipts) => {
				if (typeof err !== 'undefined')
					console.error(err);
				transferReceipts.forEach(console.log)
			})
		});
	});
});