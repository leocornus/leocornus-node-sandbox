"use strict";

// using the UUID v4.
const config = require("../config");
const Vitrium = require("../libs/vitrium");
const logger = require('log4js').getLogger('drm');

module.exports = function(app) {

    // download file using the post protocol.
    app.post("/drm/download", function(req, res) {

        // check the body.
        logger.debug("request payload: ", req.body);

        let vitrium = new Vitrium(
            config.vitrium.accountToken,
            config.vitrium.userName,
            config.vitrium.password,
            config.vitrium.formId
        );

        // the req.body will the payload.
        vitrium.versionUnique(req.body, (uniqueRes, uniqueErr) => {

            logger.debug('Unique respose headers: ', uniqueRes.headers);

            // set header from the unique response.
            res.setHeader('Content-Disposition',
                    uniqueRes.headers['content-disposition']);
            res.setHeader('Content-Type',
                    uniqueRes.headers['content-type']);
            res.setHeader('Content-Length',
                    uniqueRes.headers['content-length']);
            // the data is a stream.
            uniqueRes.data.pipe(res);
        });
    });

    // quick test for download.
    app.get("/drm/download", function(req, res) {

        // redirect to homepage.
        res.redirect(301, config.server.homeRedirectUrl);
    });
};
