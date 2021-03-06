/**
 * quick test to get connect to Tika server using the request module
 *
 * Overview about Tika server:
 * - https://wiki.apache.org/tika/TikaJAXRS
 */

const request = require('request');
const fs = require('fs');

// load configuration
const config = require('./../../src/config');
const localConfig = config.tika;

let formData = {
    file: fs.createReadStream(localConfig.testData[0].file)
};

// the request to get metadata.
let metaReq = {
    url: localConfig.baseUrl + 'meta/form',
    headers: {
        "Accept": "application/json",
        "Content-Type": "multipart/form-data"
    },
    formData: formData
};

request.post( metaReq, function(err, res, body) {

    //console.dir(body);
    console.log("type of body: " + typeof(body));
    console.dir(JSON.parse(body));
    //console.dir(res);

    // the request to get content text
    let tikaReq = {
        url: localConfig.baseUrl + 'tika/form',
        headers: {
            "Accept": "text/plain",
            "Content-Type": "multipart/form-data"
        },
        // we could not reuse the same form data object.
        // we have to create a new read stream.
        formData: {file: fs.createReadStream( localConfig.testData[0].file )}
    };

    request.post( tikaReq, function(err, res, body) {
    
        //console.dir(body);
        console.log("type of body: " + typeof(body) );
        console.log("Size of body: " + body.length );
        //console.dir(JSON.parse(body));
        //console.dir(res);
    } );
} );
