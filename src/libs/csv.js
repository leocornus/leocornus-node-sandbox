/**
 * utility functions to handle CSV files.
 *
 * using csf-parse to parse CSV files.
 */

const fs = require('fs');

const parseXml = require('xml2js').parseString;
const parseCsv = require('csv-parse');
const prettyMs = require('pretty-ms');
const axios = require('axios');

const strategy = require('./strategy');

let csv = {

    /**
     * count the total.
     */
    totalRecords: 0,

    /**
     * process the given folder.
     */
    processFolder: function(theFolder, localConfig) {

        let self = this;

        let startTime = new Date();
        console.log("Start to process all files for folder:", theFolder);

        // clear total to start.
        self.totalRecords = 0;

        // read all files:
        let files = fs.readdirSync(theFolder);
        // quick check.
        //console.log(files);
        // filter to only .csv files.

        // set the waterfall iterator to process each file one after another.
        // the function signature is defined in stragegy lib.
        let waterfallIterator = function(index, reportOneFile) {

            let oneFile = files[index];
            if( oneFile.endsWith(".csv") ) {
                self.processOneFile(theFolder + "/" + oneFile, reportOneFile,
                                    localConfig);
            } else {
                console.log("-- Skip file:", oneFile);
                reportOneFile(1);
            }
        };

        // waterfall iterate through all files.
        strategy.waterfallOver(0, files.length, waterfallIterator,
            /**
             * the callback function when the iteration is complete!
             */
            function() {

                let totalTime = (new Date()) - startTime;
                console.log("Complete processing all files! Processed", 
                    self.totalRecords, "records in total.");
                console.log("Running time:", prettyMs(totalTime));
            }
        );
    },

    processOneFile: function(theFile, reportOneFileDone, localConfig) {

        let self = this;

        console.log("-- Process file:", theFile);

        // TODO: check file stats to process only updated files.

        let content = fs.readFileSync(theFile);
        // parse csv content
        parseCsv( content,
            // turn on the columns,
            // so the JSON output will be in Object format
            // with column name.
            {columns: true},
            /**
             * callback function after parse.
             */
            function(err, output) {

                if(err) {
                    console.log('  -- Parse CSV Error:', theFile, err);
                    reportOneFileDone(1);
                }

                console.log("  -- Total row:", output.length);
                self.totalRecords += output.length;
                // quick check the data structure.
                //console.table(output);

                // we have max 300 rows for each file, we could process at once!

                // get ready payload.
                let payload = localConfig.tweakDocs(output, theFile);

                axios.post(localConfig.solrUpdate, payload)
                .then(function(solrRes) {

                    console.log("  -- Batch post success");
                    reportOneFileDone(1);
                }).catch(function(solrErr) {

                    //console.log("  -- Batch post Failed:", solrErr);
                    console.log("  -- Batch post Failed:", theFile);
                    reportOneFileDone(1);
                });
            }
        );
    }
};

module.exports = csv;
