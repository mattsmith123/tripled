
module.export = [
  {
    name: "accounts",
    primaryKeys: ["id"],
    columns: [
      {
        name: "id",
      },
      {
        name: "name"
      },
      {
        name: "parent_id"
      }
      {
        name: "ancestors"
        //eval: "parent_id == null ? [] : parent_id.ancestors ++ id"
        selfJoin: "parent_id"
      }
      {
        name: "sub_account_0
        subscriptionSink: {
          address: "ancestors"
          transform: {
            index: {
              column: "ancestors"
              index: 0
            }            
          }
        }

      }
    ]
  },
  {
    name: "courses",
    primaryKeys: ["id"],
    columns: [
      {
        name: "id",
      },
      {
        name: "name"
      },
      {
        name: "account_id"
      }
    ]
  },
  {
    name: "assignments",
    primaryKeys: ["id"],
    columns: [
      {
        name: "id",
      },
      {
        name: "name"
      },
      {
        name: "course_id",
        subscriptionSource: [
           {
             table: "submissions",
             column: "course_id"
           }
         ]
      },
      {
        name: "account_id"
      },
      {
        name: "points_possible"
      }
    ]
  },
  {
    name: "discussion_topics",
    primaryKeys: ["id"],
    columns: [
      {
        name: "id",
      },
      {
        name: "subject",
      },
      {
        name: "course_id"
      },
      {
        name: "account_id"
      },
      {

  {
    name: "submissions",
    primaryKeys: ["id"],
    columns: [
      {
        name: "id",
      },
      {
        name: "name"
      },
      {
        name: "assignment_id",
        relation: {
          target: "assignments",
          targetKey: ["id"]
        },
        subscriptionIndirect: ["course_id", "account_id"]
      },
      {
        name: "user_id"
      },
      {
        name: "course_id",
        relation: {
          target: "courses",
          targetKey: ["id"]
        },
        subscriptionSink: {
          address: "assignment_id.course_id"
        },
        subscriptionIndirect: ["name"]
      }, {
        name: "account_id",
        subscriptionSink: {
          address: "assignment_id.account_id"
        }
      }, {
        name: "course_name",
        subscriptionSink: {
          address: "course_id.name" // possible fanout issue linking directly from subscriptions to course!!!!
        }
      }

    ]
  },
  {

  }
];
