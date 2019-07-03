"use strict";

/**
 * utilities to manipulate CREA RET APIs.
 */
// get log4j logger.
const logger = require('log4js').getLogger('crea');

const axios = require('axios');
const md5 = require('crypto-js/md5');
const fs = require('fs');

/**
 * using the function expressions to define the class.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/function
 *
 * This fuunction is actually works as a constructor.
 */
const Crea = function Crea (username, password) {

    // base url to access crea.ca.
    this.apiBaseUrl = 'https://data.crea.ca/';
    this.apiUrls = {
        'Login': this.apiBaseUrl + 'Login.svc/Login',
        'Logout': this.apiBaseUrl + 'Logout.svc/Logout',
        'Search': this.apiBaseUrl + 'Search.svc/Search',
        'GetObject': this.apiBaseUrl + 'Object.svc/GetObject',
        'GetMetadata': this.apiBaseUrl + 'Metadata.svc/GetMetadata'
    };

    this.username = username;
    this.password = password; 

    // set the instance property.
    this.cookie = null;
    // cookie should have this following format.
    // { realm: '',
    //   nonce: '',
    //   qop: '',
    //   cookie: '' }

    // local file to store the API session token.
    this.cookieFilePath = '/tmp/' + md5(username + password);

    // check the cookie age, create new one if it is expired.
    // set it as a promise object.
    this._authorized = this.authorize();

    logger.info( `Current session: ${this.cookie}` );
};

// export the crea module.
module.exports = Crea;

/**
 * Challenge the server and get authorized.
 */
Crea.prototype.authorize = async function() {

    let self = this;

    // using try catch block to make sure the async promise is fulfilled.
    try {
        // check the local cookie file
        if(fs.existsSync( self.cookieFilePath )) {
            // check the modified time to calculate the age.
            let stats = fs.statSync(self.cookieFilePath);
            let age = (new Date()).getTime() - stats.mtimeMs;
            // if age is less than 1 hour, it is still valid.
            if(age < 3600000) {
                logger.info( 'Trying to use an existing cookie' );
                // set cookie;
                self.cookie = JSON.parse(fs.readFileSync( self.cookieFilePath, 'utf8' ));
            }
        }

        // no cookie exists
        if( self.cookie === null ) {
            logger.info( "Trying to authenticate for account: " +
                         self.username);
            // set cookie;
            self.cookie = await self.getCookie();
        }

        if( self.cookie === null ) {
            // try again.
            // TODO: set timeout!
            const cookie = await self.getCookie();
        } else {
            logger.info("Successfully authenticated!");
            // write the same tokens to update modified time.
            fs.writeFileSync(self.cookieFilePath,
                             JSON.stringify(self.cookie), 'utf8');
        }

        // return will fulfill the async function promise.
        return self.cookie;
    } catch( err ) {
        logger.error('Failed to authorize: ', err);
        throw Error(err);
    }
};

/**
 * get cookie
 */
Crea.prototype.getCookie = async function() {

    let self = this;

    try {
        await axios.get(self.apiUrls.Login);
    } catch (error) {

        logger.debug('401 response headers: ', error.response.headers);
        // get the authentication params
        var challengeHeaders = error.response.headers['www-authenticate'];
        var challengeCookie = error.response.headers['set-cookie'][0].split('; ')[0];
        var challengeParams = challengeHeaders.substring(7).split( ', ' ).
            // convert an arry to a Object.
            reduce( (params, item) => {

                if( item.startsWith('nonce') ) {
                    var parts = item.split('nonce=');
                    params['nonce'] = parts[1].replace(/"/g, '');
                } else {
                    var parts = item.split('=');
                    params[parts[0]] = parts[1].replace(/"/g, '');
                }
                return params;
            }, {} );
        logger.debug('The challenge params: ', challengeParams);

        // calculate Authorization digest string.
        var ha1 = md5(self.username + ':' + 
                      challengeParams.realm + ':' + self.password)
        var ha2 = md5('GET:' + self.apiUrls.Login)
        var response = md5(ha1 + ':' + challengeParams.nonce + ':1::auth:' + ha2)
        var authParams = {
          username : self.username,
          realm : challengeParams.realm,
          nonce : challengeParams.nonce,
          uri : self.apiUrls.Login, 
          qop : challengeParams.qop,
          response : response,
          nc : '1',
          cnonce : '',
        };

        // stringify the params:
        var authParamStr = Object.keys(authParams).reduce( (paramStr, key) => {
            return paramStr + ', ' + key + '="' + authParams[key] + '"';
        }, '' );
        authParamStr = 'Digest ' + authParamStr.substring(2);
        logger.debug("Digest String: ", authParamStr);
        var authOptions = {
            headers: {
                "Authorization": authParamStr,
                "Cookie": challengeCookie
            }
        };

        try {
            let authRes = await axios.get(self.apiUrls.Login, authOptions);
            let authCookie = authRes.headers['set-cookie'][0].split('; ')[0];
            challengeParams['cookie'] = challengeCookie + "; " + authCookie;
            logger.debug('The authorize params: ', challengeParams);
            return challengeParams;
        } catch( authErr ) {
            console.error(authErr);
            throw Error(authErr);
        }
    }
};
