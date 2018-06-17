const youtubedl = require('youtube-dl')
const promisify = require('promisify-es6')

const ERRORS = require('./errors')

function isURL (text) {
  var pattern = '^(https?:\\/\\/)?' + // protocol
	'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
	'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
	'(?::\\d{2,5})?' + // port
	'(?:/[^\\s]*)?$'; // path

  var re = new RegExp(pattern, 'i');
  return re.test(text);
}

module.exports = promisify((url, callback) => {

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

  youtubedl.getInfo(url, null, (err, info) => {
    if (err) throw err

    if (!Array.isArray(info)) {
      info = [info]
    }

    callback(null, info)
  })

})

module.exports.errors = ERRORS
