var http = require('http');
var https = require('https');
var Stream = require('stream').Stream;
var url = require('url');
var Rx = require('rx');

var request = exports.request = function(options) {
  options = options || {};
  options.method = options.method || 'GET';

  var uri = options.uri || options.url;
  var parsed = url.parse(uri);

  if (uri) {
    options.hostname = parsed.hostname;
    options.port = parsed.port;
    options.path = parsed.path;
    options.auth = parsed.auth;
  };

  var mod = parsed.protocol === 'https:' ? https : http;

  var observable = Rx.Observable.create(function(observer) {
    var req = mod.request(options);

    req.on('error', function(err) {
      observer.onError(err);
    });

    req.on('response', function(res) {
      res.on('error', function(err) {
        observer.onError(err);
      });

      if (options.buffer) {
        Rx.Node.fromStream(res)
          .reduce(function(acc, data) {
            acc.length += data.length;
            acc.buffers.push(data);

            return acc;
          }, { length: 0, buffers: [] })
          .map(function(body) {
            return {
              statusCode: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(body.buffers, body.length)
            };
          })
          .subscribe(observer);
      } else {
        observer.onNext({
          statusCode: res.statusCode,
          headers: res.headers,
          body: res
        });
        observer.onCompleted();
      }
    });

    var uppercased = options.method.toUpperCase();
    if (['PUT', 'POST', 'PATCH'].indexOf(uppercased) !== -1 && options.body) {
      if (options.body instanceof Stream) {
        req.pipe(options.body)
      } else {
        req.end(options.body);
      }
    } else {
      req.end();
    }
  });

  return observable;
};

exports.get = function(requestUrl, options) {
  options = options || {};

  options.method = 'GET';
  options.uri = requestUrl;

  return request(options);
};
