var Etcd = require('node-etcd');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var InfluxNodeClient = module.exports = function(options) {
  EventEmitter.call(this);
  var self = this;
  this._etcDirectory = '/services/influx';
  options = options || {};
  
  if(!options.client) {
    this._client = new Etcd(options.host);
  } else {
    this._client = options.client;
  }
}

InfluxNodeClient.prototype.findAll = function(cb) {
  this._client.get(this._etcDirectory, { recursive: true, consistent: true }, function(err, results) {
    if(err) {
      cb(err);
    }

    if(results.node && results.node.nodes && results.node.nodes.length > 0) {
      var nodes = results.node.nodes
        .filter(function(item) {
          return !item.dir;
        })
        .map(function(item) {
          try {
            item = JSON.parse(item.value);
            return {
              url: item.url
            };
          } catch(err) {
            return null;
          }
        })
        .filter(function(item) {
          return item !== null;
        })

      cb(null, nodes);
    } else {
      cb(null, []);
    }
  });   
};
