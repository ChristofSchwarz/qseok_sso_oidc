
const staticHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <link rel="stylesheet" type="text/css" href="${process.env.PATH_PREFIX}/misc/styles.css" />
    <!--headinsert-->
  </head>
  <body>
    <div class="container">
      <!--bodyinsert-->
    </div>
  </body>
</html>`;

exports.page = function() { 
  return staticHTML;
}

exports.error = function(title, errorMsg, redirUrl, redirTimeout) {
  var ret = staticHTML.replace('<!--bodyinsert-->',
  `<h1 class="errheader">${title}</h1>
   <p class="errmsg">${errorMsg}</p>`);
  if ((redirUrl || '').length > 0) {
    ret = ret.replace('<!--headinsert-->',
    `<meta http-equiv="refresh" content="${redirTimeout||1}; url=${redirUrl}" />`);
  }
  return ret
}

exports.message = function(title, msg, spinner, redirUrl) {
  var ret = staticHTML.replace('<!--bodyinsert-->',
  `<h1 class="goodheader">${title}</h1>
   <p class="goodmsg">${msg}</p>` 
   + (spinner ? '<div class="loading"><div class="loader"></div></div>' : '') 
   );
  if ((redirUrl || '').length > 0) {
    ret = ret.replace('<!--headinsert-->',
    `<meta http-equiv="refresh" content="0; url=${redirUrl}" />`);
  }
  return ret
}