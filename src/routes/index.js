"use strict";

let config      = require("../config");

module.exports = function(app) {

    // Index page
    app.get("/", function(req, res) {

        res.send('<h1>Hello Express World</h1>');
    });

    // stream apis.
    require("./stream.js")(app);

    // some client.
    require("./client.js")(app);

    // some clients dddddddd.
    require("./drm.js")(app);
};
