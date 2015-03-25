var AWS = require('aws-sdk');

module.exports = function(options){

  var options = options || {};

  if(!options.queueUrl) {
    throw new Error('Must supply queueUrl');  
  }

  AWS.config.update({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region || 'us-east-1'
  });

  var emitter = options.emitter;
  var queue = new AWS.SQS();
  
  function sendMessage(body) {
    var opts = {
      QueueUrl: options.queueUrl,
      MessageBody: body
    };

    queue.sendMessage(opts, function(err, res) {
      if(err) {
        console.log(err);  
      }  
    });
    
  }

  emitter.on('data', function(data) {
    data.upload = new Date().getTime();
    sendMessage(JSON.stringify(data));  
  });
}
