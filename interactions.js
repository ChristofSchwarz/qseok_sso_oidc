const express = require('express')
const claimStore = require('./claimStore');
const staticHTML = require('./emptyhtml').page();

module.exports = (oidc, prefix) => {

  async function getGrant (req, res) {

    console.log('>>> file: interactions.js, function: getGrant');
    var _session = '';
    var _interaction = '';
    if(req.headers.cookie) _session = req.headers.cookie.split('_session=')[1] || '';
    _session = _session.split(';')[0];
    if(req.headers.cookie) _interaction = req.headers.cookie.split('_interaction=')[1] || '';
    _interaction = _interaction.split(';')[0];
    console.log('>>> _session: ' + _session);
    console.log('>>> _interaction: ' + _interaction);
    var jwtClaim = ( _interaction.length > 0)? claimStore.whois(_interaction) : claimStore.whois(_session);
//    var jwtClaim = { id: "you", name: "And Me"};
    if (jwtClaim) {
      //let account = new Account (jwtClaim);  
      oidc.interactionFinished(req, res, {
        login: {
          // account: account.accountId,
          account: jwtClaim.id,
          acr: '1',
          remember: false, 
          ts: Math.floor(Date.now() / 1000)
        },
        consent: {}  
      })
    } else {
      res.status(401)
        .send(staticHTML.replace('<!--bodyinsert-->', `
          <h1 class="errheader">oops! something went wrong</h1>
          <p class="errmsg">No user claim found or key expired.</p>`));
    }
  }

  let router = express.Router();
  router.get(prefix + '/interaction/:grant', getGrant);
//  router.post(prefix + '/interaction/:grant/confirm', parse, confirmGrant);
//  router.post(prefix + '/interaction/:grant/login', parse, login);

  return {
    router,
    getGrant,
    // confirmGrant,
    // login
  }
}