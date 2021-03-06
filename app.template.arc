@app
npmpm-backend

@http
{{{routes}}}

@tables
core
  partitionKey *String
  sortKey **String

advc
  partitionKey *String
  sortKey **String
  expires TTL

@tables-indexes
core
  sortKey *String
  partitionKey **String
  name sortKey

core
  tertiaryKey *String
  partitionKey **String
  name tertiaryKey

@aws
timeout 10
# profile default
# region us-west-1
