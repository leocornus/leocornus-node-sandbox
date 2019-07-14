
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');

const strategy = require('./../../src/libs/strategy');
// load configuration
const config = require('./../../src/config');
const localConfig = config.xml2Solr;
const solrEndPoint = localConfig.solrBaseUrl + "update/json/docs?commit=true";

var parser = new xml2js.Parser();
let files = fs.readdirSync(localConfig.xmlFileFolder);
console.log(`Found ${files.length} files`);

//var fileName = localConfig.xmlFileFolder + '/products_0001_2570_to_430420.xml';
strategy.waterfallOver(0, files.length,
    function(start, reportDone) {

    let fileName = localConfig.xmlFileFolder + "/" + files[start];

    fs.readFile(fileName, function(err, data) {
        parser.parseString(data, function(err, result) {
    
            console.log('- Found ' + result.products.product.length + ' products');
            let docs = result.products.product.map( item => {
    
                return localConfig.prepareSolrDoc(item);
            });
    
            //console.log(docs.length);
            //console.dir(docs[0]);
            //console.dir(result.products.product[0]);
            //console.dir(result.products.product[0].details[0].detail[0]);
    
            // post to Solr collection
            axios.post(solrEndPoint, docs
            ).then(function(postRes) {
                console.log("-- Post Success!");
                //console.dir(postRes);
                reportDone(1);
            }).catch(function(postError) {
                console.log("-- Post Fail");
                //console.dir(postError.response.data);
                reportDone(1);
            });
        });
    });
});
