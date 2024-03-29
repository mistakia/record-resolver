const ERRORS = require('./errors')
const youtubedl = require('youtube-dl')

const isURL = (text) => {
  var pattern = '^(https?:\\/\\/)?' + // protocol
	'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
	'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
	'(?::\\d{2,5})?' + // port
	'(?:/[^\\s]*)?$'; // path

  var re = new RegExp(pattern, 'i');
  return re.test(text);
}

const formatInfo = (info) => {
  let {
    id,
    extractor,
    fulltitle,
    thumbnail,
    artist,
    upload_date,
    alt_title,
    extractor_key,
    formats,
    url,
    webpage_url,
    _duration_raw
  } = info

  if (formats && extractor === 'youtube') {
    const audio_formats = formats.filter(f => f.acodec !== 'none' && f.vcodec ==='none' && f.ext === 'm4a')
    const bestFormat = audio_formats.sort((a, b) => b.abr - a.abr)
    url = bestFormat[0].url
  }

  if (extractor === '8tracks') {
    webpage_url = `http://8tracks.com/tracks/${id}`
  }

  return {
    id,
    extractor,
    fulltitle: fulltitle || null,
    thumbnail: thumbnail || null,
    artist: artist || null,
    alt_title: alt_title || null,
    upload_date: upload_date || null,
    webpage_url: webpage_url || null,
    url: url || null,
    duration: _duration_raw || null
  }
}

const getInfo = (url) => {
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

const resolver = module.exports = async (url) => {
  if (!url) {
    throw Object.assign(new Error('missing url'), {
      code: ERRORS.ERR_MISSING_URL,
      url: url
    })
  }

  if (!isURL(url)) {
    throw Object.assign(new Error('not a valid url'), {
      code: ERRORS.ERR_NOT_VALID_URL,
      url: url
    })
  }

  try {
    const info = await getInfo(url)
    return info.map(i => formatInfo(i))
  } catch (err) {
    throw Object.assign(new Error('Unsupported URL'), {
      code: ERRORS.ERR_NOT_SUITABLE_URL,
      url: url
    })
  }
}

resolver.setYtdlBinary = (ytdlBinary) => {
  if (ytdlBinary) youtubedl.setYtdlBinary(ytdlBinary)
}

resolver.errors = ERRORS
