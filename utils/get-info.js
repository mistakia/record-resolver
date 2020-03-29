const youtubedl = require('youtube-dl')

module.exports = (url) => {
  return new Promise((resolve, reject) => {
    const options = []
    youtubedl.getInfo(url, options, (err, info) => {
      if (err) {
        return reject(err)
      }

      if (!Array.isArray(info)) {
        info = [info]
      }

      resolve(info)
    })
  })
}
