var path = require("path");
var express = require('express');
var app = express();
var exphbs  = require('express3-handlebars');

app.engine('html', exphbs());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "handlebars");

app.use("/asset", express.static(__dirname + '/lib'));

app.get('/', function(req, res){
  res.render("index.html");
});

app.listen(3000);
