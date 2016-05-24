var zetta = require('zetta');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var DeviceDataSqs = require('zetta-device-data-sqs');
var DeviceDataInflux = require('./influx_collector');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';
var RestartResource = require('./restart_resource');



var instance = zetta({
  registry: new MemoryRegistry(), // no device registry is needed
  peerRegistry: new MemoryPeerRegistry()
});

instance.name('cloud-' + port);
instance.use(function(server) {
  server.httpServer.cloud.add(RestartResource);
});

if (process.env.DEVICE_DATA_QUEUE) {
  var sqs = new DeviceDataSqs({
    queueUrl: process.env.DEVICE_DATA_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET
  });
  instance.use(sqs.collect());
}

if (process.env.USAGE_QUEUE) {
  var app = new UsageApp()
  instance.use(app.collect());
  var opts = {
    queueUrl: process.env.USAGE_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET,
    emitter: app
  }
  UsageCollector(opts);
}

if(process.env.INFLUX_DATABASE) {
  instance.use(DeviceDataInflux);
}

instance.listen(port);


