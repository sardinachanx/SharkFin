'use strict';

var data1 = require('./lib/plaidSandbox2.json');

var purchase = require('./purchase.js');
var fetchAlts = require('./fetchAlts.js');

var envvar = require('envvar');
var express = require('express');
var bodyParser = require('body-parser');
var moment = require('moment');
var plaid = require('plaid');

var transactions;

var APP_PORT = envvar.number('APP_PORT', 8000);

var debug = true;

var PLAID_CLIENT_ID = envvar.string('PLAID_CLIENT_ID', debug ? '5a21a2ac4e95b836d37e3672' : '5616c9f51abbf9e13f581fb2' );
var PLAID_SECRET = envvar.string('PLAID_SECRET', debug ? 'c8dbac9121245f93510d139d270519' : '488760dbd0560fbb10d5845bf03a24');
var PLAID_PUBLIC_KEY = envvar.string('PLAID_PUBLIC_KEY', debug ? 'b8ef71cf0f8b7bdfe6d8da3761a04a' : '505704614c705498646afea6bffe29');
var PLAID_ENV = envvar.string('PLAID_ENV', debug ? 'sandbox' : 'production' );

// We store the access_token in memory - in production, store it in a secure
// persistent data store
var ACCESS_TOKEN = null;
var PUBLIC_TOKEN = null;
var ITEM_ID = null;

var client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV]
);

var app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

app.get('/', function(request, response, next) {
  response.render('index.ejs', {
    PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
    PLAID_ENV: PLAID_ENV,
  });
});

app.post('/get_access_token', function(request, response, next) {
  console.log(request.body);
  PUBLIC_TOKEN = request.body.public_token;
  console.log(PUBLIC_TOKEN);
  client.exchangePublicToken(PUBLIC_TOKEN, function(error, tokenResponse) {
    if (error != null) {
      var msg = 'Could not exchange public_token!';
      console.log(msg + '\n' + JSON.stringify(error));
      return response.json({
        error: msg
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id;
    console.log('Access Token: ' + ACCESS_TOKEN);
    console.log('Item ID: ' + ITEM_ID);
    response.json({
      'error': false
    });
  });
});

app.get('/accounts', function(request, response, next) {

  client.getAuth(ACCESS_TOKEN, function(error, authResponse) {
    if (error != null) {
      var msg = 'Unable to pull accounts from the Plaid API.';
      console.log(msg + '\n' + error);
      return response.json({
        error: msg
      });
    }
    console.log(authResponse.accounts);
    response.json({
      error: false,
      accounts: authResponse.accounts,
      numbers: authResponse.numbers,
    });
  });
});

app.post('/item', function(request, response, next) {

  client.getItem(ACCESS_TOKEN, function(error, itemResponse) {
    if (error != null) {
      console.log(JSON.stringify(error));
      return response.json({
        error: error
      });
    }

    client.getInstitutionById(itemResponse.item.institution_id, function(err, instRes) {
      if (err != null) {
        var msg = 'Unable to pull institution information from the Plaid API.';
        console.log(msg + '\n' + error);
        return response.json({
          error: msg
        });
      } else {
        response.json({
          item: itemResponse.item,
          institution: instRes.institution,
        });
      }
    });
  });
});

app.post('/transactions', function(request, response, next) {

  //start and end dates for transaction
  var startDate = moment().subtract(160, 'days').format('YYYY-MM-DD');
  var endDate = moment().format('YYYY-MM-DD');
  client.getTransactions(ACCESS_TOKEN, startDate, endDate, {
    count: 250,
    offset: 0,
  }, function(error, transactionsResponse) {
    if (error != null) {
      console.log(JSON.stringify(error));
      return response.json({
        error: error
      });
    }

    transactions = debug ? transactionsResponse.transactions.concat(data1.transactions) : transactionsResponse.transactions;

    transactions = transactions.map(entry => purchase.purchase(entry.product_name==null ? entry.name : entry.product_name, entry.amount, entry.date, entry.category_id));

    console.dir(transactions, {depth: null});

    transactions = fetchAlts(transactions).then((output) => {

      response.json(output.filter(n => !!n));
    
    });
    
  });
});

var server = app.listen(APP_PORT, function() {
  console.log('plaid-walkthrough server listening on port ' + APP_PORT);
});