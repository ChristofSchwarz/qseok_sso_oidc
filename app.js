const Provider = require('oidc-provider').Provider;
const express = require('express');
const configuration = require('./helpers/config');
const routes = require('./routes/express');
const interactions = require('./interactions');
const jsonwebtoken = require('jsonwebtoken');

// Environment variables (or defaults)
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const PATH_PREFIX= process.env.PATH_PREFIX || '/singlesignon';
const redirWhitelist= new RegExp(process.env.FORWARD_URLS || '^http://|^https://');    

var app = express();

process.claimStore = {};  // initialization of global variable
const claimStore = require ('./claimStore.js');
const issuer = 'http://simple-oidc-provider';  // Qlik only accepts this issuer

const staticHTML = require('./emptyhtml').page();

let server;
(async () => {
  let adapter;

  // const provider = new Provider(ISSUER, { adapter, ...configuration });
  const provider = new Provider(issuer, configuration);

  provider.use(async (ctx, next) => {
    // pre-processing - This is a listener on all incoming events
    console.log('>>> incoming request: ', ctx.method, ctx.path);
    if (ctx.path != ctx.originalUrl) console.log('>>> exact url: ' + ctx.originalUrl);
    await next();
    //console.log('@@@@@@@@@@@ post middleware');

    if (ctx.originalUrl.substr(0,15) == '/auth?client_id') {
      // format of originalUrl: /auth?client_id=xxx&scope=xxx&response_type=code&state=xxx&redirect_uri=xxx'
      // The querystring "state" has information from qliksense sent to this oidc, it is a jwt token
      // holding the url, where the user wanted to go to (attribute "rd"), including the qlikticket=### 
      // querystring, e.g. http://elastic.example/?qlikticket=12345      
      var state = ctx.originalUrl.split('state=')[1];
      state = state.split('&')[0];
      state = jsonwebtoken.decode(state);
      console.log('state (from qliksense): ', JSON.stringify(state));
      var qlikticket = state.rd.split('icket=')[1]||'';
      qlikticket = qlikticket.split('&')[0];
      console.log('qlikticket=' + qlikticket);
      var cookies = ctx.response.headers['set-cookie'];
      // The set-cookie information from the response header contains the session id issued by this oidc
      var _session = '';
      var _interaction = '';
      cookies.forEach(setcookie => {
        if (setcookie.substr(0,9) == '_session=') { _session = setcookie.substr(9).split(';')[0]; }
        if (setcookie.substr(0,13) == '_interaction=') { _interaction = setcookie.substr(13).split(';')[0]; }
      })
      console.log('_session=' + _session);
      console.log('_interaction=' + _interaction);
      if (_session.length > 0) claimStore.associateSession(qlikticket, _session);
      if (_interaction.length > 0) claimStore.associateSession(qlikticket, _interaction);
    } 
  });    

  app.get(PATH_PREFIX, function(req,res){
    res.status(200).send('This is the entrypoint of the Qlik Presales Single-Signon Passthru-OIDC.');
  })

  app.post(PATH_PREFIX + '/ticket',function(req, res) {
    console.log('\n>>> Called endpoint /ticket');
    let authHeader = req.header('Authorization');
    let jwtToken = authHeader.replace('bearer ','').replace('Bearer ','') || '';
    var guid = claimStore.createTicket(jwtToken);
    if (guid.match(new RegExp('^{.*\}$')) != null) {
      // a json object was returned, that means an error was caught
      res.status(401).send(guid);      
    } else {
      res.status(200).send(JSON.stringify({Ticket: guid}));  
    }
  });

  if (process.env.SIGNIN_ENDPOINT_ENABLED == 'true') {
    app.all(PATH_PREFIX + '/signin', function(req, res) {
      var bodyStr = '';
      req.on("data",function(chunk){
          bodyStr += chunk.toString();
      });
      req.on("end",function(){

        // Try to get the parameters "forward" and the jwt token in different ways
        var forwardUrl;
        var jwtToken;
        if (req.method == 'POST' || req.method == 'GET') {
          // parse jwt and forward if it is found in the request body (typically a POST of a html form)
          bodyStr.split('&').forEach(i=>{
            if (i.split('=')[0] == 'jwt') { jwtToken = decodeURIComponent(i.split('=')[1]);}
            if (i.split('=')[0] == 'forward') { forwardUrl = decodeURIComponent(i.split('=')[1]);}
          });
          
          jwtToken = (jwtToken || req.query.jwt || req.headers.authorization || '').replace('Bearer ','').replace('bearer ','');
          forwardUrl = forwardUrl || req.query.forward;

          res.cookie('_session', '', { maxAge: 0});  // delete previous _state.foo and _session cookie
          //res.cookie('_state.'+config.client_config[0].client_id, '', { maxAge: 0});

          // check for possible errors in the parameters "forward" and jwt token
          if (jwtToken == '' && forwardUrl == '') { 
            res.status(401)
            .send(staticHTML.replace('<!--bodyinsert-->', `
              <h1 class="errheader">oops! something went wrong</h1>
              <p class="errmsg">'forward' querystring and jwt parameter are missing.</p>`));
          } else if (jwtToken == '') {
            res.status(401)
            .send(staticHTML.replace('<!--bodyinsert-->', `
              <h1 class="errheader">oops! something went wrong</h1>
              <p class="errmsg">jwt parameter missing.</p>`));
          } else if (forwardUrl == '') {
            res.status(401)
            .send(staticHTML.replace('<!--bodyinsert-->', `
              <h1 class="errheader">oops! something went wrong</h1>
              <p class="errmsg">'forward' querystring missing.</p>`));
          } else if ((forwardUrl).match(redirWhitelist) == null) {
            res.status(401)
            .send(staticHTML.replace('<!--bodyinsert-->', `
              <h1 class="errheader">oops! something went wrong</h1>
              <p class="errmsg">'forward' querystring doesn't match the known FORWARD_URLS: ${forwardUrl}</p>`));
          } else {
            // parameters "forward" and jwt token are okay
            var guid = claimStore.createTicket(jwtToken);
            if (guid.match(new RegExp('^{.*\}$')) != null) {
              // a json object was returned, that means an error was caught, the jwt was invalid
              res.status(401)
              .send(staticHTML.replace('<!--bodyinsert-->', `
                <h1 class="errheader">oops! something went wrong</h1>
                <p class="errmsg">${process.env.MSG_TOKEN_REJECTED||'The provided jwt token was not accepted.'}</p>`));
            } else {
              // all good, jwt accepted, forward the user to the desired forwardUrl
              forwardUrl = forwardUrl + ((forwardUrl.indexOf('?')>=0)?'&':'?') + 'qlikticket=' + guid;
              res.status(200)
              .send(staticHTML
                .replace('<!--headinsert-->', `<meta http-equiv="refresh" content="0; url=${forwardUrl}" />`)
                .replace('<!--bodyinsert-->', '<p class="tokenaccepted">' 
                + (process.env.MSG_TOKEN_ACCEPTED || `JWT token for ${decoded.id} accepted. `) + '</p>' 
                + `<a href="${forwardUrl}">Forwarding</a> ...`
                + '<div class="loading"><div class="loader"></div></div>'));
            }          
          }
        } else {
          res.status(404).send(`404 - Method ${req.method} not allowed here.`);
        }
      });
    });
  }

  app.get(PATH_PREFIX +'/env', function(req,res){
    //console.log(process.env);
    var envs = JSON.parse(JSON.stringify(process.env)); // copy variable
    var res1;
    if (envs.JWT_DECRYPT_PUBLICKEY) { envs.JWT_DECRYPT_PUBLICKEY = '<i>***MASKED***</i>'}
    res1 = '<h2>Environment variables</h2>'
    + '<table class="envtable">' + JSON.stringify(envs) + '</table></body>';
    res1 = res1.replace(new RegExp('{"', 'g'), '<tr><td>');
    res1 = res1.replace(new RegExp('\\\\\\\\', 'g'), '\\');
    res1 = res1.replace(new RegExp('":"', 'g'), '</td><td>');
    res1 = res1.replace(new RegExp('","', 'g'), '</td></tr><tr><td>');
    res1 = res1.replace(new RegExp('"}', 'g'), '</td></tr>');
    res.status(200).send(staticHTML.replace('<!--bodyinsert-->',res1));
  });
  
  app.use(PATH_PREFIX + '/misc', express.static('misc'));

  app.use(interactions(provider, PATH_PREFIX).router);
  routes(app, provider);
  app.use(PATH_PREFIX, provider.callback);
  

  server = app.listen(PORT, () => {
    console.log(`application listening on port ${PORT}, check its ${PATH_PREFIX}/.well-known/openid-configuration`);
  });

})().catch((err) => {
  if (server && server.listening) server.close();
  console.error(err);
  process.exitCode = 1;
});
