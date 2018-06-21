const youtubedl = require('youtube-dl')
const extend = require('deep-extend')
const promisify = require('promisify-es6')

const ERRORS = require('./errors')
const resolvers = require('./resolvers')

function isURL (text) {
  var pattern = '^(https?:\\/\\/)?' + // protocol
	'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
	'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
	'(?::\\d{2,5})?' + // port
	'(?:/[^\\s]*)?$'; // path

  var re = new RegExp(pattern, 'i');
  return re.test(text);
}

const defaults = {
  resolver: null
}

const getResolver = (name) => {
  return resolvers.find((resolver) => {
    return resolver._name === name
  })
}

module.exports = promisify(async (url, opts = {}, callback) => {

  if (typeof opts === 'function') {
    callback = opts
    opts = {}
  }

  if (!url) {
    return callback(Object.assign(new Error('missing url'), {
      code: ERRORS.ERR_MISSING_URL,
      url: url
    }))
  }

  if (!isURL(url)) {
    return callback(Object.assign(new Error('not a valid url'), {
      code: ERRORS.ERR_NOT_VALID_URL,
      url: url
    }))
  }

  const options = extend(defaults, opts)

  if (options.useYTDL) {
    return youtubedl.getInfo(url, null, (err, info) => {
      if (err) throw err

      if (!Array.isArray(info)) {
        info = [info]
      }

      callback(null, info)
    })
  }

  const rs = options.resolver ? getResolver(options.resolver) : resolvers

  const resolver = rs.find((resolver) => {
    return resolver.suitable(url)
  })

  if (!resolver) {
    return callback(Object.assign(new Error('not a suitable url'), {
      code: ERRORS.ERR_NOT_SUITABLE_URL,
      url: url
    }))
  }

  try {
    let result = await resolver.extract(url)

    if (!Array.isArray(result)) {
      result = [result]
    }

    callback(null, result)
  } catch (e) {
    console.log(e)
    callback(e)
  }
})

module.exports.errors = ERRORS
