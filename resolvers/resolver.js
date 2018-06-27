const extend = require('deep-extend')

const defaultInfo = {
  id: null,
  extractor: null,
  url: null,
  fulltitle: null,
  webpage_url: null,
  thumbnail: null,
  duration: null
}

class Resolver {
  constructor () {

  }

  suitable (url) {
    return this._valid_url.test(url)
  }

  extract (info) {
    return extend(defaultInfo, info)
  }

}

module.exports = Resolver
