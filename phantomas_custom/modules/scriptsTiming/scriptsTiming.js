/**
 * Read the timings from the JS proxy (app/lib/httpProxy.js)
 */

exports.version = '0.1';

exports.module = function(phantomas) {
    'use strict';

    phantomas.setMetric('scriptsTiming'); // @desc  @offenders

    phantomas.once('init', function() {
        phantomas.evaluate(function() {
            (function(phantomas) {

                phantomas.jsTimers = [];
                
                phantomas.jsTimer = function(url) {
                    var startTime = Date.now();
                    var parsedTime;

                    return {
                        parsed: function() {
                            parsedTime = Date.now();
                        },
                        end: function() {
                            var endTime = Date.now();
                            phantomas.incrMetric('scriptsTiming', endTime - startTime);
                            phantomas.addOffender('scriptsTiming', JSON.stringify({
                                url: url,
                                startTime: startTime,
                                parsing: parsedTime - startTime,
                                executing: endTime - parsedTime
                            }));
                        }
                    };
                };
            })(window.__phantomas);
        });
    });
};
