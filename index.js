/* Sets up a ganache server, creates a certain amount of accounts for it,
and then deploys 

var ganache = require("ganache-cli");
var server = ganache.server();
server.listen(port, function(err, blockchain) {...});