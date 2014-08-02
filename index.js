var IrcProxy = require("./server/IrcProxy");
var https = require("https");
var http = require("http");
var path = require("path");
var fs = require("fs");
var express = require('express');
var app = express();
var server = http.createServer(app);
var exphbs  = require('express3-handlebars');
var proxy = new IrcProxy(server);

// Required to use TLS with newver IRC servers.
https.globalAgent.options.secureProtocol = 'SSLv3_method';

app.engine('html', exphbs());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "handlebars");

app.use("/asset", express.static(__dirname + '/lib'));
app.use("/asset", express.static(__dirname + '/views/assets'));

app.get('/', function(req, res){
  res.render("index.html");
});

server.listen(3000);
proxy.attach();
