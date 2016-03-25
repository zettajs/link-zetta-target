var zetta = require('zetta');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var DeviceDataSqs = require('zetta-device-data-sqs');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var MqttScout = require('./mqtt/scout');

var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';

var instance = zetta({
  registry: new MemoryRegistry(), // no device registry is needed
  peerRegistry: new MemoryPeerRegistry()
});

instance.name('cloud-devices');

// MQTT is enabled only if there is a broker URL
if (process.env.MQTT_BROKER_URL) {
  console.log('Enabling MQTT scout to broker ', process.env.MQTT_BROKER_URL);
  instance.use(MqttScout, { clientId: (process.env.COREOS_PRIVATE_IPV4 || 'localhost') + ':' + port,
                            url: process.env.MQTT_BROKER_URL
                          });
}

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

instance.listen(port);


