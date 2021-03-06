/**
 * simple test case to show how to use Vitrium APIs.
 *
 * How to run the test.
 *
 *  $ cd src
 *  $ ln -s ....vitrium.js local.js // link the local.js for vitrium
 *  $ cd ..
 *  $ nvm run node test/azure/vitrium-policy-test.js
 */

// we should have separate local.js file for vitrium.
const config = require('./../../src/config');

const Vitrium = require('./../../src/libs/vitrium');

let vitrium = new Vitrium(
    config.vitrium.accountToken,
    config.vitrium.userName,
    config.vitrium.password,
);

async function testGetReaders() {

    let readersRes = await vitrium.getReaders(1, 50);
    let readers = readersRes.data.Results.map( ( reader ) => {
        return {
            username: reader.Username,
            customField: reader.CustomField
        }
    } );

    console.log(readers);
}

testGetReaders();
