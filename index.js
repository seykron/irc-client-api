var IrcProxy = require("./server/IrcProxy");
var https = require("https");
var http = require("http");
var path = require("path");
var fs = require("fs");
var express = require('express');
var app = express();
var server = http.createServer(app);
var exphbs  = require('express3-handlebars');
var proxyConfig = JSON.parse(fs.readFileSync(path
  .join(__dirname, "config.json")));
var proxy = new IrcProxy(server, proxyConfig);

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
