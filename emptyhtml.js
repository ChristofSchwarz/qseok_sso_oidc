require('dotenv').config();
const PATH_PREFIX= process.env.PATH_PREFIX || '/singlesignon';

exports.page = function() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <link rel="stylesheet" type="text/css" href="${PATH_PREFIX}/misc/styles.css" />
    <!--headinsert-->
  </head>
  <body>
    <div class="container">
        <!--bodyinsert-->
    </div>
  </body>
</html>
`}