var AWS = require("aws-sdk")
var async = require("async")
let dyn = new AWS.DynamoDB({endpoint: "http://dyn.docker:8000" })
let dynst = new AWS.DynamoDBStreams({endpoint: "http://dyn.docker:8000" })

function createTable(dyn, tableName, cb) {
  dyn.deleteTable({TableName: tableName}, (err, data) => {
    let params = {
      TableName: "Denorm",
      KeySchema: [
        {
          AttributeName: "key",
          KeyType: "HASH"
        }
      ],
      AttributeDefinitions: [
        {
          AttributeName: "key",
          AttributeType: "S"
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      },
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: 'NEW_AND_OLD_IMAGES'
      }
    }
    dyn.createTable(params, cb)
  })
}

function loadData(cb) {
  let item = {
    TableName: "Denorm",
    Item: {
      key : { S: "key2"},
      "foo:1" : {S: "value1"}
    }
  }
  dyn.putItem(item, (err, data) => {
    if (err) {
      console.error("Unable to add row. Error JSON:", JSON.stringify(err, null, 2));
      cb(err, null)
    } else {
      let updatedItem = {
        TableName: "Denorm",
        Key :  {key : { S: "key1"}},
        AttributeUpdates: { "foo:2": { Action: 'PUT', Value: { S: "value2" }}}
      }
      dyn.updateItem(updatedItem, cb)
    }
  })
}

function output(data) {
  console.log(JSON.stringify(data, null, 2))
}

function readShardIterator(shardIterator, cb) {
  dynst.getRecords({ShardIterator: shardIterator}, (err, data) => {
    if (err) cb(err, null)
    if (data != null && data.Records.length > 0) {
      // not sure this is a great pattern, maybe should be using pipes? wish I knew how to use pipes...
      output( data.Records)
      setTimeout(readShardIterator.bind(this, data.NextShardIterator, cb), 0)
    } else {
      console.log("nodata")
      setTimeout(readShardIterator.bind(this, shardIterator, cb), 1000)
    }
  })
}

function readShard(arn, shard, cb) {
  var iter = { ShardId: shard.ShardId, ShardIteratorType: 'TRIM_HORIZON', StreamArn: arn }
  dynst.getShardIterator(iter, (err, data) => {
    if (err) cb(err, null)
    readShardIterator(data.ShardIterator, cb)
  })
}

function readStream(cb) {
  dyn.describeTable({ "TableName" : "Denorm" }, (err, data) => {
    if (err) cb (err, null)
    let arn = data.Table.LatestStreamArn
    dynst.describeStream({ StreamArn: arn}, (err,data) => {
      if (err) cb(err, null)
      async.each(data.StreamDescription.Shards, readShard.bind(this, arn), cb)
    })
  })
}

function main(cb) {
  dyn.listTables({}, (err, tables) => {
    if (err) cb(err,null)
    createTable(dyn, "Denorm", (err,data) => {
      if (err) cb(err,null)
      loadData((err, data) => {
        if (err) cb (err, null)
        readStream(cb)
      })
    })
  })
}

main((err, data) => console.log("done",  JSON.stringify(data, null, 2)))
