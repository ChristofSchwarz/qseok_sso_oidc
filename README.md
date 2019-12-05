# OIDC provider for QSEoK with SSO
by Jacob Vinzent and Christof Schwarz

This is a oidc provider based on this project (https://github.com/panva/node-oidc-provider) with a new behaviour. It does not prompt for userid and password, it looks up the user from a ticketnumber which was acquired before initiating the login process at qliksense.

The trick is to make a **POST** call to the endpoint **/ticket** with a valid JWT token in the Authentication header (Bearer XXXXXX). The result is a JSON with the Ticket in this format, if the JWT was valid and the signature could be verified:
```
{"Ticket":"d7114b56-87ec-4b2e-8205-78a272b5db49"}
```
At the same time, the Passthrough-OIDC provider has learned and stored for 60 seconds the user payload of the JWT token. It is ready to present it to the "holder" of the same ticket number. That means, you can now go to any url of your Qlik Sense on Kubernetes server and add "?qlikticket=d7114b56-87ec-4b2e-8205-78a272b5db49" to the url. If the config was correct on both sides, qliksense and the passthrough-oidc, that is all it takes to log in.

If the signature of the JWT was wrong you will get a JSON error, for example
```
{"error":"Error creating ticket for jwt token","name":"JsonWebTokenError","message":"invalid token"}
```

## JWT Token

The security is checked with a signed jwt key, and only when it's valid the payload (user claim) in the jwt token is trusted. You can find many code snippets in different programming languages on www.jwt.io and you can even create a token online for testing. 

The payload of the token is what is going to be injected to qliksense at the end of the single-signon process. Here is an example of the structure:
```
{
  "id": "jub",
  "name": "Julia Baumgartner",
  "groups": [
    "Everyone",
    "Presales"
  ],
  "iat": 1673805782
}
```
The token can be signed in one of the below ways:

| Method | Sign the token | Check the token (passthrough-oidc) |
| ------ | -------------- | ---------------------------------- |
| RS256  | sign with private key | provide the public key in the environment variable JWT_DECRYPT_PUBLICKEY |
| HS256  | sign with a passphrase | provide the same passphrase in the environment variable JWT_DECRYPT_PUBLICKEY |

The key-pair method (RS256) is the preferred and **more secure** way. If you want to generate a new key pair, here are the Linux commands:
```
openssl genrsa -out ./private.key 1024
openssl rsa -in ./private.key -pubout -out ./public.key
``` 

## Optional endpoint /signin

If you want a single-step login instead of a separate POST call (as explained above) you can set the environment variable SIGNIN_ENDPOINT_ENABLED=true and you will get an additional endpoint with 3 possibilities to authenticate yourself:

| Method | forward parameter | JWT token | Example |
| ------ | -------- | ----- | ----- |
| GET    | "forward" querystring | "jwt" querystring | <a href="html-examples.md">Example 1</a> |
| GET    | "forward" querystring | Authentication header (Bearer XXXXXX)|  |
| POST   | "forward" querystring | "jwt" field in request body | <a href="html-examples.md">Example 2</a> |
| POST   | "forward" field in request body | "jwt" field in request body | <a href="html-examples.md">Example 3</a> |

The forward url must match with the environment variable FORWARD_URLS (a RegEx match is done), to allow only redirects to intended targets. 

Note, that the /signin is also working with a qlikticket (like with the POST request on /ticket endpoint) so whatever your forward url to qliksense is, it will add the querystring qlikticket=XXXXXX to the url. 

## Configuration on QSEoK side:

The recommended configuration for the passthrough-oidc is to deploy it via **helm** (here is a separate Git repo https://github.com/ChristofSchwarz/qseok_oidc_helm) which will run it as a route of the same qliksense url (ingress), but it can also be installed completely separate from qliksense. 

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
        clientId: "singlesignon"  # has to match env var CLIENT_ID 
        clientSecret: "thanksjviandcsw"  # has to match env var CLIENT_SECRET
        realm: "sso"
        postLogoutRedirectUri: "https://elastic.example"  # must be in env var POST_LOGOUT_REDIRECTS
        claimsMapping:
          sub: ["sub", "id"]
          name: ["name"]
          groups: ["groups"]
```
use helm upgrade and restart (delete) the identity-providers pod. Delete all cookies in the browser before you retry.


## Environment variables 

The possible environment variables (PORT, PATH_PREFIX, CLIENT_ID, CLIENT_SECRET, JWT_DECRYPT_PUBLICKEY, ...) are explained in the first rows of <a href="app.js">app.js</a>. 

Note that if you use the **helm** chart to deploy it, all the settings will be done in the <a href="https://github.com/ChristofSchwarz/qseok_oidc_helm/blob/master/values.yaml">values.yaml of that chart</a>. The settings in yaml are made in lower case letters. 


## Those files are key to maintain:

| File | Meaning |
| ---- | ------- |
| app.js | main app, endpoints /signin, /ticket, /env, /misc found here |
| helpers/config.js | all configuration for the oidc client, especially the FindAccount function is key |
| interactions.js | routing for /interaction urls, it shortcuts the getGrant by directly logging the user in |
| claimStore.js | methods to manage a temp array of user-claims (jwt payloads), which are stored under different keys (qlikticket number, session id, interaction id, userid) |

