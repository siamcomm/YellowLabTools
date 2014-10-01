/**
 * Launches the phantomas tool with correct options
 */

var async           = require('async');
var phantomas       = require('phantomas');
var jsStringEscape  = require('js-string-escape');
var httpProxy       = require('./httpProxy');

var PhantomasWrapper = function() {
    'use strict';

    /**
     * This is the phantomas launcher. It merges user chosen options into the default options
     * Available options :
     *
     * - timeout : in seconds (default 60)
     * - jsDeepAnalysis : should we inspect subrequests in the javascript execution tree (reported durations of main tasks will be slower than usual)
     *
     */
     this.execute = function(task, callback) {

        var options = {
            // Cusomizable options
            timeout: task.options.timeout || 60,
            'js-deep-analysis': task.options.jsDeepAnalysis || false,

            // Mandatory
            reporter: 'json:pretty',
            'analyze-css': true,
            proxy: task.options.jsTiming ? 'localhost:3838' : null,
            'skip-modules': [
                'blockDomains',     // not needed
                'analyzeCss',       // overriden
                'domComplexity',    // overriden
                'domMutations',     // not compatible with webkit
                'domQueries',       // overriden
                'eventListeners',   // overridden
                'filmStrip',        // not needed
                'har',              // not needed for the moment
                'pageSource',       // not needed
                'screenshot',       // not needed for the moment
                'waitForSelector',  // not needed
                'windowPerformance' // overriden
            ].join(','),
            'include-dirs': [
                'phantomas_custom/core',
                'phantomas_custom/modules'
            ].join(',')
        };

        // Output the command line for debugging purpose
        console.log('If you want to reproduce the phantomas task only, copy the following command line:');
        var optionsString = '';
        for (var opt in options) {
            optionsString += ' ' + '--' + opt + '=' + options[opt];
        }
        console.log('node node_modules/phantomas/bin/phantomas.js --url=' + task.url + optionsString + ' --verbose');

        // Kill the application if nothing happens for 10 minutes
        var killer = setTimeout(function() {
            console.log('Killing the server because the test ' + task.testId + ' on ' + task.url + ' was launched 10 minutes ago');
            // Forever will restart the server
            process.exit(1);
        }, 600000);

        // Start the http proxy for JS timing (if needed)
        var jsTimingProxy;
        if (task.options.jsTiming) {
            jsTimingProxy = new httpProxy();
            jsTimingProxy.start(3838, function(bodyBuffer, $url, $index) {

                // Inspired by https://github.com/etsy/DeviceTiming
                var head = new Buffer('__phantomas.jsTimers[' + $index + '] = new __phantomas.jsTimer("' + $url + '");\neval("__phantomas.jsTimers[' + $index + '].parsed();\\n');
                var body = new Buffer(jsStringEscape(bodyBuffer));
                var foot = new Buffer('");\n__phantomas.jsTimers[' + $index + '].end();');

                return Buffer.concat([head, body, foot]);
            });
        }

        // It's time to launch the test!!!
        var triesNumber = 3;

        async.retry(triesNumber, function(cb) {
            phantomas(task.url, options, function(err, json, results) {
                console.log('Returning from Phantomas');

                // Adding some YellowLabTools errors here
                if (json && json.metrics && !json.metrics.javascriptExecutionTree) {
                    err = 1001;
                }

                if (!err && (!json || !json.metrics)) {
                    err = 1002;
                }

                // Don't cancel test if it is a timeout and we've got some results
                if (err === 252 && json) {
                    console.log('Timeout after ' + options.timeout + ' seconds. But it\'s not a problem, the test is valid.');
                    err = null;
                }

                if (err) {
                    console.log('Attempt failed for test id ' + task.testId + '. Error code ' + err);
                }

                cb(err, {json: json, results: results});
            });
        }, function(err, data) {

            clearTimeout(killer);

            if (task.options.jsTiming) {
                jsTimingProxy.stop();
            }

            if (err) {
                console.log('All ' + triesNumber + ' attemps failed for test id ' + task.testId);
            }
            callback(err, data.json, data.results);
        });

    };
};

module.exports = new PhantomasWrapper();