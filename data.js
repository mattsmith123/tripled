var AWS = require("aws-sdk")
var async = require("async")

let data = []
let version = 2

function makeRow(tableName, version, a) {
  data.push(Object.assign({__table: tableName, __version: version}, a))
}

let row = makeRow.bind(this, "accounts", version)
row({id: "101", name: "My University"})
row({id: "102", name: "Engineering", parent_id: "101"})
row({id: "103", name: "Science", parent_id: "101"})
row({id: "104", name: "Fine Arts", parent_id: "101"})
row({id: "105", name: "Physical Science", parent_id: "103"})
row({id: "106", name: "Life Science", parent_id: "103"})
row({id: "107", name: "Chemistry", parent_id: "105"})

row = makeRow.bind(this, "courses", version)
row({id: "201", name: "Music Appreciation", account_id: "104"})
row({id: "202", name: "Organic Chemistry", account_id: "106"})

function loadRow(dyn, denormTableName, row, cb)  {
  let primaryId = row.id
  let key = `${row.__table}~${primaryId}`
  version = row.__version
  updates  = {};
  for (fld in row) {
    if (!fld.startsWith("__")) {
      let update = {}
      updates[`${fld}.${version}`] = { Action: 'PUT', Value: { S: row[fld]} }
    }
  }
  let message = {
    TableName: denormTableName,
    Key :  {key : { S: key}},
    AttributeUpdates: updates
  }
  console.log(JSON.stringify(message, null, 2))
  dyn.updateItem(message, cb)
}

function loadData(dyn, denormTableName) {
  async.each(data, loadRow.bind(this, dyn, denormTableName), (err, data) => {
    if (err) console.log("error", err)
    console.log("done")
  })
}
let dyn = new AWS.DynamoDB({endpoint: "http://dyn.docker:8000" })

loadData(dyn, "Denorm")
