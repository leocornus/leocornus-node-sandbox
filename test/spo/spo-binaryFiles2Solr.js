/**
 * This is to scan SPO site and store the file information into Solr.
 *
 * NOTE:
 *   This version introduced the iterateOverBatch to execute
 *   exist query in batch mode.
 *   The older version is stored as file:
 *   - spo-folderFiles2Solr-0.js
 */

const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const request = require('request');
const spoAuth = require('node-sp-auth');
const prettyMs = require('pretty-ms');

const strategy = require('./../../src/libs/strategy');

// timestamp for logging message.
const now = () => new Date().toUTCString()
const startTime = new Date();

const config = require('./../../src/config');
const localConfig = config.binaryFiles2Solr;
const spoConfig = config.spo;
const tikaConfig = config.tika;

// solr endpoint.
const solrEndpoint = localConfig.baseUrl + "select";
const targetQEndPoint = localConfig.targetBaseUrl + "select";
const targetEndPoint = localConfig.targetBaseUrl + "update/json/docs?commit=true";

// the basic informaiton.
console.log("From: " + solrEndpoint);
console.log("To: " + targetEndPoint);

// complete authentication and get the header
spoAuth.getAuth(spoConfig.spoUrl,
            {username: spoConfig.username,
             password: spoConfig.password})
.then(options => {

    // let's check the options.
    // it only contains a cookie which will have the
    // access token.
    //console.dir(options);

    // get ready header.
    let headers = options.headers;
    //headers['Accept'] = 'application/json;odata=verbose';
    headers['Accept'] = 'application/json';

    let totalQ = {
        params: {
            q: localConfig.selectQuery,
            rows: 1,
            fl: localConfig.idField
        }
    };

    // simple get.
    axios.get(solrEndpoint, totalQ).then(function(totalRes) {

        let amount = totalRes.data.response.numFound;
        console.log("Total files: " + amount);
        let bulk = Math.min(localConfig.endIndex, amount);
        // consle.log takes multiple params.
        console.log("Working on files from", localConfig.startIndex,
                    "to", bulk);

        // ============= the waterfall iterator.
        // define the sync iterator.
        const syncIterator = function(startIndex, syncReport) {

            // query a batch.
            let batchQ = {
                params: {
                    q: localConfig.selectQuery,
                    start: startIndex,
                    rows: localConfig.selectRows,
                    // sort to make sure we are in the same sequence 
                    // for each batch load.
                    sort: localConfig.selectSort,
                    fl: localConfig.selectFieldList
                }
            };
            axios.get(solrEndpoint, batchQ).then(function(batchRes) {

                // Got a batch of files:
                let files = batchRes.data.response.docs;

                // ==== The Iterator!
                // defind the asyncIterator, how we process each file.
                const asyncIterator = function(oneFile, asyncReport) {

                    // quick test.
                    //console.log(oneFile);
                    // process one file.
                    processOneBinaryFile(headers, oneFile, asyncReport);

                }; // END asyncIterator!

                // ==== The call back
                // define the async interate complete callback function.
                const asyncCallback = function() {

                    // log the summary
                    console.log(now() + " Async post files from", startIndex, 
                                "to" , (startIndex + files.length - 1));
                    // report sync iterator.
                    syncReport(files.length);
                };

                // process the batch of files in parallel!
                strategy.iterateOver(files, asyncIterator, asyncCallback);

            }).catch(function(batchErr) {

                // batch query failed.
                console.log("Batch Query Failed! ", batchQ);
                console.log(batchErr);
                // still need report.
                syncReport(localConfig.selectRows);
            });
        };

        // sync iteration batch by batch.
        strategy.waterfallOver(localConfig.startIndex, bulk, syncIterator,
        /**
         * waterfall complete callback.
         */
        function() {
            console.log(now() + " All Done");
            // summary message:
            let endTime = new Date();
            // the differenc will be in ms
            let totalTime = endTime - startTime;
            console.log("Running time: " + prettyMs(totalTime));
        });
    })
    .catch(function(totalErr) {
        console.log('Failed to query total');
        console.log(totalErr);
    });

// end of SPO authentication.
})
.catch(error => {
    // failed to authenticated from SPO.
    console.dir(error);
});

/**
 * utitlity function to process one binary file.
 */
function processOneBinaryFile(spoHeaders, theFile, reportFile) {

    let [folderName, fileName, localFile] =
        Object.values(localConfig.getFilePath(theFile));

    // get metadata from the folder.
    let meta = spoConfig.extractFolderName(folderName, fileName,
                                           theFile);
    // check the metadata from the folder path
    //console.dir(meta);

    // TODO: check if the file exist in the target solr collection

    let folderUrl = spoConfig.spoUrl + spoConfig.spoSite +
        "/_api/web/GetFolderByServerRelativeUrl('" +
        encodeURIComponent(folderName) + "')/Files";
    // query SPO to get metadata.
    let reqGetProp = {
        url: folderUrl + "('" + fileName + "')/Properties",
        method: "get",
        headers: spoHeaders
    };
    axios.request(reqGetProp).then(function(propRes) {
        //console.dir(propRes.data);
        // extract SPO properties.
        meta = Object.assign(meta, spoConfig.extractSPOMetadata(propRes.data));
        meta = Object.assign(meta, localConfig.extractSPOMetadata(propRes.data));
        // set the ID.
        meta[localConfig.idField] = spoConfig.calcId(meta);
        //console.log(meta);

    // STEP three: get file content.
        //console.log("File content:");
        let reqGetFile = {
            url: folderUrl + "('" + fileName + "')/$Value",
            method: "get",
            headers: spoHeaders,
            responseType: 'stream'
        };

        axios.request(reqGetFile).then(function(fileRes) {

            //console.dir(fileRes.data);
            const fileStream = fileRes.data;
            let output = fs.createWriteStream(localFile);
            let md5 = crypto.createHash('md5');
            let fileSize = 0;
            fileStream.on('data', (chunk /* chunk is an ArrayBuffer */) => {

                // calculate file size.
                fileSize += chunk.length;
                // calculate MD5 has from a stream.
                md5.update(chunk);
                output.write(Buffer.from(chunk));
            });

            // handle the write end stream event.
            fileStream.on('end', () => {

                output.end();
                let fileHash = md5.digest('hex');
                //console.log('Write to file', localFile, "file hash:", fileHash);
                // index the finary file.
                indexingOneBinaryFile(meta, localFile, fileHash, fileSize, reportFile);
                //reportFile();
            });
        })
        .catch(function(fileErr) {
            console.log("Failed to get file content:", fileName);
            console.log(fileErr);
            reportFile();
        });
    })
    .catch(function(propErr) {
        console.log("Failed to get file properties:", fileName);
        console.error(propErr);
        reportFile();
    });
    // =======================================================================
}

/**
 * untility function to process binary file indexing.
 */
function indexingOneBinaryFile(fileMeta, localPath, fileHash, fileSize, reportBinary) {

    // the request to get metadata.
    let metaReq = {
        url: tikaConfig.baseUrl + 'meta/form',
        headers: {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data"
        },
        formData: { file: fs.createReadStream( localPath ) } 
    };

    // form-data post to get meta data of the binary file..
    request.post( metaReq, function(metaErr, metRes, body) {

        //console.dir(body);
        //console.log("type of body: " + typeof(body));
        let tikaMeta = {};
        try {
            tikaMeta = JSON.parse( body );
        } catch(parseError) {
            console.log('Failed to parse tikaMeta:', parseError);
            console.log(body);
        }

        // the request to get content text
        let tikaReq = {
            url: tikaConfig.baseUrl + 'tika/form',
            headers: {
                "Accept": "text/plain",
                "Content-Type": "multipart/form-data"
            },
            // we could not reuse the same form data object.
            // we have to create a new read stream.
            formData: {file: fs.createReadStream( localPath )}
        };
        // form-data post to get content in text format.
        request.post( tikaReq, function(err, res, body) {

            //console.dir(body);
            //console.log("type of body: " + typeof(body) );
            //console.log("Size of body: " + body.length );

            //=========================================================
            // get ready the payload for target collection.
            let payload = localConfig.mergeDoc( fileMeta, tikaMeta, body,
                                                fileHash, fileSize );

            if( payload === null ) {

                // this is an identical file, skip.
                //localConfig.setupStatus(eventDoc, "IDENTICAL_FILE");
                //reportStatus(eventDoc);

                // report async iteration.
                reportBinary();

            } else {

                // post payload to target collection.
                axios.post( targetEndPoint, payload,
                    // default limit is 10MB, set to 1GB for now.
                    {maxContentLength: 1073741824} )
                .then(function(postRes) {
                    console.log("Post Success! -", payload[localConfig.idField]);

                    //console.dir(postRes);
                    //localConfig.setupStatus(eventDoc, "TARGET_UPDATE_SUCCESS");
                    // update the source document, process status and
                    // process message.
                    //reportStatus(eventDoc);

                    // report async iteration.
                    reportBinary();
                }).catch(function(postError) {
                    console.log("Post Failed! -", payload[localConfig.idField]);
                    console.dir(postError);

                    // log the erorr and then report the copy is done!
                    //localConfig.setupStatus(eventDoc, "TARGET_UPDATE_FAIL");
                    // update the source document.
                    //reportStatus(eventDoc);

                    // report async iteration.
                    reportBinary();
                });
            }
        } );
    } );
}
