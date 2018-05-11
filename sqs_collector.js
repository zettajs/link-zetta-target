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

var AWS = require('aws-sdk');
var Rx = require('rx');

module.exports = function(options){

  var options = options || {};

  if(!options.queueUrl) {
    throw new Error('Must supply queueUrl');  
  }

  var emitter = options.emitter;
  var queue = new AWS.SQS({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region || 'us-east-1'
  });
  
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

  var source = Rx.Observable.fromEvent(emitter, 'data');

  source
    .filter(function(x) {
      return x.connectionId;
    })
    .groupBy(function(x) {
      return x.connectionId  
    })
    .subscribe(function(obs){
      obs
        .sample(3000)
        .subscribe(function(data){
          data.upload = new Date().getTime();
          sendMessage(JSON.stringify(data));
        });  
    });
}
