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
const log4js = require('log4js');
// configure log4js
log4js.configure(config.vitrium.log4jsConfig);

const logger = log4js.getLogger('test');

const Vitrium = require('./../../src/libs/vitrium');

let vitrium = new Vitrium(
    config.vitrium.accountToken,
    config.vitrium.userName,
    config.vitrium.password,
);

// quick test to get all policies.
vitrium.getPolicies(1, 6000, (res, err) => {

    //console.log(res.data.Results.length);
    //console.log(res.data);
    let policies = res.data.Results.map((policy) => {
        // get the id, name, and createdon.
        return {
          Id: policy.Id,
          Name: policy.Name,
          CreatedOn: policy.CreatedOn
        };
    });

    logger.info(policies);
    logger.info(`Total Records: ${res.data.TotalRecords}`);
});
