const debugLog = process.env.DEBUG_LOGGING || false;
const jsonwebtoken = require('jsonwebtoken');
const decryptKey = process.env.JWT_DECRYPT_PUBLICKEY ||'shhhh';
const useJwtWithoutValidation = (process.env.USE_JWT_WITHOUT_VALIDATION ? 
    process.env.USE_JWT_WITHOUT_VALIDATION == 'true' || process.env.USE_JWT_WITHOUT_VALIDATION == true
    || process.env.USE_JWT_WITHOUT_VALIDATION == '1' || process.env.USE_JWT_WITHOUT_VALIDATION == 1 
    : false); 


// Functions here work with the global variable processclaimStore

function createUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
       var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
       return v.toString(16);
    });
  }
  
  
function cleanupGuidsArray() {
    for (let key in process.claimStore){
        let entry = process.claimStore[key];
        let diff = (Date.now() - entry.time)/1000/60;
        // remove entries with a time stamp older than 1 minute 
        if (diff > 1) delete process.claimStore[key];
    }   

    if (debugLog) console.log('============ FYI: claimStore is now ============');
    if (debugLog) console.log(process.claimStore);
    if (debugLog) console.log('================================================');
}

////////////////////////////////// createticket //////////////////////////////////

// this endpoint checks the token with the decryptKey (public key or passphrase) 
// and 
// http://qse-csw.westeurope.cloudapp.azure.com:3000/singlesignon/signin?forward=https://elastic.example&jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imp1YiIsIm5hbWUiOiJKdWxpYSBCYXVtZ2FydG5lciIsImdyb3VwcyI6WyJFdmVyeW9uZSIsIlByZXNhbGVzIl0sImlhdCI6MTY3MzgwNTc4Mn0.Pc1yWkStxMEt3_7EtmhEx0oWGA8FN_sOjjdECTRz3HA
// http://qse-csw.westeurope.cloudapp.azure.com:3000/singlesignon/signin?forward=https://qliksense2.serrala.cloud&jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjY0Mzc2NDIyLTEzODctNDUzNy1iY2JjLThmYTk4MGIzMzI3MSJ9.eyJhY2NvdW50Ijp7Il9pZCI6IjVlZDhmMTZjN2QzMzY1MDAxOWFkYTZhNSIsIlhVU0VSIjoiQVBBbmFseXRpY3MiLCJUWVBFIjoiIiwiRk5BTUUiOiJBUCIsIkxOQU1FIjoiQW5hbHl0aWNzIiwiREVQVCI6IiIsIlBIT05FIjoiIiwiTUdSVVNFUklEIjoiIiwiRU1BSUwiOiJhcGFuYWx5dGljc0BzZXJyYWxhLmNvbSIsIkxBTkciOiIiLCJBUFJMVkwiOiIiLCJDT0RFUklEIjoiIiwiQlVLUlMiOiIiLCJXQUVSUyI6IiIsIktPU1RMIjoiIiwiTElGTlIiOiIiLCJBU1NJR05NRU5UUyI6W3siVFlQRSI6IkFVVEgiLCJWQUxVRSI6WyJBUF9NQU5BR0VSIiwiQlVTX0FOTFkiXX1dLCJVU0VSX1RZUEUiOiJyZWd1bGFyIiwiT0JKRUNUIjoiVVNFUiIsIkFSQ0hJVkVLRVkiOiJVU0VSIiwiT0ZGU0VUIjoiYzNmOWE1ZTEtMjE2Mi00ZTY4LWJkNDQtMDM3NWM5Y2MxNmQyIiwiVEVOQU5UX0lEIjoidGVzdC10ZW5hbnQifSwiaWF0IjoxNTkyODQwNjA5LCJleHAiOjE1OTkxNDA2MDl9.vkADe0H7glVCNQkrxcSWmnQaxR13gqLlQFQeIf2CCxc
// http://localhost:3000/singlesignon/signin?forward=https://qliksense2.serrala.cloud&jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjY0Mzc2NDIyLTEzODctNDUzNy1iY2JjLThmYTk4MGIzMzI3MSJ9.eyJhY2NvdW50Ijp7Il9pZCI6IjVlZDhmMTZjN2QzMzY1MDAxOWFkYTZhNSIsIlhVU0VSIjoiQVBBbmFseXRpY3MiLCJUWVBFIjoiIiwiRk5BTUUiOiJBUCIsIkxOQU1FIjoiQW5hbHl0aWNzIiwiREVQVCI6IiIsIlBIT05FIjoiIiwiTUdSVVNFUklEIjoiIiwiRU1BSUwiOiJhcGFuYWx5dGljc0BzZXJyYWxhLmNvbSIsIkxBTkciOiIiLCJBUFJMVkwiOiIiLCJDT0RFUklEIjoiIiwiQlVLUlMiOiIiLCJXQUVSUyI6IiIsIktPU1RMIjoiIiwiTElGTlIiOiIiLCJBU1NJR05NRU5UUyI6W3siVFlQRSI6IkFVVEgiLCJWQUxVRSI6WyJBUF9NQU5BR0VSIiwiQlVTX0FOTFkiXX1dLCJVU0VSX1RZUEUiOiJyZWd1bGFyIiwiT0JKRUNUIjoiVVNFUiIsIkFSQ0hJVkVLRVkiOiJVU0VSIiwiT0ZGU0VUIjoiYzNmOWE1ZTEtMjE2Mi00ZTY4LWJkNDQtMDM3NWM5Y2MxNmQyIiwiVEVOQU5UX0lEIjoidGVzdC10ZW5hbnQifSwiaWF0IjoxNTkyODQwNjA5LCJleHAiOjE1OTkxNDA2MDl9.vkADe0H7glVCNQkrxcSWmnQaxR13gqLlQFQeIf2CCxc

exports.createTicket = function(token) { 
    if (debugLog) console.log(`>>> Called claimStore.js, function .createticket('${token.substr(0,5)}...${token.substr(-5)}')`);
    var newGuid = createUUID();
    try {
        var decoded;
        if (useJwtWithoutValidation) {
            console.log('Because of setting USE_JWT_WITHOUT_VALIDATION the JWT token is used without validation! Dont use in production');
            decoded = jsonwebtoken.decode (token);
        } else {
            decoded = jsonwebtoken.verify (token, decryptKey);
        }
        var userIdKey;
        userIdKey = decoded.id;
       
        // make 2 entries in claimStore, one with ticket-number as key, one with user id as key
        process.claimStore[userIdKey] = { jwt: token, time: Date.now()}
        process.claimStore[newGuid] = { jwt: token, time: Date.now()};
        cleanupGuidsArray();
        if (debugLog) console.log('claimStore is now: ', process.claimStore);
        if (debugLog) console.log(`New ticket id ${newGuid}`);
        return newGuid;
    } catch(err) {     
        if (debugLog) console.log("Error validating jwt token: ", err); 
        var ret = {error: 'Error creating ticket for jwt token'};
        if (JSON.stringify(err).length > 2) Object.assign(ret, err);
        return JSON.stringify(ret);
    }
};

////////////////////////////////// associateSession //////////////////////////////////

// This function manages the process.claimStore array in a way, that a JWT can be 
// found under different criterias: under the ticketnumber, the userid, and a session
// id given by this OIDC

exports.associateSession = function(qlikticket, session) {
    if (debugLog) console.log(`>>> Called claimStore.js, function .associateSession('${qlikticket}', '${session}')`);
    if (qlikticket && session) {
        cleanupGuidsArray();
        var entry = process.claimStore[qlikticket];
        if (typeof entry === 'undefined') {
            // find corresponding jwt by looking up "process.claimStore" array with this ticket
            if (debugLog) console.log('no such ticket: '+ qlikticket);
            return null;
        } else {
            process.claimStore[session] = entry;
            if (debugLog) console.log(`Duplicated entry ${qlikticket} under key ${session}`);
            return qlikticket;
        }
    }
    if (debugLog) console.log('>>> finished .associateSession\n');
}

////////////////////////////////// whois //////////////////////////////////

// this is the endpoint which returns the saved user information from the claimStore array

exports.whois = function(searchkey) {
    if (debugLog) console.log(`>>> Called claimStore.js, function .whois('${searchkey}')`);
    cleanupGuidsArray();

    var entry = process.claimStore[searchkey];
    
    if (entry) {
        var decodedJwt = jsonwebtoken.decode(entry.jwt);
        return decodedJwt;
    } else {
        if (debugLog) console.log(`>>> Entry "${searchkey}" was not found in claimStore`);
        return null;
    }
}

////////////////////////////////// delete //////////////////////////////////

exports.delete = function(searchkey) {
    if (debugLog) console.log(`>>> Called claimStore.js, function .delete('${searchkey}')`);
    var entry = process.claimStore[searchkey];
    if (entry) {
        for(elem in process.claimStore) {
            if (process.claimStore[elem].jwt == entry.jwt) delete process.claimStore[elem];
        }
    }
    cleanupGuidsArray();
    return null;
}    
