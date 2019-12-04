# Different ways to use the /signin endpoint

In the below examples, the url of the passthrough-oidc and qliksense are separate 
 - url for qliksense: https://elastic.example
 - url for passthrough-oidc: http://qse-csw.westeurope.cloudapp.azure.com:3000/sso
 
Note that if you deployed it with our helm package, you will have the same hostname for both, just different paths
 
## GET with both, forward and jwt as querystrings
```
<a href="http://qse-csw.westeurope.cloudapp.azure.com:3000/sso/signin?forward=https://elastic.example&jwt=eyJhbG......">Login</a>
```

## POST with forward querystring and jwt as form field
```
<form method="POST" action="http://qse-csw.westeurope.cloudapp.azure.com:3000/sso/signin?forward=https://elastic.example">
  <input hidden name="jwt" value="eyJhb......" />
  <button type="submit">Login</button>
</form>
```

## POST with both, querystring and jwt as form fields
```
<form method="POST" action="http://qse-csw.westeurope.cloudapp.azure.com:3000/sso/signin">
  <input hidden name="forward" value="https://elastic.example" />
  <input hidden name="jwt" value="eyJhb......" />
  <button type="submit">Login</button>
</form>
```
