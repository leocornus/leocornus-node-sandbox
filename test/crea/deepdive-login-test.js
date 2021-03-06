/**
 * quick test to get connect to CREA service.
 */

const axios = require('axios');
const request = require('request');
const md5 = require('crypto-js/md5');
const parseXml = require('xml2js').parseString;

// load configuration
const config = require('./../../src/config');
const localConfig = config.crea;

console.log(localConfig.loginUrl);

// CREA using digest auth to do authentication:
// issue the challendge request
axios.get(localConfig.loginUrl).then(function(response) {
    //console.dir(response.response);
    console.dir(response.response.headers);
}).catch(function(error) {
    // we expect error here.
    //console.dir(error.response);
    console.dir(error.response.headers);

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
    console.dir(challengeParams);

    // calculate Authorization digest string.
    var ha1 = md5(localConfig.username + ':' + 
                  challengeParams.realm + ':' + localConfig.password)
    var ha2 = md5('GET:' + localConfig.loginUrl)
    var response = md5(ha1 + ':' + challengeParams.nonce + ':1::auth:' + ha2)
    var authParams = {
      username : localConfig.username,
      realm : challengeParams.realm,
      nonce : challengeParams.nonce,
      uri : localConfig.loginUrl, 
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
    console.log(authParamStr);
    var authOptions = {
        headers: {
            "Authorization": authParamStr,
            "Cookie": challengeCookie
        }
    };

    axios.get(localConfig.loginUrl, authOptions).then(function(response) {
        console.log("Success!");
        //console.dir(response);
        console.dir(response.headers);
        var authCookie = response.headers['set-cookie'][0].split('; ')[0];
        console.dir(response.data);
        console.dir(challengeCookie + '; ' + authCookie);

        // parse the result to JSON format.
        parseXml( response.data, function( err, result ) {

            console.log(result);
        } );
    }).catch(function(error) {
        console.log("Failed!");
    });
});
