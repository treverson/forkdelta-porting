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
let etherDeltaByteCode = fs.readFileSync('./smart_contract/etherdelta.sol.bytecode', 'utf8').slice(1, -2);

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
		console.log("receipt for symbol " + symbol);
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
		console.log("Error for symbol " + symbol);
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


/* Take X amount of generated accounts (where X is the amount of fake tokens to be created),
generate a token with each account, then distribute tokens to every other account. Probably
could have made this easier on myself by having the first account be the owner of all the contracts.

edit: just did */
web3.eth.personal.getAccounts()
.then(function(accts) {

	
	async.map(config.tokens, (tokenInfo, callback) => {
		//var acct = item[0];
		//var tokenInfo = item[1];
		console.log("Deploying token " + tokenInfo.symbol + " for account " + accts[0]);
		deployToken(tokenInfo.symbol, tokenInfo.name, accts[0], callback);
		console.log("Deployed token " + tokenInfo.symbol);
	}, (err, tokenReceipts) => {
		if (err !== null) {
			console.error(err);
			process.exit(1);
		}

		let tokenState = [];
		tokenReceipts.forEach((tokenReceipt) => {
			tokenState.push({
				symbol: tokenReceipt.symbol,
				name: tokenReceipt.name,
				owner: tokenReceipt.owner,
				address: tokenReceipt.contract.options.address
			});
		});

		fs.writeFileSync('./tokenState.json', JSON.stringify(tokenState));
		
		tokenReceipts.forEach((tokenReceipt) => {
			var toTransfer = web3.utils._.filter(accts, (acct) => {return acct != tokenReceipt.owner});
			async.map(toTransfer, (acct, callback) => {
				transferTokens(tokenReceipt.contract, tokenReceipt.owner, acct, 10000, callback); 
			}, (err, transferReceipts) => {
				if (err !== null) {
					console.error(err);
					process.exit(1);
				}

				//transferReceipts.forEach(console.log)
			})
		});
	});	



	/* Also, we need to deploy the etherdelta contract. */
	// Todo:clean this the fuck up


	var etherDeltaContract = new web3.eth.Contract(etherDeltaAbi);
	console.log("etherdelta contact created");
	etherDeltaContract.deploy({
		data: '0x' + etherDeltaByteCode,
		arguments: [accts[0], accts[0], accts[0], 0, 0, 0]
	})
	.send({
		from: accts[0],
		gas: '4700000'
	})
	.on('receipt', function(receipt) {
		console.log("deployed with receipt");
		fs.writeFileSync('./etherDeltaContractState.json', JSON.stringify({
			address: receipt.contractAddress,
			owner: accts[0]
		}));
	})
	.on('error', function(err, receipt) {
		console.error("!!!ERROR!");
		console.error(err);
		console.error(receipt);
		process.exit(1);
	});

});






