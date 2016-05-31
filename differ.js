function input(records) {
  async.each(records, processRecord)
}
