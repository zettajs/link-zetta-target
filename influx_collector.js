// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var InfluxNodeClient = require('./influx_node_client');
var InfluxCollector = require('zetta-device-data-influxdb');
var url = require('url');

module.exports = function(server) {

  var opts = {
    host: process.env.COREOS_PRIVATE_IPV4
  };
  // allow a list of peers to be passed, overides COREOS_PRIVATE_IPV4
  if (process.env.ETCD_PEER_HOSTS) {
    opts.host = process.env.ETCD_PEER_HOSTS.split(',');
  }
  
  var client = new InfluxNodeClient(opts);
  var db = process.env.INFLUX_DATABASE;
  client.findAll(function(err, results) {

    client.on('change', function(results) {
      if(results.length) {
        update(results[0]);
      } 
    });

    if(!err && results.length) {
      return connect(results[0]);
    } 

    if(err) {
      server.log('Error searching for influx: ' + err);
    }

      
  });
  
  var influx = null;
  function connect(influxUrl) {
    server.log('Connecting to influxdb at: ' + influxUrl.url);
    var endpoint = influxUrl.url;
    var endpointUrl = url.parse(endpoint);
    var opts = {
      host: endpointUrl.hostname,
      port: endpointUrl.port,
      database: db
    }


    influx = new InfluxCollector(opts);
    influx._collect(server);

  }

  function update(influxUrl) {
    if(influx) {
      server.log('Updating influx url: ' + influxUrl.url);
      var endpoint = influxUrl.url;
      var endpointUrl = url.parse(endpoint);
      var opts = {
        host: endpointUrl.hostname,
        port: endpointUrl.port,
        database: db
      } 

      influx.configure(opts);
    } else {
      connect(influxUrl);
    }
  }
}
