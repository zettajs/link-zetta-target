var InfluxNodeClient = require('./influx_node_client');
var InfluxCollector = require('zetta-device-data-influxdb');
var url = require('url');

module.exports = function(server) {
  var client = new InfluxNodeClient({host: process.env.COREOS_PRIVATE_IPV4 || '172.17.8.104' });
  var connected = false;
  var interval = setInterval(function() {
    if(connected) {
      return clearInterval(interval);
    }
    client.findAll(function(err, results) {
      if(!err) {
        var endpoint = results[0].url;
        var endpointUrl = url.parse(endpoint);
        var opts = {
          host: endpointUrl.hostname,
          port: endpointUrl.port,
          database: 'deviceData'
        }

        var influx = new InfluxCollector(opts);
        connected = true;
        influx._collect(server);
      }  
    });
  }, 3000);
  
}
