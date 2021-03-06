/**
 * simple test case to use Crea moduel.
 */

const Crea = require('./../../src/libs/crea');
const log4js = require('log4js');

const config = require('./../../src/config');
// configure log4js
log4js.configure(config.crea.log4jsConfig);

let crea = new Crea( config.crea.username, config.crea.password );

console.log(crea.apiUrls);

async function testGetCookie() {

    // wait the authorization to complete.
    await crea._authorized;

    //console.log(cookie);
    console.log(crea.cookie);
}

testGetCookie();
