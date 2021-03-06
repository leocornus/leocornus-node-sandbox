/**
 */

const config = require('./../src/config');
const axios = require('axios');

const now = () => new Date().toUTCString()

// solr endpoint.
let solrEndpoint = config.solr.baseUrl + "select";

// simple query to get total number:
let totalQuery = {
    params: {
        q: "*:*",
        rows: 1,
        fl: "id"
    }
}
// simple get.
axios.get(solrEndpoint, totalQuery)
.then(function(totalRes) {

    let amount = totalRes.data.response.numFound;
    console.log("Total Docs: " + amount);

    // start from 0
    waterfallOver(amount, function(start, reportDone) {

        axios.get(solrEndpoint, {
          params: {
              q: "*:*",
            sort: "id desc",
            rows: 5,
            start: start
          }
        })
        .then(function(response) {
            // handle response here.
            //console.log("Got Response:");
        
            //console.dir(response.data.response.docs.length);
        
            // using map to process each document.
            let payload = response.data.response.docs.map(function(doc) {

                // TODO: compare extract version! 
                // we might skip this doc based on the version.
                doc["version_extract"] = 0.1;
                // TODO extract the model from file content.
                if(doc.hasOwnProperty('file_content')) {
                    // the quick test code.
                    //doc["product_models"] =
                    //    extractProductModels(doc["file_content"]);
                    matchOver(doc["file_content"],
                              config.modelPatterns,
                              function(content, onePattern, reportMatches) {
                                  // try to find matches:
                                  let matches = 
                                      Array.from(new Set(content.match(onePattern)));
                                  reportMatches(matches);
                              },
                              function(allMatches) {
                                  // set to 
                                  doc["product_models"] = [].concat(allMatches);
                              });
                }
                doc["_version_"] = 0;
                return doc;
            });

            //reportDone(payload.length);

            var endPoint =
                config.solr.baseUrl + "update/json/docs?commit=true";
            //    config.solr.targetBaseUrl + "update/json/docs?commit=true";

            // async call tod execute post for each doc.
            iterateOver(payload, function(doc, report) {
                axios.post(endPoint, doc
                ).then(function(postRes) {
                    //console.log("Post Success!");
                    report();
                    //console.dir(postRes);
                }).catch(function(postError) {
                    console.log("Post Failed!");
                    //console.dir(postError.data.response.error);
                    report();
                });
            }, function() {
                console.log(now() + " Async post done!");
                reportDone(payload.length);
            });
        })
        .catch(function(error) {
            // handle errors here.
            console.log("ERROR!");
            console.dir(error);
        });

    }, function() {
        console.log(now() + " All Done");
    });
})
.catch(function(totalError) {
    console.log("Total Query Error!");
    console.dir(totalError);
});

//// preparing the solr query.
//let solrQuery = {
//    params: {
//      q: "*:*",
//      //fq: "version_schema:1.0",
//      rows: 100
//      //fl: "id,c4c_type,file_content,file_hash,file_content_hash,file_size"
//    }
//};

/**
 * try to copy every 1000,
 */
function waterfallOver(total, oneCopy, callback) {

    var doneCount = 0;
    // get started...
    oneCopy(doneCount, reportDone);

    function reportDone(subTotal) {

        doneCount = doneCount + subTotal;
        console.log(now() + " Copied: " + doneCount);

        if(doneCount === total) {
            callback();
        } else {
            oneCopy(doneCount, reportDone);
        }
    }
}

/**
 * =================================================================
 * Solution Three - Correct Asynchronous read
 * 
 */
function iterateOver(docs, iterator, callback) {

    // this is the function that will start all the jobs
    // list is the collections of item we want to iterate over
    // iterator is a function representing the job when want done on each item
    // callback is the function we want to call when all iterations are over

    var doneCount = 0;  // here we'll keep track of how many reports we've got

    function report() {
        // this function resembles the phone number in the analogy above
        // given to each call of the iterator so it can report its completion

        doneCount++;

        // if doneCount equals the number of items in list, then we're done
        if(doneCount === docs.length)
            callback();
    }

    // here we give each iteration its job
    for(var i = 0; i < docs.length; i++) {
        // iterator takes 2 arguments, an item to work on and report function
        iterator(docs[i], report)
    }
}

/**
 * extract product models from the parsing string.
 */
function extractProductModels(fileContent) {

    // analyse the file content.
    //console.log(fileContent);
    let patterns = [
        /[A-Z]+-[0-9]+/g,
        // using " " for whitespace, \s will take line break as 
        // white space too.
        /[A-Z]{3} [0-9]{3} [0-9]{2} {0,1}[A-Z]{2}/g, // LTL 040 40 EF
    ];
    // new Set will make the match value unique.
    // basically remove all duplicated values.
    let matches = Array.from(new Set(fileContent.match(patterns[0])));
    let matches_1 = Array.from(new Set(fileContent.match(patterns[1])));

    console.log(matches_1);

    return matches.concat(matches_1);
}

/**
 * match over through all patterns.
 *
 * we will try the async approach first.
 */
function matchOver(fileContent, patterns, extractor, callback) {
    // set the count
    var doneCount = 0;
    var matches = [];

    // get ready the reportMatches function.
    function reportMatches(theMatches) {
        // increase the counting...
        doneCount ++;

        // keep the matches.
        matches.push(theMatches);
        console.log("find " + theMatches.length + " Matches");

        // check if it donw.
        if(doneCount === patterns.length) {
            // pass the full matches to callback.
            callback(matches);
        }
    }

    for(var i = 0; i < patterns.length; i++) {
        // go through each pattern.
        extractor(fileContent, patterns[i], reportMatches);
    }
}
