const appVersion = '1.04';

//////////////// environment variables ////////////////

// set the defaults centrally here if not present in OS or .env file
require('dotenv').config();

// OIDC Settings
process.env.PORT = process.env.PORT                   
  || 3000  // http port where the service is exposed
process.env.PATH_PREFIX = process.env.PATH_PREFIX     
  || '/singlesignon'  // url prefix under which all services are running
process.env.CLIENT_ID = process.env.CLIENT_ID         
  || 'singlesignon'   // client_id of oidc provider, also configured in qliksense.yaml
process.env.CLIENT_SECRET = process.env.CLIENT_SECRET 
  || 'thanksjviandcsw'   // password for client, also configured in qliksense.yaml
process.env.JWT_DECRYPT_PUBLICKEY = process.env.JWT_DECRYPT_PUBLICKEY 
  || 'shhhh'  // passphrase or public certificate
process.env.OIDC_REDIRECTS = process.env.OIDC_REDIRECTS
  || 'https://elastic.example/login/callback'  // comma-separated list of allowed callbacks to qliksense
process.env.POST_LOGOUT_REDIRECTS = process.env.POST_LOGOUT_REDIRECTS 
  || 'https://www.qlik.com'  // allowed urls to go to after logout


// Convenience settings of /signin endpoint
process.env.SIGNIN_ENDPOINT_ENABLED = process.env.SIGNIN_ENDPOINT_ENABLED 
  || 'true'  // set to true if you like the /signin endpoint, otherwise it is missing
process.env.FORWARD_URLS = process.env.FORWARD_URLS   
  || '^http://|^https://'  // a regex to validate "forward" urls on /signin endpoint
process.env.MSG_LOGIN = process.env.MSG_LOGIN 
  || 'Logging in...'  // title shown shortly when token was ok on /signin endpoint
process.env.MSG_TOKEN_ACCEPTED = process.env.MSG_TOKEN_ACCEPTED 
  || 'Token accepted.' // text shown shortly when token was ok on /signin endpoint
process.env.ERROR_TITLE = process.env.ERROR_TITLE     
  || 'Ooops! Something went wrong'; // generic error title
process.env.ERROR_MSG_NO_CLAIM  = process.env.ERROR_MSG_NO_CLAIM 
  || 'No matching user claim found or key expired.';  // msg when auth endpoint doesn't find the user claim in claimStore
process.env.ERROR_MSG_BAD_TOKEN = process.env.ERROR_MSG_BAD_TOKEN 
  || 'The provided jwt token was not accepted.';  // msg by /signin endpoint when jwt was invalid
process.env.ERROR_MSG_NO_PARAMS = process.env.ERROR_MSG_NO_PARAMS 
  || "forward and jwt parameter are missing." // msg by /signin endpoint when no param was provided
process.env.ERROR_MSG_NO_JWT = process.env.ERROR_MSG_NO_JWT 
  || 'jwt parameter missing.' // msg by /signin endpoint when token was missing
process.env.ERROR_MSG_NO_FWD = process.env.ERROR_MSG_NO_FWD 
  || 'forward parameter missing.'  // msg by /signin endpoint when forward param was missing
process.env.ERROR_MSG_BAD_FWD = process.env.ERROR_MSG_BAD_FWD 
  || "forward querystring doesn't match the known FORWARD_URLS"  // msg by /signin endpoint when forward param was not allowed
process.env.ERROR_REDIR_URL = process.env.ERROR_REDIR_URL 
  || ''  // possible full url to redirect back to a main page on error
process.env.ERROR_DEDIR_AFTER_SECONDS = process.env.ERROR_DEDIR_AFTER_SECONDS 
  || '0'  // delay for how long an error msg is shown before redirecting back to main page


//////////////// required modules ////////////////

const Provider = require('oidc-provider').Provider;
const express = require('express');
var app = express();
const configuration = require('./helpers/config');
const routes = require('./routes/express');
const interactions = require('./interactions');
const jsonwebtoken = require('jsonwebtoken');
const claimStore = require ('./claimStore.js');
const issuer = 'http://simple-oidc-provider';  // Qlik only accepts this issuer
const emptyhtml = require('./emptyhtml');
var staticHTML = emptyhtml.page();

process.claimStore = {};  // initialization of global variable

let server;
(async () => {
  let adapter;

  // const provider = new Provider(ISSUER, { adapter, ...configuration });
  const provider = new Provider(issuer, configuration);
  provider.proxy = true; // also work behind reverse proxy (TLS offloading)

//////////////// oidc listener ////////////////
  
  provider.use(async (ctx, next) => {
    // pre-processing - This is a listener on all incoming events
    console.log('>>> incoming request: ', ctx.method, ctx.path);
    if (ctx.path != ctx.originalUrl) console.log('>>> exact url: ' + ctx.originalUrl);
    await next();  // the request itself
    // post middleware
    //console.log('@@@@@@@@@@@ post middleware');

    if (ctx.originalUrl.substr(0,15) == '/auth?client_id') {
      // special situation, when the /auth endpoint is called the first time:
      // format: /auth?client_id=xxx&scope=xxx&response_type=code&state=xxx&redirect_uri=xxx
      // 1) The querystring "state" has information from qliksense sent to this oidc, it is a jwt token
      //    holding the url, where the user wanted to go to (attribute "rd"), including the qlikticket=### 
      //    querystring, e.g. http://elastic.example/?qlikticket=12345      
      // 2) The response tells the browser to set a cookie for _session and/or _interaction, both
      //    are unique identifiers which will help to associate the user-claim behind the qlikticket with
      //    the rest of the login process (more oidc endpoints will be called, like /token /me ...)
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

//////////////// hello world endpoint ////////////////
  app.get(process.env.PATH_PREFIX, function(req,res){
    console.log('>>>Called endpoint /');
    res.status(200).send('Hello world. This is the Qlik Presales Single-Signon Passthru-OIDC.\n' 
    + `Version: ${appVersion}\n`);
  })

//////////////// ticket endpoint ////////////////  
  app.post(process.env.PATH_PREFIX + '/ticket',function(req, res) {
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

//////////////// signin endpoint ////////////////
  
  if (process.env.SIGNIN_ENDPOINT_ENABLED == 'true') {
    app.all(process.env.PATH_PREFIX + '/signin', function(req, res) {
      var bodyStr = '';
      req.on("data",function(chunk){
          bodyStr += chunk.toString();
      });
      req.on("end",function(){

        // Try to get the parameters "forward" and the jwt token in different ways
        var forwardUrl;
        var jwtToken;
        if (req.method == 'POST' || req.method == 'GET') {
          console.log('>>>Called endpoint /signin');
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
            res.status(401).send(emptyhtml.error(process.env.ERROR_TITLE, process.env.ERROR_MSG_NO_PARAMS
              ,process.env.ERROR_REDIR_URL, process.env.ERROR_DEDIR_AFTER_SECONDS));      
          } else if (jwtToken == '') {
            res.status(401).send(emptyhtml.error(process.env.ERROR_TITLE, process.env.ERROR_MSG_NO_JWT
              ,process.env.ERROR_REDIR_URL, process.env.ERROR_DEDIR_AFTER_SECONDS));    
          } else if (forwardUrl == '') {
            res.status(401).send(emptyhtml.error(process.env.ERROR_TITLE, process.env.ERROR_MSG_NO_FWD
              ,process.env.ERROR_REDIR_URL, process.env.ERROR_DEDIR_AFTER_SECONDS));    
          } else if ((forwardUrl).match(new RegExp(process.env.FORWARD_URLS)) == null) {
            res.status(401).send(emptyhtml.error(process.env.ERROR_TITLE, process.env.ERROR_MSG_BAD_FWD
              ,process.env.ERROR_REDIR_URL, process.env.ERROR_DEDIR_AFTER_SECONDS));    
          } else {
            // parameters "forward" and jwt token are okay
            var guid = claimStore.createTicket(jwtToken);
            if (guid.match(new RegExp('^{.*\}$')) != null) {
              // a json object was returned '{ ... }', that means an error was caught, the jwt was invalid
              res.status(401).send(emptyhtml.error(process.env.ERROR_TITLE, process.env.ERROR_MSG_BAD_TOKEN
                ,process.env.ERROR_REDIR_URL, process.env.ERROR_DEDIR_AFTER_SECONDS)); 
            } else {
              // all good, jwt accepted, forward the user to the desired forwardUrl
              forwardUrl = forwardUrl + ((forwardUrl.indexOf('?')>=0)?'&':'?') + 'qlikticket=' + guid;
              res.status(200).send(emptyhtml.message(process.env.MSG_LOGIN, process.env.MSG_TOKEN_ACCEPTED
                , true, forwardUrl));
            }          
          }
        } else {
          res.status(404).send(`404 - Method ${req.method} not allowed here.`);
        }
      });
    });
  }

//////////////// env endpoint ////////////////

  app.get(process.env.PATH_PREFIX +'/env', function(req,res){
    
    console.log('>>>Called endpoint /env');
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
  
  app.use(process.env.PATH_PREFIX + '/misc', express.static('misc'));

//////////////// router for interactions ////////////////  
  app.use(interactions(provider, process.env.PATH_PREFIX).router);
  routes(app, provider);
  app.use(process.env.PATH_PREFIX, provider.callback);
  

  server = app.listen(process.env.PORT, () => {
    console.log(`application listening on port ${process.env.PORT}, check its ${process.env.PATH_PREFIX}/.well-known/openid-configuration`);
  });

})().catch((err) => {
  if (server && server.listening) server.close();
  console.error(err);
  process.exitCode = 1;
});
