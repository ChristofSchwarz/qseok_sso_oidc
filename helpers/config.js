/* eslint-disable max-len */
// find explanation for all the config parameters on 
// https://github.com/panva/node-oidc-provider/blob/HEAD/lib/helpers/defaults.js

const crypto = require('crypto');
const os = require('os');
require('dotenv').config();

const claimStore = require ('../claimStore.js');

const MemoryAdapter = require('./memory_adapter');
const { DEV_KEYSTORE } = require('../consts');

const runtimeSupport = require('./runtime_support');
const base64url = require('./base64url');
const attention = require('./attention');
const nanoid = require('./nanoid');
const { base: defaultPolicy } = require('./interaction_policy');
const htmlSafe = require('./html_safe');

const warned = new Set();
function shouldChange(name, msg) {
  if (!warned.has(name)) {
    warned.add(name);
    attention.info(`default ${name} function called, you SHOULD change it in order to ${msg}.`);
  }
}
function mustChange(name, msg) {
  if (!warned.has(name)) {
    warned.add(name);
    attention.warn(`default ${name} function called, you MUST change it in order to ${msg}.`);
  }
}

const DEFAULTS = {
  acrValues: [],
  adapter: MemoryAdapter,


  claims: {
    // acr: null, 
    // sid: null, 
    // auth_time: null, 
    iss: null, 
    openid: ['sub'],
    email: ['email'], //, 'email_verified'
    profile: ['name', 'groups'] //, 'nickname', 'picture' 
  },

  clientBasedCORS: function clientBasedCORS(ctx, origin, client) { // eslint-disable-line no-unused-vars
    shouldChange('clientBasedCORS', 'control CORS allowed Origins based on the client making a CORS request');
    return true;
  },

  clients: [
    {
      client_id: process.env.CLIENT_ID || 'foo',
      client_secret: process.env.CLIENT_SECRET || 'thanksjviandcsw',
      redirect_uris: (process.env.OIDC_REDIRECTS && process.env.OIDC_REDIRECTS.split(',')) || ['https://elastic.example/login/callback'],
      post_logout_redirect_uris: (process.env.POST_LOGOUT_REDIRECTS && process.env.POST_LOGOUT_REDIRECTS.split(',')) || ['https://elastic.example','https://www.qlik.com'],
      //grant_types: ['refresh_token', 'authorization_code']
    }
  ],
  clientDefaults: {
    grant_types: ['authorization_code'],
    id_token_signed_response_alg: 'RS256',
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
  },
  clockTolerance: 0,
  conformIdTokenClaims: true,
  cookies: {
    names: {
      session: '_session', // used for main session reference
      interaction: '_interaction', // used by the interactions for interaction session reference
      resume: '_interaction_resume', // used when interactions resume authorization for interaction session reference
      state: '_state', // prefix for sessionManagement state cookies => _state.{clientId}
    },
    long: {
      httpOnly: true, // cookies are not readable by client-side javascript
      maxAge: (14 * 24 * 60 * 60) * 1000, // 14 days in ms
      overwrite: true,
      sameSite: 'none',
    },
    short: {
      httpOnly: true, // cookies are not readable by client-side javascript
      maxAge: (10 * 60) * 1000, // 10 minutes in ms
      overwrite: true,
      sameSite: 'lax',
    },
    keys: [],
  },

  discovery: {
    claim_types_supported: ['normal'],
    claims_locales_supported: undefined,
    display_values_supported: undefined,
    op_policy_uri: undefined,
    op_tos_uri: undefined,
    service_documentation: undefined,
    ui_locales_supported: undefined,
  },
  extraParams: [],

  features: {
    
    devInteractions: { enabled: true },
    dPoP: { enabled: false, iatTolerance: 60 },
    backchannelLogout: { enabled: false },
    ietfJWTAccessTokenProfile: { enabled: false },
    mTLS: {
      enabled: false,
      certificateBoundAccessTokens: false,
      selfSignedTlsClientAuth: false,
      tlsClientAuth: false,
      getCertificate: /* istanbul ignore next */ function getCertificate(ctx) { // eslint-disable-line no-unused-vars
        mustChange('features.mTLS.getCertificate', 'retrieve the PEM-formatted client certificate from the request context');
        throw new Error('features.mTLS.getCertificate function not configured');
      },
      certificateAuthorized: /* istanbul ignore next */ function certificateAuthorized(ctx) { // eslint-disable-line no-unused-vars
        mustChange('features.mTLS.getCertificate', 'determine if the client certificate is verified and comes from a trusted CA');
        throw new Error('features.mTLS.certificateAuthorized function not configured');
      },
      certificateSubjectMatches: /* istanbul ignore next */ function certificateSubjectMatches(ctx, property, expected) { // eslint-disable-line no-unused-vars
        mustChange('features.mTLS.getCertificate', 'verify that the tls_client_auth_* registered client property value matches the certificate one');
        throw new Error('features.mTLS.certificateSubjectMatches function not configured');
      },
    },
    claimsParameter: { enabled: false },
    clientCredentials: { enabled: false },
    deviceFlow: {
      enabled: false,
      charset: 'base-20',
      mask: '****-****',
      deviceInfo: function deviceInfo(ctx) {
        return {
          ip: ctx.ip,
          ua: ctx.get('user-agent'),
        };
      },
      userCodeInputSource: async function userCodeInputSource(ctx, form, out, err) {
        shouldChange('features.deviceFlow.userCodeInputSource', 'customize the look of the user code input page');
        let msg;
        if (err && (err.userCode || err.name === 'NoCodeError')) {
          msg = '<p class="red">The code you entered is incorrect. Try again</p>';
        } else if (err && err.name === 'AbortedError') {
          msg = '<p class="red">The Sign-in request was interrupted</p>';
        } else if (err) {
          msg = '<p class="red">There was an error processing your request</p>';
        } else {
          msg = '<p>Enter the code displayed on your device</p>';
        }
        ctx.body = `<!DOCTYPE html>
    <head>
      <meta charset="utf-8">
      <title>Sign-in (12)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <style>
        @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);h1,h1+p{font-weight:100;text-align:center}body{font-family:Roboto,sans-serif;margin-top:25px;margin-bottom:25px}.container{padding:0 40px 10px;width:274px;background-color:#F7F7F7;margin:0 auto 10px;border-radius:2px;box-shadow:0 2px 2px rgba(0,0,0,.3);overflow:hidden}h1{font-size:2.3em}p.red{color:#d50000}input[type=email],input[type=password],input[type=text]{height:44px;font-size:16px;width:100%;margin-bottom:10px;-webkit-appearance:none;background:#fff;border:1px solid #d9d9d9;border-top:1px solid silver;padding:0 8px;box-sizing:border-box;-moz-box-sizing:border-box}[type=submit]{width:100%;display:block;margin-bottom:10px;position:relative;text-align:center;font-size:14px;font-family:Arial,sans-serif;font-weight:700;height:36px;padding:0 8px;border:0;color:#fff;text-shadow:0 1px rgba(0,0,0,.1);background-color:#4d90fe;cursor:pointer}[type=submit]:hover{border:0;text-shadow:0 1px rgba(0,0,0,.3);background-color:#357ae8}input[type=text]{text-transform:uppercase;text-align: center}input[type=text]::placeholder{text-transform: none}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Sign-in (28)</h1>
        ${msg}
        ${form}
        <button type="submit" form="op.deviceInputForm">Continue</button>
      </div>
    </body>
    </html>`;
      },


      /*
       * features.deviceFlow.userCodeConfirmSource
       *
       * description: HTML source rendered when device code feature renders an a confirmation prompt for
       *   ther User-Agent.
       */
      userCodeConfirmSource: async function userCodeConfirmSource(ctx, form, client, deviceInfo, userCode) { // eslint-disable-line no-unused-vars
        // @param ctx - koa request context
        // @param form - form source (id="op.deviceConfirmForm") to be embedded in the page and
        //   submitted by the End-User.
        // @param deviceInfo - device information from the device_authorization_endpoint call
        // @param userCode - formatted user code by the configured mask
        shouldChange('features.deviceFlow.userCodeConfirmSource', 'customize the look of the user code confirmation page');
        const {
          clientId, clientName, clientUri, logoUri, policyUri, tosUri, // eslint-disable-line no-unused-vars, max-len
        } = ctx.oidc.client;
        ctx.body = `<!DOCTYPE html>
    <head>
      <meta charset="utf-8">
      <title>Device Login Confirmation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <style>
        @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);.help,h1,h1+p{text-align:center}h1,h1+p{font-weight:100}body{font-family:Roboto,sans-serif;margin-top:25px;margin-bottom:25px}.container{padding:0 40px 10px;width:274px;background-color:#f7f7f7;margin:0 auto 10px;border-radius:2px;box-shadow:0 2px 2px rgba(0,0,0,.3);overflow:hidden}h1{font-size:2.3em}button[autofocus]{width:100%;display:block;margin-bottom:10px;position:relative;font-size:14px;font-family:Arial,sans-serif;font-weight:700;height:36px;padding:0 8px;border:0;color:#fff;text-shadow:0 1px rgba(0,0,0,.1);background-color:#4d90fe;cursor:pointer}button[autofocus]:hover{border:0;text-shadow:0 1px rgba(0,0,0,.3);background-color:#357ae8}button[name=abort]{background:0 0!important;border:none;padding:0!important;font:inherit;cursor:pointer}a,button[name=abort]{text-decoration:none;color:#666;font-weight:400;display:inline-block;opacity:.6}.help{width:100%;font-size:12px}code{font-size:2em}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Confirm Device</h1>
        <p>
          <strong>${clientName || clientId}</strong>
          <br/><br/>
          The following code should be displayed on your device<br/><br/>
          <code>${userCode}</code>
          <br/><br/>
          <small>If you did not initiate this action, the code does not match or are unaware of such device in your possession please close this window or click abort.</small>
        </p>
        ${form}
        <button autofocus type="submit" form="op.deviceConfirmForm">Continue</button>
        <div class="help">
          <button type="submit" form="op.deviceConfirmForm" value="yes" name="abort">[ Abort ]</button>
        </div>
      </div>
    </body>
    </html>`;
      },


      /*
       * features.deviceFlow.successSource
       *
       * description: HTML source rendered when device code feature renders a success page for the
       *   User-Agent.
       */
      successSource: async function successSource(ctx) {
        // @param ctx - koa request context
        shouldChange('features.deviceFlow.successSource', 'customize the look of the device code success page');
        const {
          clientId, clientName, clientUri, initiateLoginUri, logoUri, policyUri, tosUri, // eslint-disable-line no-unused-vars, max-len
        } = ctx.oidc.client;
        ctx.body = `<!DOCTYPE html>
    <head>
      <meta charset="utf-8">
      <title>Sign-in Success</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <style>
        @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);h1,h1+p{font-weight:100;text-align:center}body{font-family:Roboto,sans-serif;margin-top:25px;margin-bottom:25px}.container{padding:0 40px 10px;width:274px;background-color:#F7F7F7;margin:0 auto 10px;border-radius:2px;box-shadow:0 2px 2px rgba(0,0,0,.3);overflow:hidden}h1{font-size:2.3em}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Sign-in Success</h1>
        <p>Your sign-in ${clientName ? `with ${clientName}` : ''} was successful, you can now close this page.</p>
      </div>
    </body>
    </html>`;
      },
    },

    encryption: { enabled: false },
    fapiRW: { enabled: false },
    frontchannelLogout: {
      enabled: false,

      logoutPendingSource: async function logoutPendingSource(ctx, frames, postLogoutRedirectUri) {
        shouldChange('features.frontchannelLogout.logoutPendingSource', 'customize the front-channel logout pending page');
        ctx.body = `<!DOCTYPE html>
    <head>
      <meta charset="utf-8">
      <title>Logout</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <style>
        iframe{visibility:hidden;position:absolute;left:0;top:0;height:0;width:0;border:none}
      </style>
    </head>
    <body>
      ${frames.join('')}
      <script>
        var loaded = 0;
        function redirect() {
          window.location.replace("${postLogoutRedirectUri}");
        }
        function frameOnLoad() {
          loaded += 1;
          if (loaded === ${frames.length}) {
            redirect();
          }
        }
        Array.prototype.slice.call(document.querySelectorAll('iframe')).forEach(function (element) {
          element.onload = frameOnLoad;
        });
        setTimeout(redirect, 2500);
      </script>
      <noscript>
        Your browser does not support JavaScript or you've disabled it.<br/>
        <a href="${postLogoutRedirectUri}">Continue</a>
      </noscript>
    </body>
    </html>`;
      },
    },

    introspection: { enabled: false },
    jwtIntrospection: { enabled: false },
    jwtResponseModes: { enabled: false },
    pushedAuthorizationRequests: { enabled: false },
    registration: {
      enabled: false,
      initialAccessToken: false,
      policies: undefined,
      idFactory: function idFactory() {
        return nanoid();
      },
      secretFactory: function secretFactory() {
        return base64url.encodeBuffer(crypto.randomBytes(64)); // 512 base64url random bits
      },
    },

    registrationManagement: {
      enabled: false,
      rotateRegistrationAccessToken: false,
    },
    resourceIndicators: {
      enabled: false,
      allowedPolicy: async function allowedPolicy(ctx, resources, client) { // eslint-disable-line no-unused-vars
        shouldChange('features.resourceIndicators.allowedPolicy', 'to whitelist resource values based on the client and request context');

        return true;
      },
    },
    requestObjects: {
      request: false,
      requestUri: true,
      requireUriRegistration: true,
      mergingStrategy: {
        name: 'lax',
        whitelist: ['code_challenge', 'nonce', 'state'], // TODO: in v7.x add `prompt` here
      },
    },

    revocation: { enabled: false },
    sessionManagement: {
      enabled: false,
      keepHeaders: false,
      scriptNonce: function scriptNonce(ctx) { // eslint-disable-line no-unused-vars
        shouldChange('features.sessionManagement.scriptNonce', 'specify the nonce attribute for the check_session_iframe html scripts');
        return undefined;
      },
    },
    secp256k1: {
      enabled: false,
    },
    userinfo: {
      enabled: true,
    },
    jwtUserinfo: {
      enabled: true,
    },
    webMessageResponseMode: {
      enabled: false,
      scriptNonce: function scriptNonce(ctx) { // eslint-disable-line no-unused-vars
        shouldChange('features.webMessageResponseMode.scriptNonce', 'specify the nonce attribute for the web_message response mode html scripts');
        return undefined;
      },
    },
  },
  extraAccessTokenClaims: async function extraAccessTokenClaims(ctx, token) { // eslint-disable-line no-unused-vars
    return undefined;
  },
  formats: {
    jwtAccessTokenSigningAlg: async function jwtAccessTokenSigningAlg(ctx, token, client) { // eslint-disable-line no-unused-vars
      if (client && client.idTokenSignedResponseAlg !== 'none' && !client.idTokenSignedResponseAlg.startsWith('HS')) {
        return client.idTokenSignedResponseAlg;
      }

      return 'RS256';
    },
    AccessToken: 'opaque',
    ClientCredentials: 'opaque',
    customizers: {
      jwt: undefined,
      'jwt-ietf': undefined,
      paseto: undefined,
    },
  },

  httpOptions: /* istanbul ignore next */ function httpOptions(options) {
    /* eslint-disable no-param-reassign */
    options.followRedirect = false;
    options.headers['User-Agent'] = 'oidc-provider/${VERSION} (${ISSUER_IDENTIFIER})'; // eslint-disable-line no-template-curly-in-string
    options.retry = 0;
    options.throwHttpErrors = false;
    options.timeout = 2500;
    /* eslint-enable no-param-reassign */
    return options;
  },

  expiresWithSession: async function expiresWithSession(ctx, token) {
    return !token.scopes.has('offline_access');
  },
  issueRefreshToken: async function issueRefreshToken(ctx, client, code) {
    return client.grantTypeAllowed('refresh_token') && code.scopes.has('offline_access');
  },

  jwks: DEV_KEYSTORE,

  responseTypes: [
    'code id_token',
    'code',
    'id_token',
    'none',
  ],

  pkceMethods: ['S256'],
  routes: {
    authorization: '/auth',
    check_session: '/session/check',
    code_verification: '/device',
    device_authorization: '/device/auth',
    end_session: '/session/end',
    introspection: '/token/introspection',
    jwks: '/jwks',
    pushed_authorization_request: '/request',
    registration: '/reg',
    revocation: '/token/revocation',
    token: '/token',
    userinfo: '/me',
  },

  scopes: ['openid', 'offline_access'],
  dynamicScopes: [],
  subjectTypes: ['public'],
  pairwiseIdentifier: async function pairwiseIdentifier(ctx, accountId, client) {
    mustChange('pairwiseIdentifier', 'provide an implementation for pairwise identifiers, the default one uses `os.hostname()` as salt and is therefore not fit for anything else than development');
    return crypto.createHash('sha256')
      .update(client.sectorIdentifier)
      .update(accountId)
      .update(os.hostname()) // put your own unique salt here, or implement other mechanism
      .digest('hex');
  },
  tokenEndpointAuthMethods: [
    'none',
    'client_secret_basic',
    'client_secret_jwt',
    'client_secret_post',
    'private_key_jwt',
  ],
  ttl: {
    AccessToken: 60 * 60, // 1 hour in seconds
    AuthorizationCode: 10 * 60, // 10 minutes in seconds
    ClientCredentials: 10 * 60, // 10 minutes in seconds
    DeviceCode: 10 * 60, // 10 minutes in seconds
    IdToken: 60 * 60, // 1 hour in seconds
    RefreshToken: function RefreshToken(ctx, token, client) {
      if (
        ctx && ctx.oidc.entities.RotatedRefreshToken
        && client.applicationType === 'web'
        && client.tokenEndpointAuthMethod === 'none'
        && !token.isSenderConstrained()
      ) {
        // Non-Sender Constrained SPA RefreshTokens do not have infinite expiration through rotation
        return ctx.oidc.entities.RotatedRefreshToken.remainingTTL;
      }

      return 14 * 24 * 60 * 60; // 14 days in seconds
    },
  },
  extraClientMetadata: {
    properties: [],
    validator: function validator(key, value, metadata, ctx) { // eslint-disable-line no-unused-vars
    },
  },
  postLogoutSuccessSource: async function postLogoutSuccessSource(ctx) {
    // @param ctx - koa request context
    shouldChange('postLogoutSuccessSource', 'customize the look of the default post logout success page');
    const {
      clientId, clientName, clientUri, initiateLoginUri, logoUri, policyUri, tosUri, // eslint-disable-line no-unused-vars, max-len
    } = ctx.oidc.client || {}; // client is defined if the user chose to stay logged in with the OP
    const display = clientName || clientId;
    ctx.body = `<!DOCTYPE html>
<head>
  <meta charset="utf-8">
  <title>Sign-out Success</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <style>
    @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);h1,h1+p{font-weight:100;text-align:center}body{font-family:Roboto,sans-serif;margin-top:25px;margin-bottom:25px}.container{padding:0 40px 10px;width:274px;background-color:#F7F7F7;margin:0 auto 10px;border-radius:2px;box-shadow:0 2px 2px rgba(0,0,0,.3);overflow:hidden}h1{font-size:2.3em}
  </style>
</head>
<body>
  <div class="container">
    <h1>Sign-out Success</h1>
    <p>Your sign-out ${display ? `with ${display}` : ''} was successful.</p>
  </div>
</body>
</html>`;
  },


  logoutSource: async function logoutSource(ctx, form) {
    // @param ctx - koa request context
    // @param form - form source (id="op.logoutForm") to be embedded in the page and submitted by
    //   the End-User
    shouldChange('logoutSource', 'customize the look of the logout page');
    ctx.body = `<!DOCTYPE html>
<head>
  <meta charset="utf-8">
  <title>Logout Request</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <style>
  @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);button,h1{text-align:center}h1{font-weight:100;font-size:1.3em}body{font-family:Roboto,sans-serif;margin-top:25px;margin-bottom:25px}.container{padding:0 40px 10px;width:274px;background-color:#F7F7F7;margin:0 auto 10px;border-radius:2px;box-shadow:0 2px 2px rgba(0,0,0,.3);overflow:hidden}button{font-size:14px;font-family:Arial,sans-serif;font-weight:700;height:36px;padding:0 8px;width:100%;display:block;margin-bottom:10px;position:relative;border:0;color:#fff;text-shadow:0 1px rgba(0,0,0,.1);background-color:#4d90fe;cursor:pointer}button:hover{border:0;text-shadow:0 1px rgba(0,0,0,.3);background-color:#357ae8}
  #fading {
    animation: fadein 3s;
    -moz-animation: fadein 3s; /* Firefox */
    -webkit-animation: fadein 3s; /* Safari and Chrome */
    -o-animation: fadein 3s; /* Opera */
}
@keyframes fadein {
    from {      opacity:0;    }    to {    opacity:1;   }
}
@-moz-keyframes fadein { /* Firefox */
    from {     opacity:0;    }    to {        opacity:1;    }
}
@-webkit-keyframes fadein { /* Safari and Chrome */
    from {        opacity:0;    }    to {        opacity:1;    }
}
@-o-keyframes fadein { /* Opera */
    from {        opacity:0;    }    to {        opacity: 1;    }
}
  </style>
</head>
<body>
  <div class="container" id="fading">
    <h1>Signing out from ${ctx.host}?</h1>
    ${form}
    <button autofocus id="signoutbtn" type="submit" form="op.logoutForm" value="yes" name="logout">Yes, sign me out</button>
    <!--button type="submit" form="op.logoutForm">No, stay signed in</button-->
  </div>
</body>
<script> 
   // automatically logout - Qlik Presales, Christof (csw) was here
   document.getElementById("signoutbtn").click(); 
</script>
</html>`;
  },


  renderError: async function renderError(ctx, out, error) { // eslint-disable-line no-unused-vars
    shouldChange('renderError', 'customize the look of the error page');
    ctx.type = 'html';
    ctx.body = `<!DOCTYPE html>
<head>
  <meta charset="utf-8">
  <title>oops! something went wrong</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <style>
    @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);h1{font-weight:100;text-align:center;font-size:2.3em}body{font-family:Roboto,sans-serif;margin-top:25px;margin-bottom:25px}.container{padding:0 40px 10px;width:274px;background-color:#F7F7F7;margin:0 auto 10px;border-radius:2px;box-shadow:0 2px 2px rgba(0,0,0,.3);overflow:hidden}pre{white-space:pre-wrap;white-space:-moz-pre-wrap;white-space:-pre-wrap;white-space:-o-pre-wrap;word-wrap:break-word;margin:0 0 0 1em;text-indent:-1em}
  </style>
</head>
<body>
  <div class="container">
    <h1>oops! something went wrong</h1>
    ${Object.entries(out).map(([key, value]) => `<pre><strong>${key}</strong>: ${htmlSafe(value)}</pre>`).join('')}
  </div>
</body>
</html>`;
  },


  /*
   * interactions
   *
   * description: Holds the configuration for interaction policy and url to send end-users to
   *   when the policy decides to require interaction.
   *
   * @nodefault
   */
  interactions: {
    policy: defaultPolicy(),
    url: async function url(ctx, interaction) { // eslint-disable-line no-unused-vars
      return `/interaction/${ctx.oidc.uid}`;
    },
  },


  audiences: async function audiences(ctx, sub, token, use) { // eslint-disable-line no-unused-vars
    return undefined;
  },

  findAccount: async function findAccount(ctx, sub, token) { // eslint-disable-line no-unused-vars
    //mustChange('findAccount', 'use your own account model');
    // Qlik Presales, Christof (csw), was here. The returned user claim is from a lookup to the account-store
    console.log(`>>> file: config.js, function .findAccount (...,"${sub}",...)`);
    var jwtClaim = claimStore.whois(sub);
    console.log('>>> answer: ' + JSON.stringify(jwtClaim));   
    if (jwtClaim && !jwtClaim.sub) jwtClaim.sub = sub; // make sure the key "sub" is contained in the claim
    if (ctx.path == '/me') {
    //   // this is the last call made by edge-auth of qliksense, so the temp array can be cleaned
      claimStore.delete(sub);
    }
    return {
      accountId: sub,
      async claims(use, scope) {
        return jwtClaim
        //  return {
        //     sub: sub,
        //     name: "Jacob Christof",
        //     groups: ['Everyone']
        //   }
      }
    };
  },


  rotateRefreshToken: function rotateRefreshToken(ctx) {
    const { RefreshToken: refreshToken, Client: client } = ctx.oidc.entities;

    // cap the maximum amount of time a refresh token can be
    // rotated for up to 1 year, afterwards its TTL is final
    /* istanbul ignore if */
    if (refreshToken.totalLifetime() >= 365.25 * 24 * 60 * 60) {
      return false;
    }

    // rotate non sender-constrained public client refresh tokens
    if (client.tokenEndpointAuthMethod === 'none' && !refreshToken.isSenderConstrained()) {
      return true;
    }

    // rotate if the token is nearing expiration (it's beyond 70% of its lifetime)
    return refreshToken.ttlPercentagePassed() >= 70;
  },


  whitelistedJWA: {
    tokenEndpointAuthSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    introspectionEndpointAuthSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    revocationEndpointAuthSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    idTokenSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    requestObjectSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    userinfoSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    introspectionSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    authorizationSigningAlgValues: [
      'HS256', 'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
    idTokenEncryptionAlgValues: [
      'A128KW', 'A256KW', 'ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A256KW', 'RSA-OAEP',
    ],
    requestObjectEncryptionAlgValues: [
      'A128KW', 'A256KW', 'ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A256KW', 'RSA-OAEP',
    ],
    userinfoEncryptionAlgValues: [
      'A128KW', 'A256KW', 'ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A256KW', 'RSA-OAEP',
    ],
    introspectionEncryptionAlgValues: [
      'A128KW', 'A256KW', 'ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A256KW', 'RSA-OAEP',
    ],
    authorizationEncryptionAlgValues: [
      'A128KW', 'A256KW', 'ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A256KW', 'RSA-OAEP',
    ],
    idTokenEncryptionEncValues: [
      'A128CBC-HS256', 'A128GCM', 'A256CBC-HS512', 'A256GCM',
    ],
    requestObjectEncryptionEncValues: [
      'A128CBC-HS256', 'A128GCM', 'A256CBC-HS512', 'A256GCM',
    ],
    userinfoEncryptionEncValues: [
      'A128CBC-HS256', 'A128GCM', 'A256CBC-HS512', 'A256GCM',
    ],
    introspectionEncryptionEncValues: [
      'A128CBC-HS256', 'A128GCM', 'A256CBC-HS512', 'A256GCM',
    ],
    authorizationEncryptionEncValues: [
      'A128CBC-HS256', 'A128GCM', 'A256CBC-HS512', 'A256GCM',
    ],
    dPoPSigningAlgValues: [
      'RS256', 'PS256', 'ES256', 'EdDSA',
    ],
  },
};

if (!runtimeSupport.EdDSA) {
  Object.values(DEFAULTS.whitelistedJWA).forEach((algs) => {
    const index = algs.indexOf('EdDSA');
    if (index !== -1) {
      algs.splice(index, 1);
    }
  });
}

/*
 * introspectionEndpointAuthMethods
 *
 * description: Array of Client Authentication methods supported by this OP's Introspection Endpoint.
 *   If no configuration value is provided the same values as for tokenEndpointAuthMethods will be
 *   used. Supported values list is the same as for tokenEndpointAuthMethods.
 */
DEFAULTS.introspectionEndpointAuthMethods = DEFAULTS.tokenEndpointAuthMethods;

/*
 * revocationEndpointAuthMethods
 *
 * description: Array of Client Authentication methods supported by this OP's Revocation Endpoint.
 *   If no configuration value is provided the same values as for tokenEndpointAuthMethods will be
 *   used. Supported values list is the same as for tokenEndpointAuthMethods.
 */
DEFAULTS.revocationEndpointAuthMethods = DEFAULTS.tokenEndpointAuthMethods;

module.exports = DEFAULTS;