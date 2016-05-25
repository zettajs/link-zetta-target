var InfluxNodeClient = require('./influx_node_client');
var InfluxCollector = require('zetta-device-data-influxdb');
var url = require('url');

module.exports = function(server) {
  var client = new InfluxNodeClient({host: process.env.COREOS_PRIVATE_IPV4});
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
