/**  
 * MediaWiki API Demos
 * Demo of `Login` module:
 * - Sending post request to login
 * - get items from a given category
 * update to use Got.
 * - https://github.com/sindresorhus/got
 * - using the default Memory cookie store
 */

const querystring = require('querystring');
const got = require('got');
const toughCookie = require('tough-cookie');

// we will execute the script by using nvm, for example:
// $ nvm run node test-login-got.js
const rawParams = process.argv.slice(2);
console.log(rawParams);

const url = "https://" + rawParams[0] + "/w/api.php";
console.log(url);

// set up a Got instance with cookie jar.
// Got will handle all cookie related work.
const cookieJar = new toughCookie.CookieJar();
const gotInstance = got.extend( {
    cookieJar
} );

// Step 1: GET Request to fetch login token
function getLoginToken() {

    var params_0 = {
        action: "query",
        meta: "tokens",
        type: "login",
        format: "json"
    };

    // use querystring to build the HTTP query string
    let query = url + "?" + querystring.encode(params_0);
    console.log(query);

    // The default request method is GET,
    // the following 2 lines are the same.
    //gotInstance(query).
    gotInstance.get(query).
        then(res => {

            let data = JSON.parse(res.body);
            console.log(data);
            //console.log(res.headers);
            console.log(cookieJar.getCookiesSync('https://' + rawParams[0]));
            loginRequest(data.query.tokens.logintoken,
                res.headers['set-cookie'][0].split("; ")[0]
            );
        }).
        catch(error => {

            console.log(error);
            return;
        });
}

// Step 2: POST Request to log in. 
// Use of main account for login is not
// supported. Obtain credentials via Special:BotPasswords
// (https://www.mediawiki.org/wiki/Special:BotPasswords) for lgname & lgpassword
function loginRequest(login_token, auth_cookie) {

    var params_1 = {
        action: "login",
        // we need use bot user account here.
        lgname: rawParams[1],
        lgpassword: rawParams[2],
        lgtoken: login_token,
        format: "json"
    };

    gotInstance.post(url, {
        //json: params_1,
        // POST request need use form for the post data.
        form: params_1,
        //headers: {
        //    cookie: auth_cookie
        //}
    }).
        then( response => {
            console.log(response.body);
            //console.log(response.req.headers);
            //console.log(response.headers);
            //console.log(cookieJar);
            console.log(cookieJar.getCookiesSync('https://' + rawParams[0]));
            getCategoryItems(rawParams[3]);
        }).
        catch( error => {
            console.log(error);
        });
}


function getCategoryItems(category) {

    let params_3 = {
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:" + category,
        cmlimit: "5",
        //token: token,
        format: "json"
    };

    let query = url + "?" + querystring.encode(params_3);
    console.log(query);

    gotInstance.get(query)
    .then( res => {

        //console.log(JSON.parse(res.body));
        // NOTE:
        // need parse body to JSON format.
        JSON.parse(res.body).query.categorymembers.forEach( item => {
            console.log( `${item.pageid}: ${item.title}` );
        });
        //console.log(cookieJar);
        console.log(cookieJar.getCookiesSync('https://' + rawParams[0]));

    }).catch( error => {
        console.log(error);
    });
}

// Start From Step 1
getLoginToken();
