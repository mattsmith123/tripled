# TripleD

Dynamic Data Denormalization involving three or more levels.

## Denormalization

Denormalization.  It's the battle cry of every NoSql warrior.  It makes sense.
Data does not actually change that much, disk space is cheap and response time
on read is king.  

Many times, when denormalizing, you are dealing with two levels, a parent and a child.
When this is the case, writing denormalization is fairly straightforward.  If
one wants wants to look up data by the parent key and the child key, simply
write the data twice to two tables.  

But what if there is a whole hierarchy
of parent-child relationships?  What if A owns B owns C owns D and I want to
write D but read all the D's for a B.  If at write time D only has a key to
C, denormalizing on the fly can get tricky.

But wait, someone smart has figured this out, right?  Probably. But this is a tough
topic to Google.  I've tried.

The purpose of this project is to document some of the best ideas I've been able
to come up with on my own in hopes that smart people will come along and tell me
how to do it better.

## Keeping it Simple

One possible logical pattern for denormalizing a dataset involves a single data structure:

  * a map of maps that fires events when data changes (exactly once). Let's call this **the MoM**.

And some assumptions:

  * data to be denormalized is delivered in a global order (don't worry, you can always fake a global order using batching).  From here on out let's call this global order the version.
  * the data is in typical third normal form where foreign keys point to their parent table.

### Terminology

 * source - a field that supplies a denormalized value
 * target - a field that receives a denormalized value
 * active foreign key - a foreign key that is used by a source-target pair

_note that a field can be both a source and a target as long as cycles are not created_

### Process

The tripled algorithm is listed below.  There is also an fairly complete [example](example.md).  It is recommended that both are read together to understand the algorithm.

All of these are events that are sourced from the map of maps
except the first which is an event source by the data source.  :

**ON: new delta from source system**

Write each delta into the MoM.  The outer map key will be a composite key of the
table name and the primary key of the row that sourced the delta.  There may already
be data in the map for this row.  The write will add an entry in the map for each
column in the delta.  The key for these entries in the inner map will be a composite key
of the column name and the version in the delta.

**ON: data change event from MoM**

On receiving data change events we will categorize them into three new events.  
Each data change event from the MoM could fire zero or multiple of these events.

 * foreign key changed
 * source field changed
 * children collection changed - don't worry, I'll explain the children collection right now.

**ON: foreign key changed**

 * **new row with foreign key inserted** - write an add record to the parent
 table for this key. Use the version from the foreign key update.

 * **foreign key updated** - write a delete record to the parent table for the old key and a add record to the parent table for this key.

 * **row deleted or foreign key updated to null** - write a delete record to the parent table for the old key and a add record to the parent table for this key.

**ON: source column changed**

 * write the new value (with its version) to all target fields

**ON: children updated**
 * on ADD - populate relevant target values from sources, use version from ADD record
 * on DELETE - populate relevant target values with nulls, use version from ADD record

# Implementation (DynamoDB / Lambda)

The MoM can be implemented in a fairly straightforward way with DynamoDB and Lambda.
The process was written with DynamoDB in mind.  In fact the original expansion of
tripleD was going to be **DynamoDB Denormalization**.  But it seemed more useful to
generalize the algorithm.

DynamoDB rows and columns are
used for the Map of Maps and DynamoDB streams and Lambda are used for events.

## Costs (100 updates / sec)
 * Let's assume 5x cascading updates
 * DynamoDB Writes - 600 writes / sec = $280 / month
 * DyanmoDB Stream Reads -  600 reads/sec = $311 / month
 * Lambda - tbd

# Implementation (Spark Streaming)

tripled can be implemented in Spark Streaming using the `mapWithState` function.

(more coming)
