const debugLog = process.env.DEBUG_LOGGING || 1;
const jsonwebtoken = require('jsonwebtoken');
const decryptKey = process.env.JWT_DECRYPT_PUBLICKEY ||'shhhh';

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

    // if (debugLog) console.log('³³³³³³³³³³³³³³³³³³³³³³³³³³³³³ FYI: claimStore ³³³³³³³³³³³³³³');
    // if (debugLog) console.log(process.claimStore);
    // if (debugLog) console.log('³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³³');
}

////////////////////////////////// createticket //////////////////////////////////

exports.createTicket = function(token) { 
    if (debugLog) console.log(`>>> Called claimStore.js, function .createticket('${token.substr(0,5)}...${token.substr(-5)}')`);
    var newGuid = createUUID();
    try {
        decoded = jsonwebtoken.verify (token, decryptKey);
        // make 2 entries in claimStore, one with ticket-number as key, one with user id as key
        process.claimStore[decoded.id] = { jwt: token, time: Date.now()}
        process.claimStore[newGuid] = { jwt: token, time: Date.now()};
        cleanupGuidsArray();
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

exports.whois = function(searchkey) {
    if (debugLog) console.log(`>>> Called claimStore.js, function .whois('${searchkey}')`);
    cleanupGuidsArray();
    var entry = process.claimStore[searchkey];
    if (entry) {
        return jsonwebtoken.decode(entry.jwt);
    } else {
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
