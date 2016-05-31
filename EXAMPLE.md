# Example

## Step 0  - Metadata
Imagine we are writing learning software and want to denormalize the following schema:

```sql
CREATE TABLE department AS {
  id bigint PRIMARY KEY,
  name varchar(255),
}

CREATE TABLE course AS {
  id bigint PRIMARY KEY,
  department_id bigint,
  name varchar(255),
  code varchar(50)
}

CREATE TABLE assignment AS {
  id bigint PRIMARY KEY,
  course_id bigint,
  name varchar(255),
  points_possible integer,
}

CREATE TABLE submission AS {
  id bigint PRIMARY KEY,
  assignment_id bigint,
  score integer
}

CREATE TABLE file AS {
  id bigint PRIMARY KEY,
  submission_id bigint,
}
```

Consider the following metadata

|Table | Active FK
|------
|assignment | course_id
|submission | assignment_id
|file | submission_id
|file | department_id
|file | assignment_id


|Source Table | Source Field | Target Table | Target Field|
|---|
|course| department_id | assignment |  department_id
|assignment | course_id | submission | course_id
|assignment | department_id | submission | department_id
|submission | assignment_id | file | assignment_id
|submission | course_id | file | course_id
|submission | department_id | file | department_id
|department | name | file | department_name
|assignment | points_possible | file points_possible

_note that some fields are both a source and a target_


## Step 1 - Course and Department

The first delta is a new department:

```json
{
  "table": "department",
  "version": 10001,
  "id": 1001,
  "name": "Humanities",
}
```

This should be written into the MoM as such. Note that the outer key is a
composite key of the table and the primary key, and the inner keys are composite
keys of the column name and the version:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities

next a new course:

```json
{
  "table": "course",
  "version": 10001,
  "id": 2001,
  "department_id": 1001,
  "name": "Philosophy 101",
  "code": "HU 101"
}
```

updated MoM:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
|**course:2001** | **department_id:10001** | **name:10001** | **code:10001**|
| | **1001** | **Philosophy 101** | **HU 101**

## Step 2 - MoM fires first events

We've been writing to the MoM and the MoM has started firing events.  The first
event we get is for the new department.

```json
{
  "id": "department:1001",
  "old": {},
  "new": {
    "name:10001": "Humanities"
  }
}
```

The code checks for deltas in the following:
  * active foreign keys - no active FKs
  * source fields - ```name``` is a source for ```file.department_name```.  However,
there are no children
  * children added/deleted - none

the next MoM event is the course
```json
{
  "id": "course:2001",
  "old": {},
  "new": {
    "department_id:10001": 1001,
    "name:10001": "Philosophy 101",
    "code:10001": "HU 101"
  }
}
```
  * active foreign keys - none
  * source fields - ```department_id``` is a source field, but no children
  * children added/deleted - none


## Step 3 - Assignment

A new assignment record arrives, MoM is updated:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
|course:2001 | department_id:10001 | name:10001 | code:10001|
| | 1001 | Philosophy 101 | HU 101
|**assignment:3001**|** course_id:10002** |** name:10002** |** points_possible:10002**
||**2001**| **Logic Quiz **| **100**

## Step 4 - Events from Assignment

with the new assignment, a new event is fired:

  * active foreign keys - course_id is active, write a child add record to ```course:2001```
  * source fields - ```department_id``` is a source field, but no children
  * children added/deleted - none

MoM:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |**_children:assignment:course_id:3001:10002**
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002
||2001| Logic Quiz | 100

## Step 5 - Events from Events

The events from Step 4 updated the MoM, so more events are fired (well, one event).

```json
{
  "id": "course:2001",
  "old": {
    "department_id:10001": 1001,
    "name:10001": "Philosophy 101",
    "code:1001": "HU 101"
  },
  "new":  {
    "department_id:10001": 1001,
    "name:10001": "Philosophy 101",
    "code:1001": "HU 101",
    "_children:assignment:assignment_id:3001:10002": "add"
  },
}
```
  * active foreign keys - none
  * source fields - ```department_id``` is a source field, but no changes
  * children added/deleted - ```assignment:3001``` added.  populate target fields

MoM:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | **department_id**
||2001| Logic Quiz | 100 | **1001**

## Step 5 - Events from Events from Events

The addition of department_id triggered another event

  * active foreign keys - ```course_id``` active, but no change
  * source fields - ```course_id``` is a source field, but no changes ```department_id``` is an update source field, but no children
  * children added/deleted - none

MoM: no changes

## Step 6 - File

Here is a little bit of a twist.  Looks like we got the file data before the submission data it refers to.

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id
||2001| Logic Quiz | 100 | 1001
|**file:5001**| **submission_id:10009** |
| | **4001** |

## Step 7 - Events from File

  * active foreign keys - ```submission_id``` active/new, add child record to `submission:4001`, ```department_id``` no change
  * source fields - none
  * children added/deleted - none

MoM:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id
||2001| Logic Quiz | 100 | 1001
|file:5001| submission_id:10009 |
| | 4001 |
|**submission:3001**|**_children:file:submission_id:5001:10009**
| | **add**

## Step 7 - Events from Events from File

new submission

  * active foreign keys - ```assignment_id``` no change
  * source fields - ```department_id```, ```course_id```, ```assignment_id``` no change
  * children added/deleted - none

MoM:no change

## Step 8 - Submission

Better late than never, the submission finally arrives

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id
||2001| Logic Quiz | 100 | 1001
|file:5001| submission_id:10009 |
| | 4001 |
|submission:4001|_children:file:submission_id:5001:10009 | **assignment_id:10007** | **score:10007**
| | add | **3001** | **87**

## Step 9 - Events from Submission

new Submission

  * active foreign keys - ```assignment_id``` -  new, add child to ```assignment:3001```
  * source fields - ```department_id```, ```course_id``` - no change, ```assignment_id``` - new , propagate to file
  * children added/deleted - none

MoM:

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | **_children:submission:assignment_id:4001:10007**
||2001| Logic Quiz | 100 | 1001 | **add**
|file:5001| submission_id:10009 | **assignment_id:10007**
| | 4001 | **3001**
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007
| | add | 3001 | 87

## Step 10 - Events from Events from Submission

updated assignment

  * active foreign keys - ```course_id``` - no change
  * source fields - ```department_id```, ```course_id```, ```points_possible``` - no change
  * children added/deleted - submission child added - write ```department_id```, ```course_id```

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007
| | 4001 | 3001
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | **department_id** | **course_id**
| | add | 3001 | 87 | **1001** | **2001**

updated file

  * active foreign keys - ```department_id``` - no change, ```assignment_id``` -  new, write child add record to assignment:3001`
  * source fields - none
  * children added/deleted - none

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007 | **_children:file:assignment_id:5001:10007**
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007
| | 4001 | 3001
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | department_id | course_id
| | add | 3001 | 87 | 1001 | 2001



## Step 11 - Events from Events from Events from Submission

updated submission

  * active foreign keys - ```assignment_id``` - no change
  * source fields - ```department_id```, ```course_id``` - new, propagate to children (```file:5001```)
  * children added/deleted - none

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007 | _children:file:assignment_id:5001:10007
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007| **department_id** | **course_id**
| | 4001 | 3001| **1001** | **2001**
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | department_id | course_id
| | add | 3001 | 87 | 1001 | 2001

updated assignment

  * active foreign keys - ```course_id``` - no change
  * source fields - ```department_id```, ```course_id```, ```points_possible``` - no change
  * children added/deleted - submission child added - write ```points_possible```

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 |
| | Humanities
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007 | _children:file:assignment_id:5001:10007
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007| department_id | course_id | **points_possible**
| | 4001 | 3001| 1001 | 2001 | **100**
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | department_id | course_id
| | add | 3001 | 87 | 1001 | 2001



## Step 12 - (Events from)^4 Submission  

updated file

  * active foreign keys - ```department_id``` - new, write child add record to `department:1001`
  * source fields - none
  * children added/deleted - none

 _note: this is a demonstration, but this might be a bad idea in practice.  
 the fan-out from a department maintaining a list of every file submitted for
 every assignment for every course might get unwieldy.  The alternative would be
 to propagate the fields to denormalize through all the levels instead of activating
 the foreign key directly from the `file` table_

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 | **_children:file:department_id:5001:10007**
| | Humanities | **add**
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007 | _children:file:assignment_id:5001:10007
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007| department_id | course_id | points_possible
| | 4001 | 3001| 1001 | 2001 | 100
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | department_id | course_id
| | add | 3001 | 87 | 1001 | 2001

## Step 13 - (Events from)^5 Submission  

updated department

  * active foreign keys - none
  * source fields - ```name```, no change
  * children added/deleted - new child ```file:5001```, propagate ```name```

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 | _children:file:department_id:5001:10007
| | Humanities | add
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007 | _children:file:assignment_id:5001:10007
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007| department_id | course_id | points_possible | **department_name**
| | 4001 | 3001| 1001 | 2001 | 100 | **Humanities**
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | department_id | course_id
| | add | 3001 | 87 | 1001 | 2001


## Step 14 - (Events from)^6 Submission

updated file

  * active foreign keys - `department_id`, `assignment_id` - no change
  * source fields - no change
  * children added/deleted - no change

MoM: no change


## Final MoM

the final denormalized MoM

|outer key | inner key/values |
|---|---|---|---|
|department:1001 | name:10001 | _children:file:department_id:5001:10007
| | Humanities | add
| course:2001 | department_id:10001 | name:10001 | code:10001  |_children:assignment:course_id:3001:10002
| | 1001 | Philosophy 101 | HU 101 | add
|assignment:3001| course_id:10002 | name:10002 | points_possible:10002 | department_id | _children:submission:assignment_id:4001:10007 | _children:file:assignment_id:5001:10007
||2001| Logic Quiz | 100 | 1001 | add
|file:5001| submission_id:10009 |assignment_id:10007| department_id | course_id | points_possible | department_name
| | 4001 | 3001| 1001 | 2001 | 100 | Humanities
|submission:4001|_children:file:submission_id:5001:10009 | assignment_id:10007 | score:10007 | department_id | course_id
| | add | 3001 | 87 | 1001 | 2001
