const Resolver = require('./resolver')

class VimeoResolver extends Resolver {
  constructor () {
    super()

    this._valid_url = /vimeo/
  }

  async extract (url) {
    throw new Error('Not Implemented')
  }
}

module.exports.default = [VimeoResolver]
