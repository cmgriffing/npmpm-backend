/advc/login
  method get
  src src/http/auth/advc/login

/advc/callback
  method post
  src src/http/auth/advc/callback

/advc/token
  method post
  src src/http/auth/advc/token

/oauth/:provider/callback
  method post
  src src/http/auth/oauth/callback

/*
  method options
  src src/http/options
