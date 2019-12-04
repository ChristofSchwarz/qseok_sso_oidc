# OIDC provider for QSEoK with SSO
by Jacob Vinzent and Christof Schwarz

This is a oidc provider based on this project (https://github.com/panva/node-oidc-provider) with changed settings. 
It does not prompt for userid and password, instead an additional endpoint **/signin** was added
which parses a provided JWT token (passed as querystring or Bearer token in http header) and remembers this user up to 60 seconds to return to the standard oidc endpoints (/auth, /token, /interaction) during the Qlik Sense login process.

To run a single-signon, call this endpoint (qseok-server-url is your target address of your Sense Server) with the following parameters:

 * the bearer token can be part of the http-header (Authorziation: Bearer <jwt>) or provided as querystring (jwt=<jwt>) 
   which isn't recommendend
 * forward: url of the qliksense installation (a deeplink is possible for example to a specific app)
 
```
Syntax:
http://<nodeapp-url-port-path>/signin?jwt=<jwt-token>&forward=https%3A%2F%2F<qseok-server-url>
```
Example: http://qse-csw.westeurope.cloudapp.azure.com:3000/sso/signin?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imp1YiIsIm5hbWUiOiJKdWxpYSBCYXVtZ2FydG5lciIsImdyb3VwcyI6WyJFdmVyeW9uZSIsIlByZXNhbGVzIl0sImlhdCI6MTY3MzgwNTc4Mn0.Pc1yWkStxMEt3_7EtmhEx0oWGA8FN_sOjjdECTRz3HA&forward=https://elastic.example

![alttext](https://github.com/ChristofSchwarz/pics/raw/master/passthruoidc.gif "screenshot")

## Configuration on QSEoK side:
edit the relevant qliksense.yaml like this, you may correct the following parts
 * hostname: replace elastic.example with the correct address of your sense server
 * discoveryUrl: replace 192.168.204.1 with the correct address of this node app
 * postLogoutRedirectUri
```
identity-providers:
  secrets:
    idpConfigs:
      - hostname: "elastic.example" 
        discoveryUrl: "http://qse-csw.westeurope.cloudapp.azure.com:3000/sso/.well-known/openid-configuration"
        clientId: "foo"  # has to match env var CLIENT_ID 
        clientSecret: "bar"  # has to match env var CLIENT_SECRET
        realm: "sso"
        postLogoutRedirectUri: "https://elastic.example"  # must be in env var POST_LOGOUT_REDIRECTS
        claimsMapping:
          sub: ["sub", "id"]
          name: ["name"]
          groups: ["groups"]
```
use helm upgrade and restart (delete) the identity-providers pod. Delete all cookies in the browser before you retry.

## JWT Token
The token can be 
 * HS256 with a passphrase (the same to be configured as environment variable JWT_DECRYPT_PUBLICKEY when running this app), example: https://jwt.io/#debugger-io?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imp1YiIsIm5hbWUiOiJKdWxpYSBCYXVtZ2FydG5lciIsImdyb3VwcyI6WyJFdmVyeW9uZSIsIlByZXNhbGVzIl0sImlhdCI6MTY3MzgwNTc4Mn0.Pc1yWkStxMEt3_7EtmhEx0oWGA8FN_sOjjdECTRz3HA
 * RS256 signed with a private key
 

## Environment variables 

| Variable | Usage | Default |
| -------- | ----- | ------- |
| MSG_LOGIN | message shown while redirecting back from Qlik Sense upon silent automated login | Signing in... |
| MSG_NO_COOKIE | message shown if the login page of the simple oidc is called out of sequence (no cookie is present) | |
| FWD_NO_COOKIE | url to redirect the user to if the sso has expired and users attempt to log in via qliksense directly. This would be the main web app where the user is logged in | |
| MSG_TOKEN_ACCEPTED | shown quickly when the /signin endpoint was called with appropriate parameters | JWT token for <user> accepted. |
| JWT_DECRYPT_PUBLICKEY | public key or passphrase | shhhh |
| CLIENT_ID | | foo |
| CLIENT_SECRET | | bar |
| OIDC_REDIRECTS | comma-separated list of allowed callback urls to qliksense | https://elastic.example/login/callback |
| PATH_PREFIX | prefix for all the endpoints | /singlesignon |
| POST_LOGOUT_REDIRECTS | comma-separated list of allowed redirects when logging out from qliksense, this would be the main web app where the user is logged in | |
| PORT | | 3000 |
| IDP_NAME | | https://simple-oidc-provider |
| SIGNIN_ENDPOINT_ENABLED | Set true or false whether you like the /signin endpoint or not | true |
| FORWARD_URLS | Regex pattern to match allowed forward urls to a qseok target resource (only relevant for /signin endpoint) | ^http://\|^https:// |


## Those files were edited:
 * app.js (main app, new endpoints /signin and /env)
 * views\login.ejs (Login Form)
 * views\interactions.ejs
 * node_modules\oidc-provider\lib\helpers\defaults.js  (Logout Form)
 * <a href="node_modules/oidc-provider/lib/actions/authorization/check_scope.js">node_modules\oidc-provider\lib\actions\authorization\check_scope.js</a> (hint which auth session is opened for which target url at qliksense)
 * server\config.js (allowed return_uri)
 * server\interactions.js (manipulated /interaction endpoint)
 * server\accountStore.js (pretending lookup of a user)
